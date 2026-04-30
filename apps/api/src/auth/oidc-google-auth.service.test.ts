import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { User } from '@leanmgmt/prisma-client';

import { EncryptionService } from '../common/encryption/encryption.service.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

import { AuthService } from './auth.service.js';
import {
  AuthOidcDisabledException,
  AuthOidcInvalidRequestException,
  AuthOidcStateInvalidException,
} from './auth.exceptions.js';
import { OidcGoogleAuthService } from './oidc-google-auth.service.js';

const oidcClientMocks = vi.hoisted(() => ({
  authorizationCodeGrantMock: vi.fn(),
  discoveryMock: vi.fn(),
}));

vi.mock('openid-client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('openid-client')>();
  const fakeServer = {
    issuer: 'https://accounts.google.com',
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
  } as import('openid-client').ServerMetadata;

  oidcClientMocks.discoveryMock.mockImplementation(() =>
    Promise.resolve(
      new mod.Configuration(
        fakeServer,
        'test-client-id',
        { redirect_uris: ['http://127.0.0.1:3001/api/v1/auth/oauth/google/callback'] },
        mod.ClientSecretPost('test-secret'),
      ),
    ),
  );

  return {
    ...mod,
    discovery: (...args: unknown[]) => oidcClientMocks.discoveryMock(...args),
    authorizationCodeGrant: (...args: unknown[]) =>
      oidcClientMocks.authorizationCodeGrantMock(...args),
  };
});

function makeConfig(getImpl: <K extends keyof Env>(key: K) => Env[K]): ConfigService<Env, true> {
  return { get: getImpl } as unknown as ConfigService<Env, true>;
}

function oidcEnv(
  oidcEnabled: boolean,
  extras: Partial<Pick<Env, 'WEB_PUBLIC_ORIGIN'>> = {},
): ConfigService<Env, true> {
  return makeConfig(<K extends keyof Env>(key: K) => {
    const map: Partial<Env> = {
      OIDC_ENABLED: oidcEnabled,
      NODE_ENV: 'test',
      OIDC_ISSUER: 'https://accounts.google.com',
      OIDC_CLIENT_ID: 'cid',
      OIDC_CLIENT_SECRET: 'sec',
      OIDC_REDIRECT_URI: 'http://127.0.0.1:3001/api/v1/auth/oauth/google/callback',
      OIDC_SCOPES: 'openid email profile',
      WEB_PUBLIC_ORIGIN: undefined,
      ...extras,
    };
    if (key in map) return map[key] as Env[K];
    throw new Error(`unexpected config key ${String(key)}`);
  });
}

async function createTestingOidcService(opts: {
  oidcEnabled: boolean;
  redisStore: Map<string, string>;
  prismaUser: User | null;
  authMock?: {
    assertUserEligibleForLogin: ReturnType<typeof vi.fn>;
    issueSessionForUser: ReturnType<typeof vi.fn>;
  };
  configExtras?: Partial<Pick<Env, 'WEB_PUBLIC_ORIGIN'>>;
}): Promise<OidcGoogleAuthService> {
  const { oidcEnabled, redisStore, prismaUser, authMock, configExtras } = opts;
  const blindForSuperadmin = 'blind-superadmin';

  const mockPrisma = {
    user: {
      findUnique: vi
        .fn()
        .mockImplementation(async ({ where }: { where: { emailBlindIndex?: string } }) => {
          if (where.emailBlindIndex === blindForSuperadmin) return prismaUser;
          return null;
        }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(prismaUser),
      update: vi.fn().mockResolvedValue({}),
    },
    loginAttempt: { create: vi.fn().mockResolvedValue({}) },
  };

  const mockRedis = {
    raw: {
      set: vi.fn(async (key: string, val: string) => {
        redisStore.set(key, val);
      }),
      get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
      del: vi.fn(async (key: string) => {
        redisStore.delete(key);
      }),
    },
  };

  const mockEncryption = {
    emailBlindIndex: vi.fn((email: string) => {
      if (email === 'superadmin@leanmgmt.local') return blindForSuperadmin;
      return `blind-${email}`;
    }),
  };

  const mockAuth =
    authMock ??
    ({
      assertUserEligibleForLogin: vi.fn().mockResolvedValue(undefined),
      issueSessionForUser: vi.fn().mockResolvedValue({
        accessToken: 'at',
        accessTokenExpiresAt: new Date().toISOString(),
        csrfToken: 'csrf',
        user: { id: 'u1' },
      }),
    } satisfies {
      assertUserEligibleForLogin: ReturnType<typeof vi.fn>;
      issueSessionForUser: ReturnType<typeof vi.fn>;
    });

  const moduleRef = await Test.createTestingModule({
    providers: [
      OidcGoogleAuthService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: RedisService, useValue: mockRedis },
      { provide: EncryptionService, useValue: mockEncryption },
      { provide: ConfigService, useValue: oidcEnv(oidcEnabled, configExtras) },
      { provide: AuthService, useValue: mockAuth },
    ],
  }).compile();

  return moduleRef.get(OidcGoogleAuthService);
}

describe('OidcGoogleAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    oidcClientMocks.authorizationCodeGrantMock.mockReset();
    // discovery mockReset implementasyonu siler; startGoogleOidc / getConfiguration kırılır.
    oidcClientMocks.discoveryMock.mockClear();
  });

  it('OIDC kapalıyken start AuthOidcDisabledException fırlatır', async () => {
    const svc = await createTestingOidcService({
      oidcEnabled: false,
      redisStore: new Map(),
      prismaUser: null,
    });
    const reply = { redirect: vi.fn(), setCookie: vi.fn() } as unknown as FastifyReply;
    await expect(
      svc.startGoogleOidc({ query: {} } as FastifyRequest, reply),
    ).rejects.toBeInstanceOf(AuthOidcDisabledException);
  });

  it('start: oidc_state çerezi SameSite=Lax (IdP dönüşünde Strict gönderilmez)', async () => {
    const redisStore = new Map<string, string>();
    const svc = await createTestingOidcService({
      oidcEnabled: true,
      redisStore,
      prismaUser: null,
    });
    const reply = { redirect: vi.fn(), setCookie: vi.fn() } as unknown as FastifyReply;
    await svc.startGoogleOidc({ query: {} } as FastifyRequest, reply);
    expect(reply.setCookie).toHaveBeenCalledWith(
      'oidc_state',
      expect.any(String),
      expect.objectContaining({ sameSite: 'lax', path: '/api/v1/auth', httpOnly: true }),
    );
    expect(reply.redirect).toHaveBeenCalled();
    expect(redisStore.size).toBe(1);
  });

  it('OIDC kapalıyken callback AuthOidcDisabledException fırlatır', async () => {
    const svc = await createTestingOidcService({
      oidcEnabled: false,
      redisStore: new Map(),
      prismaUser: null,
    });
    const req = {
      ip: '127.0.0.1',
      url: '/api/v1/auth/oauth/google/callback?code=x&state=y',
      headers: {},
      query: { code: 'x', state: 'y' },
      cookies: {},
    } as unknown as FastifyRequest;
    const reply = { clearCookie: vi.fn() } as unknown as FastifyReply;
    await expect(svc.handleGoogleCallback(req, reply)).rejects.toBeInstanceOf(
      AuthOidcDisabledException,
    );
  });

  it('callback code veya state yoksa AuthOidcInvalidRequestException', async () => {
    const svc = await createTestingOidcService({
      oidcEnabled: true,
      redisStore: new Map(),
      prismaUser: null,
    });
    const req = {
      ip: '127.0.0.1',
      url: '/api/v1/auth/oauth/google/callback',
      headers: { host: '127.0.0.1:3001' },
      query: {},
      cookies: {},
    } as unknown as FastifyRequest;
    const reply = { clearCookie: vi.fn() } as unknown as FastifyReply;
    await expect(svc.handleGoogleCallback(req, reply)).rejects.toBeInstanceOf(
      AuthOidcInvalidRequestException,
    );
  });

  it('callback cookie state ile query state uyuşmazsa AuthOidcStateInvalidException', async () => {
    const svc = await createTestingOidcService({
      oidcEnabled: true,
      redisStore: new Map(),
      prismaUser: null,
    });
    const req = {
      ip: '127.0.0.1',
      url: '/api/v1/auth/oauth/google/callback?code=c&state=from-query',
      headers: { host: '127.0.0.1:3001' },
      query: { code: 'c', state: 'from-query' },
      cookies: { oidc_state: 'from-cookie' },
    } as unknown as FastifyRequest;
    const reply = { clearCookie: vi.fn() } as unknown as FastifyReply;
    await expect(svc.handleGoogleCallback(req, reply)).rejects.toBeInstanceOf(
      AuthOidcStateInvalidException,
    );
  });

  it('callback Redis PKCE yoksa AuthOidcStateInvalidException', async () => {
    const state = 'same-state';
    const svc = await createTestingOidcService({
      oidcEnabled: true,
      redisStore: new Map(),
      prismaUser: null,
    });
    const req = {
      ip: '127.0.0.1',
      url: `/api/v1/auth/oauth/google/callback?code=c&state=${state}`,
      headers: { host: '127.0.0.1:3001' },
      query: { code: 'c', state },
      cookies: { oidc_state: state },
    } as unknown as FastifyRequest;
    const reply = { clearCookie: vi.fn() } as unknown as FastifyReply;
    await expect(svc.handleGoogleCallback(req, reply)).rejects.toBeInstanceOf(
      AuthOidcStateInvalidException,
    );
  });

  it('başarılı callback issueSessionForUser çağırır', async () => {
    const state = 'ok-state-xyz';
    const redisStore = new Map<string, string>([
      [
        `oidc:pkce:${state}`,
        JSON.stringify({
          code_verifier: 'verifier-value-43chars-minimum-length-ok-12345',
          nonce: 'nonce-val',
        }),
      ],
    ]);

    const prismaUser = {
      id: 'user-1',
      externalSubject: null,
      emailBlindIndex: 'blind-superadmin',
      isActive: true,
      anonymizedAt: null,
      lockedUntil: null,
    } as unknown as User;

    const issueSessionForUser = vi.fn().mockResolvedValue({
      accessToken: 'jwt',
      accessTokenExpiresAt: new Date().toISOString(),
      csrfToken: 'csrf',
      user: { id: 'user-1' },
    });

    const svc = await createTestingOidcService({
      oidcEnabled: true,
      redisStore,
      prismaUser,
      authMock: {
        assertUserEligibleForLogin: vi.fn().mockResolvedValue(undefined),
        issueSessionForUser,
      },
    });

    oidcClientMocks.authorizationCodeGrantMock.mockResolvedValue({
      claims: () => ({
        sub: 'google-sub-99',
        email: 'superadmin@leanmgmt.local',
        email_verified: true,
      }),
    });

    const req = {
      ip: '127.0.0.1',
      url: `http://127.0.0.1:3001/api/v1/auth/oauth/google/callback?code=auth-code&state=${encodeURIComponent(state)}`,
      headers: { host: '127.0.0.1:3001' },
      query: { code: 'auth-code', state },
      cookies: { oidc_state: state },
    } as unknown as FastifyRequest;

    const reply = {
      clearCookie: vi.fn(),
      setCookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as FastifyReply;

    const out = await svc.handleGoogleCallback(req, reply);
    expect(out?.accessToken).toBe('jwt');
    expect(issueSessionForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        auditLoginMethod: 'OIDC',
      }),
    );
    expect(oidcClientMocks.authorizationCodeGrantMock).toHaveBeenCalled();
  });

  it('WEB_PUBLIC_ORIGIN tanımlıyken başarılı callback JSON yerine yönlendirir', async () => {
    const state = 'ok-state-webpub';
    const redisStore = new Map<string, string>([
      [
        `oidc:pkce:${state}`,
        JSON.stringify({
          code_verifier: 'verifier-value-43chars-minimum-length-ok-12345',
          nonce: 'nonce-val',
          returnTo: '/tasks',
        }),
      ],
    ]);

    const prismaUser = {
      id: 'user-1',
      externalSubject: null,
      emailBlindIndex: 'blind-superadmin',
      isActive: true,
      anonymizedAt: null,
      lockedUntil: null,
    } as unknown as User;

    const issueSessionForUser = vi.fn().mockResolvedValue({
      accessToken: 'jwt',
      accessTokenExpiresAt: new Date().toISOString(),
      csrfToken: 'csrf',
      user: { id: 'user-1' },
    });

    const svc = await createTestingOidcService({
      oidcEnabled: true,
      redisStore,
      prismaUser,
      configExtras: { WEB_PUBLIC_ORIGIN: 'http://127.0.0.1:3000' },
      authMock: {
        assertUserEligibleForLogin: vi.fn().mockResolvedValue(undefined),
        issueSessionForUser,
      },
    });

    oidcClientMocks.authorizationCodeGrantMock.mockResolvedValue({
      claims: () => ({
        sub: 'google-sub-99',
        email: 'superadmin@leanmgmt.local',
        email_verified: true,
      }),
    });

    const req = {
      ip: '127.0.0.1',
      url: `http://127.0.0.1:3001/api/v1/auth/oauth/google/callback?code=auth-code&state=${encodeURIComponent(state)}`,
      headers: { host: '127.0.0.1:3001' },
      query: { code: 'auth-code', state },
      cookies: { oidc_state: state },
    } as unknown as FastifyRequest;

    const reply = {
      clearCookie: vi.fn(),
      setCookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as FastifyReply;

    const out = await svc.handleGoogleCallback(req, reply);
    expect(out).toBeUndefined();
    expect(reply.redirect).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/login?oidc=success&redirect=%2Ftasks',
      302,
    );
    expect(issueSessionForUser).toHaveBeenCalled();
  });
});
