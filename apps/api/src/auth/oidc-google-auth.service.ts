import { createHash, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as client from 'openid-client';

import { sanitizeInternalRedirectPath } from '@leanmgmt/shared-utils';

import { EncryptionService } from '../common/encryption/encryption.service.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

import { AuthService } from './auth.service.js';
import { buildPostOidcLoginUrl } from './oidc-login-redirect.js';
import {
  AuthOidcDisabledException,
  AuthOidcEmailUnverifiedException,
  AuthOidcInvalidClaimsException,
  AuthOidcInvalidRequestException,
  AuthOidcStateInvalidException,
  AuthOidcTokenException,
  AuthOidcUserNotProvisionedException,
} from './auth.exceptions.js';

const OIDC_STATE_COOKIE = 'oidc_state';
const OIDC_PKCE_REDIS_PREFIX = 'oidc:pkce:';
const OIDC_REDIS_TTL_SEC = 600;
const AUTH_COOKIE_PATH = '/api/v1/auth';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

@Injectable()
export class OidcGoogleAuthService {
  private readonly logger = new Logger(OidcGoogleAuthService.name);
  private oidcConfiguration: Promise<client.Configuration> | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  private assertOidcEnabled(): void {
    if (!this.config.get('OIDC_ENABLED', { infer: true })) {
      throw new AuthOidcDisabledException();
    }
  }

  private async getConfiguration(): Promise<client.Configuration> {
    if (!this.oidcConfiguration) {
      const issuerUrl = this.config.get('OIDC_ISSUER', { infer: true })!;
      const clientId = this.config.get('OIDC_CLIENT_ID', { infer: true })!;
      const redirectUri = this.config.get('OIDC_REDIRECT_URI', { infer: true })!;
      const secret = this.config.get('OIDC_CLIENT_SECRET', { infer: true });
      const clientAuth = secret ? client.ClientSecretPost(secret) : client.None();
      this.oidcConfiguration = client.discovery(
        new URL(issuerUrl),
        clientId,
        { redirect_uris: [redirectUri] },
        clientAuth,
      );
    }
    return this.oidcConfiguration;
  }

  private callbackUrlFromRequest(req: FastifyRequest): URL {
    // Proxy ortamında host başlığı API'nin iç portu gösterebilir (örn. 3001 yerine 3000).
    // openid-client, token değişiminde bu URL'yi kayıtlı redirect_uri ile karşılaştırır;
    // bu yüzden konfigüre edilmiş URI'yi taban olarak kullanıp yalnızca query parametrelerini
    // gerçek istekten alıyoruz — böylece proxy üzerinden gelen çağrılarda port uyumsuzluğu olmaz.
    const configuredUri = this.config.get('OIDC_REDIRECT_URI', { infer: true })!;
    const base = new URL(configuredUri);
    const qIndex = req.url.indexOf('?');
    if (qIndex !== -1) {
      const qs = new URLSearchParams(req.url.slice(qIndex + 1));
      qs.forEach((value, key) => base.searchParams.set(key, value));
    }
    return base;
  }

  /**
   * OIDC-1: state cookie + Redis’te PKCE/nonce; IdP’ye 302.
   * `?redirect=/iç-path` — IdP dönüşünde query taşınmaz; returnTo Redis yükünde saklanır.
   */
  async startGoogleOidc(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    this.assertOidcEnabled();
    const oidcConfig = await this.getConfiguration();

    const state = client.randomState();
    const nonce = client.randomNonce();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

    const redirectUri = this.config.get('OIDC_REDIRECT_URI', { infer: true })!;
    const scope = this.config.get('OIDC_SCOPES', { infer: true });

    const q = req.query as Record<string, unknown>;
    const returnTo = sanitizeInternalRedirectPath(q.redirect);

    await this.redis.raw.set(
      `${OIDC_PKCE_REDIS_PREFIX}${state}`,
      JSON.stringify(
        returnTo
          ? { code_verifier: codeVerifier, nonce, returnTo }
          : { code_verifier: codeVerifier, nonce },
      ),
      'EX',
      OIDC_REDIS_TTL_SEC,
    );

    const secure = this.config.get('NODE_ENV', { infer: true }) !== 'development';
    // Lax: IdP 302 dönüşü cross-site top-level GET; Strict ile çerez gönderilmez → state doğrulaması düşer.
    reply.setCookie(OIDC_STATE_COOKIE, state, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: AUTH_COOKIE_PATH,
      maxAge: OIDC_REDIS_TTL_SEC,
    });

    const authorizeUrl = client.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: redirectUri,
      scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    reply.redirect(authorizeUrl.href, 302);
  }

  /**
   * OIDC-2: code → token; kullanıcı eşleme (JIT yok); email+şifre ile aynı session çıktısı.
   */
  async handleGoogleCallback(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<
    | {
        accessToken: string;
        accessTokenExpiresAt: string;
        csrfToken: string;
        user: Record<string, unknown>;
      }
    | undefined
  > {
    this.assertOidcEnabled();
    const ip = req.ip ?? '0.0.0.0';
    const ua = (req.headers['user-agent'] ?? '').slice(0, 512);
    const ipH = sha256Hex(ip);

    const q = req.query as Record<string, unknown>;
    if (typeof q.error === 'string') {
      this.logger.warn({ event: 'oidc_authorization_error', error: q.error });
      throw new AuthOidcTokenException();
    }

    const code = typeof q.code === 'string' ? q.code : undefined;
    const state = typeof q.state === 'string' ? q.state : undefined;
    if (!code || !state) {
      throw new AuthOidcInvalidRequestException();
    }

    const cookieState =
      typeof req.cookies?.[OIDC_STATE_COOKIE] === 'string'
        ? req.cookies[OIDC_STATE_COOKIE]
        : undefined;
    if (!cookieState || !timingSafeEqualString(cookieState, state)) {
      throw new AuthOidcStateInvalidException();
    }

    const redisKey = `${OIDC_PKCE_REDIS_PREFIX}${state}`;
    const raw = await this.redis.raw.get(redisKey);
    await this.redis.raw.del(redisKey);
    if (!raw) {
      throw new AuthOidcStateInvalidException();
    }

    let pkcePayload: { code_verifier: string; nonce: string; returnTo?: string };
    let postLoginReturnTo: string | undefined;
    try {
      pkcePayload = JSON.parse(raw) as { code_verifier: string; nonce: string; returnTo?: string };
      postLoginReturnTo = sanitizeInternalRedirectPath(pkcePayload.returnTo);
    } catch {
      throw new AuthOidcStateInvalidException();
    }

    const secure = this.config.get('NODE_ENV', { infer: true }) !== 'development';
    reply.clearCookie(OIDC_STATE_COOKIE, { path: AUTH_COOKIE_PATH, secure, sameSite: 'lax' });

    const oidcConfig = await this.getConfiguration();
    const currentUrl = this.callbackUrlFromRequest(req);

    let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
    try {
      tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
        pkceCodeVerifier: pkcePayload.code_verifier,
        expectedState: state,
        expectedNonce: pkcePayload.nonce,
        idTokenExpected: true,
      });
    } catch (err) {
      this.logger.warn({
        event: 'oidc_authorization_code_grant_failed',
        message: err instanceof Error ? err.message : 'unknown',
      });
      throw new AuthOidcTokenException();
    }

    const claims = tokens.claims();
    const emailRaw = claims?.email;
    if (typeof emailRaw !== 'string' || !emailRaw) {
      throw new AuthOidcInvalidClaimsException();
    }
    const email = emailRaw.toLowerCase();
    if (claims?.email_verified !== true) {
      const blindUnverified = this.encryption.emailBlindIndex(email);
      await this.prisma.loginAttempt.create({
        data: {
          emailBlindIndex: blindUnverified,
          ipHash: ipH,
          userAgent: ua,
          outcome: 'FAILURE',
        },
      });
      throw new AuthOidcEmailUnverifiedException();
    }

    const blind = this.encryption.emailBlindIndex(email);
    const user = await this.prisma.user.findUnique({ where: { emailBlindIndex: blind } });
    if (!user) {
      await this.prisma.loginAttempt.create({
        data: {
          emailBlindIndex: blind,
          ipHash: ipH,
          userAgent: ua,
          outcome: 'FAILURE',
          failureReason: 'USER_NOT_FOUND',
        },
      });
      throw new AuthOidcUserNotProvisionedException();
    }

    const sub = typeof claims.sub === 'string' ? claims.sub : null;
    if (sub && user.externalSubject !== sub) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { externalSubject: sub },
      });
    }

    const fullUser = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    await this.auth.assertUserEligibleForLogin(fullUser, ip, blind, ua);

    const sessionOut = await this.auth.issueSessionForUser({
      userId: user.id,
      emailBlindIndexForAttempt: blind,
      ip,
      userAgent: ua,
      reply,
      auditLoginMethod: 'OIDC',
    });

    const webOrigin = this.config.get('WEB_PUBLIC_ORIGIN', { infer: true });
    if (webOrigin) {
      const location = buildPostOidcLoginUrl(webOrigin, {
        oidc: 'success',
        redirect: postLoginReturnTo,
      });
      reply.redirect(location, 302);
      return undefined;
    }

    return sessionOut;
  }
}
