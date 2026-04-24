import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';

import type {
  ChangePasswordInput,
  ConsentAcceptInput,
  LoginInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
} from '@leanmgmt/shared-schemas';

import { AuditLogService } from '../common/audit/audit-log.service.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

import {
  AuthAccountLockedException,
  AuthAccountPassiveException,
  AuthInvalidCredentialsException,
  AuthIpNotWhitelistedException,
  AuthSessionRevokedException,
  AuthTokenInvalidException,
  ConsentVersionNotFoundException,
  RateLimitIpException,
  RateLimitLoginException,
  RateLimitUserException,
  UserAnonymizedException,
} from './auth.exceptions.js';
import type { AccessTokenPayload } from './auth.types.js';
import { ConsentPolicyService } from './consent-policy.service.js';

const BCRYPT_COST = 12;
const DUMMY_BCRYPT = '$2a$12$DummyHashForTimingAttackProtection_aaaaaaaaaaaaaaaaaaaaaa';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function addDaysUtc(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(AuditLogService) private readonly audit: AuditLogService,
    @Inject(ConsentPolicyService) private readonly consentPolicy: ConsentPolicyService,
  ) {}

  private ipHash(ip: string): string {
    return sha256Hex(ip);
  }

  private async rlIncr(key: string, ttlSec: number): Promise<number> {
    const n = await this.redis.raw.incr(key);
    if (n === 1) {
      await this.redis.raw.expire(key, ttlSec);
    }
    return n;
  }

  private async getJsonSetting<T>(key: string): Promise<T | null> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!row) return null;
    return row.value as T;
  }

  private async getIntSetting(key: string, fallback: number): Promise<number> {
    const v = await this.getJsonSetting<number>(key);
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  }

  private async isSuperadminUser(userId: string): Promise<boolean> {
    const row = await this.prisma.userRole.findFirst({
      where: { userId, role: { code: 'SUPERADMIN' } },
      select: { id: true },
    });
    return row !== null;
  }

  private async assertSuperadminIpAllowed(userId: string, ip: string): Promise<void> {
    if (!(await this.isSuperadminUser(userId))) return;
    const list = await this.getJsonSetting<string[]>('SUPERADMIN_IP_WHITELIST');
    if (!list || list.length === 0) return;
    if (!list.includes(ip)) {
      this.logger.warn({ event: 'superadmin_ip_blocked', userId });
      throw new AuthIpNotWhitelistedException();
    }
  }

  private async loadPermissionKeys(userId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { userRoles: { some: { userId } } } },
      select: { permissionKey: true },
      distinct: ['permissionKey'],
    });
    return rows.map((r) => r.permissionKey).sort();
  }

  private async consentState(userId: string): Promise<{
    activeConsentVersionId: string | null;
    consentAccepted: boolean;
  }> {
    const activeConsentVersionId = await this.consentPolicy.getActiveConsentVersionId();
    if (!activeConsentVersionId) {
      return { activeConsentVersionId: null, consentAccepted: true };
    }
    const consentAccepted = await this.consentPolicy.hasAcceptedActiveVersion(userId);
    return { activeConsentVersionId, consentAccepted };
  }

  private async passwordExpiresAtIso(user: User): Promise<string | null> {
    if (!user.passwordChangedAt) return null;
    const days = await this.getIntSetting('PASSWORD_EXPIRY_DAYS', 180);
    return addDaysUtc(user.passwordChangedAt, days).toISOString();
  }

  private async buildLoginUserPayload(user: User): Promise<Record<string, unknown>> {
    const permissions = await this.loadPermissionKeys(user.id);
    const { activeConsentVersionId, consentAccepted } = await this.consentState(user.id);
    const passwordExpiresAt = await this.passwordExpiresAtIso(user);
    return {
      id: user.id,
      sicil: this.encryption.decryptSicil(user.sicilEncrypted),
      firstName: user.firstName,
      lastName: user.lastName,
      email: this.encryption.decryptEmail(user.emailEncrypted),
      permissions,
      activeConsentVersionId,
      consentAccepted,
      passwordExpiresAt,
    };
  }

  private async progressiveDelayMs(emailBlindIndex: string): Promise<number> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return 0;
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const failures = await this.prisma.loginAttempt.count({
      where: {
        emailBlindIndex,
        attemptedAt: { gte: since },
        outcome: 'FAILURE',
      },
    });
    if (failures <= 0) return 0;
    return Math.min(8000, 1000 * 2 ** Math.min(failures - 1, 3));
  }

  private async assertLoginRateLimits(ip: string, emailBlindIndex: string): Promise<void> {
    const ipH = this.ipHash(ip);
    const ipCount = await this.rlIncr(`rl:login:ip:${ipH}`, 60);
    if (ipCount > 10) throw new RateLimitIpException();
    const emCount = await this.rlIncr(`rl:login:em:${emailBlindIndex}`, 15 * 60);
    if (emCount > 5) throw new RateLimitLoginException(60);
  }

  private async assertRefreshRateLimit(userId: string): Promise<void> {
    const n = await this.rlIncr(`rl:refresh:user:${userId}`, 60);
    if (n > 30) throw new RateLimitUserException();
  }

  private async assertResetEmailRateLimit(emailBlind: string): Promise<void> {
    const n = await this.rlIncr(`rl:pwdreset:em:${emailBlind}`, 3600);
    if (n > 3) throw new RateLimitUserException();
  }

  private async assertResetIpRateLimit(ip: string): Promise<void> {
    const ipH = this.ipHash(ip);
    const n = await this.rlIncr(`rl:pwdreset:ip:${ipH}`, 3600);
    if (n > 5) throw new RateLimitIpException();
  }

  private async assertChangePasswordRateLimit(userId: string): Promise<void> {
    const n = await this.rlIncr(`rl:chpwd:user:${userId}`, 3600);
    if (n > 5) throw new RateLimitUserException();
  }

  private async assertResetConfirmIpRateLimit(ip: string): Promise<void> {
    const n = await this.rlIncr(`rl:pwdresetcfm:ip:${this.ipHash(ip)}`, 3600);
    if (n > 10) throw new RateLimitIpException();
  }

  async login(
    dto: LoginInput,
    ip: string,
    userAgent: string,
    reply: FastifyReply,
  ): Promise<{
    accessToken: string;
    accessTokenExpiresAt: string;
    csrfToken: string;
    user: Record<string, unknown>;
  }> {
    const emailBlind = this.encryption.emailBlindIndex(dto.email);
    await this.assertLoginRateLimits(ip, emailBlind);

    const delayMs = await this.progressiveDelayMs(emailBlind);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const user = await this.prisma.user.findUnique({
      where: { emailBlindIndex: emailBlind },
    });

    const hashToCompare = user?.passwordHash ?? DUMMY_BCRYPT;
    const valid = await bcrypt.compare(dto.password, hashToCompare);

    const ua = userAgent.slice(0, 512);
    const ipH = this.ipHash(ip);

    if (!user || !valid) {
      await this.prisma.loginAttempt.create({
        data: {
          emailBlindIndex: emailBlind,
          userId: user?.id,
          ipHash: ipH,
          userAgent: ua,
          outcome: 'FAILURE',
          failureReason: !user ? 'USER_NOT_FOUND' : 'INVALID_PASSWORD',
        },
      });
      if (user) {
        const fails = user.failedLoginCount + 1;
        const threshold = await this.getIntSetting('LOCKOUT_THRESHOLD', 5);
        const lockMin = await this.getIntSetting('LOCKOUT_DURATION_MINUTES', 30);
        const until = fails >= threshold ? new Date(Date.now() + lockMin * 60 * 1000) : null;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: fails,
            ...(until ? { lockedUntil: until } : {}),
          },
        });
      }
      throw new AuthInvalidCredentialsException();
    }

    if (user.anonymizedAt) {
      await this.prisma.loginAttempt.create({
        data: {
          emailBlindIndex: emailBlind,
          userId: user.id,
          ipHash: ipH,
          userAgent: ua,
          outcome: 'FAILURE',
          failureReason: 'USER_ANONYMIZED',
        },
      });
      throw new UserAnonymizedException();
    }

    if (!user.isActive) {
      await this.prisma.loginAttempt.create({
        data: {
          emailBlindIndex: emailBlind,
          userId: user.id,
          ipHash: ipH,
          userAgent: ua,
          outcome: 'FAILURE',
          failureReason: 'USER_PASSIVE',
        },
      });
      throw new AuthAccountPassiveException();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.prisma.loginAttempt.create({
        data: {
          emailBlindIndex: emailBlind,
          userId: user.id,
          ipHash: ipH,
          userAgent: ua,
          outcome: 'BLOCKED',
          blockedBy: 'ACCOUNT_LOCKED',
          lockoutTriggered: true,
        },
      });
      throw new AuthAccountLockedException(user.lockedUntil);
    }

    await this.assertSuperadminIpAllowed(user.id, ip);

    const rawRefresh = randomBytes(32).toString('base64url');
    const refreshHash = sha256Hex(rawRefresh);
    const csrf = randomBytes(32).toString('base64url');
    const expiresAt = addDaysUtc(new Date(), 14);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: refreshHash,
        ipHash: ipH,
        userAgent: ua,
        expiresAt,
      },
    });

    await this.redis.raw.set(`csrf:${session.id}`, csrf, 'EX', 14 * 24 * 3600);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await this.prisma.loginAttempt.create({
      data: {
        emailBlindIndex: emailBlind,
        userId: user.id,
        ipHash: ipH,
        userAgent: ua,
        outcome: 'SUCCESS',
        sessionId: session.id,
      },
    });

    await this.audit.append({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'user',
      entityId: user.id,
      ipHash: ipH,
      userAgent: ua,
      sessionId: session.id,
      metadata: { sessionId: session.id },
    });

    const jti = randomBytes(16).toString('hex');
    const accessToken = await this.jwt.signAsync<AccessTokenPayload>(
      { sub: user.id, sid: session.id, jti },
      {
        secret: this.config.get('JWT_ACCESS_SECRET_CURRENT', { infer: true }),
        algorithm: 'HS256',
        expiresIn: '15m',
      },
    );

    const decoded = this.jwt.decode(accessToken) as { exp?: number } | null;
    const accessTokenExpiresAt = new Date((decoded?.exp ?? 0) * 1000).toISOString();

    const secure = this.config.get('NODE_ENV', { infer: true }) !== 'development';
    reply.setCookie('refresh_token', rawRefresh, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 14 * 24 * 3600,
    });
    reply.setCookie('csrf_token', csrf, {
      httpOnly: false,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: 14 * 24 * 3600,
    });

    const userPayload = await this.buildLoginUserPayload(user);

    return {
      accessToken,
      accessTokenExpiresAt,
      csrfToken: csrf,
      user: userPayload,
    };
  }

  async refresh(
    ip: string,
    userAgent: string,
    refreshCookie: string | undefined,
    csrfHeader: string | undefined,
    reply: FastifyReply,
  ): Promise<{ accessToken: string; accessTokenExpiresAt: string; csrfToken: string }> {
    if (!refreshCookie) throw new AuthTokenInvalidException();
    if (!csrfHeader) throw new AuthTokenInvalidException();

    const refreshHash = sha256Hex(refreshCookie);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: refreshHash },
      include: { user: true },
    });

    if (!session) throw new AuthTokenInvalidException();
    if (session.status !== 'ACTIVE') {
      throw new AuthSessionRevokedException();
    }
    if (session.expiresAt < new Date()) {
      throw new AuthSessionRevokedException();
    }

    const user = session.user;
    if (!user.isActive) throw new AuthAccountPassiveException();

    const storedCsrf = await this.redis.raw.get(`csrf:${session.id}`);
    if (!storedCsrf || !timingSafeEqualString(storedCsrf, csrfHeader)) {
      throw new AuthTokenInvalidException();
    }

    await this.assertRefreshRateLimit(user.id);

    const newRaw = randomBytes(32).toString('base64url');
    const newHash = sha256Hex(newRaw);
    const newCsrf = randomBytes(32).toString('base64url');
    const ua = userAgent.slice(0, 512);
    const ipH = this.ipHash(ip);
    const expiresAt = addDaysUtc(new Date(), 14);

    await this.prisma.$transaction(async (tx) => {
      const rotated = await tx.session.updateMany({
        where: { id: session.id, status: 'ACTIVE', refreshTokenHash: refreshHash },
        data: {
          status: 'ROTATED',
          revokedAt: new Date(),
        },
      });
      if (rotated.count === 0) {
        const cur = await tx.session.findUnique({ where: { refreshTokenHash: refreshHash } });
        if (cur && cur.status !== 'ACTIVE') {
          throw new AuthSessionRevokedException();
        }
        throw new AuthTokenInvalidException();
      }

      const newSession = await tx.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: newHash,
          ipHash: ipH,
          userAgent: ua,
          expiresAt,
        },
      });

      await tx.session.update({
        where: { id: session.id },
        data: { rotatedToSessionId: newSession.id },
      });
    });

    const newSessionRow = await this.prisma.session.findUnique({
      where: { refreshTokenHash: newHash },
    });
    if (!newSessionRow) throw new AuthTokenInvalidException();

    await this.redis.raw.del(`csrf:${session.id}`);
    await this.redis.raw.set(`csrf:${newSessionRow.id}`, newCsrf, 'EX', 14 * 24 * 3600);

    const jti = randomBytes(16).toString('hex');
    const accessToken = await this.jwt.signAsync<AccessTokenPayload>(
      { sub: user.id, sid: newSessionRow.id, jti },
      {
        secret: this.config.get('JWT_ACCESS_SECRET_CURRENT', { infer: true }),
        algorithm: 'HS256',
        expiresIn: '15m',
      },
    );
    const decoded = this.jwt.decode(accessToken) as { exp?: number } | null;
    const accessTokenExpiresAt = new Date((decoded?.exp ?? 0) * 1000).toISOString();

    const secure = this.config.get('NODE_ENV', { infer: true }) !== 'development';
    reply.setCookie('refresh_token', newRaw, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 14 * 24 * 3600,
    });
    reply.setCookie('csrf_token', newCsrf, {
      httpOnly: false,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: 14 * 24 * 3600,
    });

    return { accessToken, accessTokenExpiresAt, csrfToken: newCsrf };
  }

  async logout(
    actor: AccessTokenPayload,
    ip: string,
    userAgent: string,
    refreshCookie: string | undefined,
    reply: FastifyReply,
  ): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: actor.sid } });
    const ipH = this.ipHash(ip);

    if (session && session.status === 'ACTIVE') {
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revocationReason: 'USER_INITIATED',
        },
      });
    }

    if (refreshCookie) {
      const h = sha256Hex(refreshCookie);
      await this.prisma.session.updateMany({
        where: { refreshTokenHash: h, userId: actor.sub, status: 'ACTIVE' },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revocationReason: 'USER_INITIATED',
        },
      });
    }

    await this.redis.raw.del(`csrf:${actor.sid}`);

    const accessTtl = 15 * 60;
    await this.redis.raw.set(`access_jti_revoked:${actor.jti}`, '1', 'EX', accessTtl);

    await this.audit.append({
      userId: actor.sub,
      action: 'USER_LOGOUT',
      entity: 'user',
      entityId: actor.sub,
      ipHash: ipH,
      userAgent: userAgent.slice(0, 512),
      sessionId: actor.sid,
      metadata: { sessionId: actor.sid, revocationReason: 'USER_INITIATED' },
    });

    const secure = this.config.get('NODE_ENV', { infer: true }) !== 'development';
    reply.clearCookie('refresh_token', { path: '/api/v1/auth', secure, sameSite: 'strict' });
    reply.clearCookie('csrf_token', { path: '/', secure, sameSite: 'strict' });
  }

  async passwordResetRequest(
    dto: PasswordResetRequestInput,
    ip: string,
    userAgent: string,
  ): Promise<{ message: string; resetToken?: string }> {
    const emailBlind = this.encryption.emailBlindIndex(dto.email);
    await this.assertResetEmailRateLimit(emailBlind);
    await this.assertResetIpRateLimit(ip);

    const user = await this.prisma.user.findUnique({ where: { emailBlindIndex: emailBlind } });
    const ipH = this.ipHash(ip);

    await this.audit.append({
      userId: user?.id ?? null,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'user',
      entityId: user?.id ?? null,
      ipHash: ipH,
      userAgent: userAgent.slice(0, 512),
      metadata: { emailBlindIndex: emailBlind },
    });

    const message = 'Eğer bu email sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.';

    if (!user || !user.isActive || user.anonymizedAt) {
      return { message };
    }

    const raw = randomBytes(32).toString('base64url');
    const tokenHash = sha256Hex(raw);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        requestIpHash: ipH,
      },
    });

    const expose =
      this.config.get('AUTH_EXPOSE_RESET_TOKEN', { infer: true }) === true ||
      this.config.get('NODE_ENV', { infer: true }) === 'test';
    if (expose) {
      return { message, resetToken: raw };
    }

    this.logger.log({ event: 'password_reset_token_issued', userId: user.id });
    return { message };
  }

  async passwordResetConfirm(
    dto: PasswordResetConfirmInput,
    ip: string,
  ): Promise<{ message: string }> {
    await this.assertResetConfirmIpRateLimit(ip);
    const tokenHash = sha256Hex(dto.token);
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new AuthTokenInvalidException();
    }

    const user = row.user;
    const recent = await this.prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const h of recent) {
      if (await bcrypt.compare(dto.newPassword, h.passwordHash)) {
        throw new AppException(
          'VALIDATION_FAILED',
          'Yeni şifre son kullandığınız şifrelerden biriyle aynı olamaz.',
          400,
          {
            rule: 'PASSWORD_REUSE',
          },
        );
      }
    }
    if (user.passwordHash && (await bcrypt.compare(dto.newPassword, user.passwordHash))) {
      throw new AppException(
        'VALIDATION_FAILED',
        'Yeni şifre mevcut şifrenizle aynı olamaz.',
        400,
        {
          rule: 'PASSWORD_SAME_AS_CURRENT',
        },
      );
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { userId: user.id, status: 'ACTIVE' },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revocationReason: 'PASSWORD_CHANGED',
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, passwordChangedAt: new Date() },
      });
      await tx.passwordHistory.create({
        data: { userId: user.id, passwordHash: newHash },
      });
    });

    const hist = await this.prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: 5,
    });
    for (const h of hist) {
      await this.prisma.passwordHistory.delete({ where: { id: h.id } });
    }

    await this.audit.append({
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      entity: 'user',
      entityId: user.id,
      ipHash: sha256Hex('password-reset-confirm'),
      metadata: { source: 'RESET_TOKEN' },
    });

    return { message: 'Şifreniz başarıyla güncellendi. Lütfen yeni şifrenizle giriş yapın.' };
  }

  async changePassword(
    actor: AccessTokenPayload,
    dto: ChangePasswordInput,
    ip: string,
    userAgent: string,
    reply: FastifyReply,
  ): Promise<void> {
    await this.assertChangePasswordRateLimit(actor.sub);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.sub } });
    if (!user.passwordHash) throw new AuthInvalidCredentialsException();
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new AuthInvalidCredentialsException();

    const recent = await this.prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const h of recent) {
      if (await bcrypt.compare(dto.newPassword, h.passwordHash)) {
        throw new AppException(
          'VALIDATION_FAILED',
          'Yeni şifre son kullandığınız şifrelerden biriyle aynı olamaz.',
          400,
          {
            rule: 'PASSWORD_REUSE',
          },
        );
      }
    }
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new AppException(
        'VALIDATION_FAILED',
        'Yeni şifre mevcut şifrenizle aynı olamaz.',
        400,
        {
          rule: 'PASSWORD_SAME_AS_CURRENT',
        },
      );
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);

    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { userId: user.id, status: 'ACTIVE', id: { not: actor.sid } },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revocationReason: 'PASSWORD_CHANGED',
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, passwordChangedAt: new Date() },
      });
      await tx.passwordHistory.create({
        data: { userId: user.id, passwordHash: newHash },
      });
    });

    const rawRefresh = randomBytes(32).toString('base64url');
    const refreshHash = sha256Hex(rawRefresh);
    const csrf = randomBytes(32).toString('base64url');
    await this.prisma.session.update({
      where: { id: actor.sid },
      data: {
        refreshTokenHash: refreshHash,
        lastActiveAt: new Date(),
        expiresAt: addDaysUtc(new Date(), 14),
      },
    });
    await this.redis.raw.set(`csrf:${actor.sid}`, csrf, 'EX', 14 * 24 * 3600);

    const hist = await this.prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: 5,
    });
    for (const h of hist) {
      await this.prisma.passwordHistory.delete({ where: { id: h.id } });
    }

    await this.audit.append({
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      entity: 'user',
      entityId: user.id,
      ipHash: this.ipHash(ip),
      userAgent: userAgent.slice(0, 512),
      sessionId: actor.sid,
      metadata: { source: 'SELF_SERVICE' },
    });

    const secure = this.config.get('NODE_ENV', { infer: true }) !== 'development';
    reply.setCookie('refresh_token', rawRefresh, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 14 * 24 * 3600,
    });
    reply.setCookie('csrf_token', csrf, {
      httpOnly: false,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: 14 * 24 * 3600,
    });
  }

  async acceptConsent(
    actor: AccessTokenPayload,
    dto: ConsentAcceptInput,
    ip: string,
    userAgent: string,
  ): Promise<{ acceptedAt: string; consentVersionId: string }> {
    const activeId = await this.consentPolicy.getActiveConsentVersionId();
    if (!activeId) throw new ConsentVersionNotFoundException();
    if (dto.consentVersionId !== activeId) {
      throw new AppException('VALIDATION_FAILED', 'Formu kontrol edin.', 400, {
        field: 'consentVersionId',
        expected: activeId,
      });
    }

    const version = await this.prisma.consentVersion.findFirst({
      where: { id: activeId, status: 'PUBLISHED' },
    });
    if (!version) throw new ConsentVersionNotFoundException();

    const ipH = this.ipHash(ip);
    const signature = createHash('sha256')
      .update(`${actor.sub}:${activeId}:${this.config.get('APP_PII_PEPPER', { infer: true })}`)
      .digest('hex');

    await this.prisma.userConsent.upsert({
      where: {
        userId_consentVersionId: {
          userId: actor.sub,
          consentVersionId: activeId,
        },
      },
      create: {
        userId: actor.sub,
        consentVersionId: activeId,
        ipHash: ipH,
        userAgent: userAgent.slice(0, 512),
        signature,
      },
      update: {
        acceptedAt: new Date(),
        ipHash: ipH,
        userAgent: userAgent.slice(0, 512),
        signature,
      },
    });

    await this.audit.append({
      userId: actor.sub,
      action: 'CONSENT_ACCEPTED',
      entity: 'user',
      entityId: actor.sub,
      ipHash: ipH,
      userAgent: userAgent.slice(0, 512),
      sessionId: actor.sid,
      metadata: { consentVersionId: activeId },
    });

    return { acceptedAt: new Date().toISOString(), consentVersionId: activeId };
  }

  async getMe(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        company: true,
        location: true,
        department: true,
        position: true,
        level: true,
        team: true,
        workArea: true,
        workSubArea: true,
        manager: true,
        userRoles: { include: { role: true } },
      },
    });

    const permissions = await this.loadPermissionKeys(userId);
    const { activeConsentVersionId, consentAccepted } = await this.consentState(userId);
    const passwordExpiresAt = await this.passwordExpiresAtIso(user);

    const managerPayload =
      user.manager &&
      (() => {
        const m = user.manager;
        return {
          id: m.id,
          sicil: this.encryption.decryptSicil(m.sicilEncrypted),
          firstName: m.firstName,
          lastName: m.lastName,
        };
      })();

    return {
      id: user.id,
      sicil: this.encryption.decryptSicil(user.sicilEncrypted),
      firstName: user.firstName,
      lastName: user.lastName,
      email: this.encryption.decryptEmail(user.emailEncrypted),
      phone:
        user.phoneEncrypted && user.phoneDek
          ? this.encryption.decryptPhone(user.phoneEncrypted, user.phoneDek)
          : null,
      employeeType: user.employeeType,
      company: { id: user.company.id, code: user.company.code, name: user.company.name },
      location: { id: user.location.id, code: user.location.code, name: user.location.name },
      department: {
        id: user.department.id,
        code: user.department.code,
        name: user.department.name,
      },
      position: { id: user.position.id, code: user.position.code, name: user.position.name },
      level: { id: user.level.id, code: user.level.code, name: user.level.name },
      team: user.team ? { id: user.team.id, code: user.team.code, name: user.team.name } : null,
      workArea: { id: user.workArea.id, code: user.workArea.code, name: user.workArea.name },
      workSubArea: user.workSubArea
        ? { id: user.workSubArea.id, code: user.workSubArea.code, name: user.workSubArea.name }
        : null,
      manager: managerPayload,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
        source: 'DIRECT' as const,
      })),
      permissions,
      activeConsentVersionId,
      consentAccepted,
      passwordExpiresAt,
    };
  }
}
