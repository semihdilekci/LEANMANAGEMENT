import { describe, expect, it } from 'vitest';

import { EnvSchema, OIDC_GOOGLE_CALLBACK_PATHNAME, validateEnv } from './env.schema.js';

const PII_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const PII_PEPPER = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const JWT = 'dev-only-jwt-secret-min-32-characters-long!!';

function baseEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    NODE_ENV: 'test',
    API_PORT: 3001,
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/leanmgmt_test?schema=public',
    REDIS_URL: 'redis://127.0.0.1:6379',
    APP_PII_ENCRYPTION_KEY: PII_KEY,
    APP_PII_PEPPER: PII_PEPPER,
    JWT_ACCESS_SECRET_CURRENT: JWT,
    DOCUMENTS_STORAGE_DRIVER: 'noop',
    ...overrides,
  };
}

describe('validateEnv OIDC', () => {
  it('OIDC kapalıyken eksik OIDC alanları ile başarılı', () => {
    const env = validateEnv(baseEnv({ OIDC_ENABLED: false }));
    expect(env.OIDC_ENABLED).toBe(false);
  });

  it('OIDC_ENABLED=true iken OIDC_ISSUER yoksa hata', () => {
    const parsed = EnvSchema.safeParse(
      baseEnv({
        OIDC_ENABLED: true,
        OIDC_CLIENT_ID: 'client',
        OIDC_CLIENT_SECRET: 'secret',
        OIDC_REDIRECT_URI: `http://127.0.0.1:3001${OIDC_GOOGLE_CALLBACK_PATHNAME}`,
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it('OIDC_ENABLED=true iken redirect pathname yanlışsa hata', () => {
    const parsed = EnvSchema.safeParse(
      baseEnv({
        OIDC_ENABLED: true,
        OIDC_ISSUER: 'https://accounts.google.com',
        OIDC_CLIENT_ID: 'id',
        OIDC_CLIENT_SECRET: 'secret',
        OIDC_REDIRECT_URI: 'http://127.0.0.1:3001/api/v1/auth/oauth/wrong/callback',
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it('Google issuer + test ortamında secret yoksa hata', () => {
    const parsed = EnvSchema.safeParse(
      baseEnv({
        NODE_ENV: 'test',
        OIDC_ENABLED: true,
        OIDC_ISSUER: 'https://accounts.google.com',
        OIDC_CLIENT_ID: 'id',
        OIDC_REDIRECT_URI: `http://127.0.0.1:3001${OIDC_GOOGLE_CALLBACK_PATHNAME}`,
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it('Google issuer + production ortamında secret olmadan geçerli minimal set', () => {
    const env = validateEnv(
      baseEnv({
        NODE_ENV: 'production',
        OIDC_ENABLED: true,
        OIDC_ISSUER: 'https://accounts.google.com',
        OIDC_CLIENT_ID: 'id',
        OIDC_REDIRECT_URI: `https://api.example.com${OIDC_GOOGLE_CALLBACK_PATHNAME}`,
      }),
    );
    expect(env.OIDC_ENABLED).toBe(true);
    expect(env.OIDC_CLIENT_SECRET).toBeUndefined();
  });

  it('Keycloak issuer ile secret olmadan geçerli', () => {
    const env = validateEnv(
      baseEnv({
        NODE_ENV: 'staging',
        OIDC_ENABLED: true,
        OIDC_ISSUER: 'https://sso.holding.example/realms/leanmgmt',
        OIDC_CLIENT_ID: 'leanmgmt-web',
        OIDC_REDIRECT_URI: `https://app.staging.example${OIDC_GOOGLE_CALLBACK_PATHNAME}`,
      }),
    );
    expect(env.OIDC_ENABLED).toBe(true);
    expect(env.OIDC_CLIENT_SECRET).toBeUndefined();
  });

  it('Google issuer + staging ortamında secret yoksa hata', () => {
    const parsed = EnvSchema.safeParse(
      baseEnv({
        NODE_ENV: 'staging',
        OIDC_ENABLED: true,
        OIDC_ISSUER: 'https://accounts.google.com',
        OIDC_CLIENT_ID: 'id',
        OIDC_REDIRECT_URI: `https://app.staging.example${OIDC_GOOGLE_CALLBACK_PATHNAME}`,
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it('Google issuer + development + tam geçerli OIDC seti', () => {
    const env = validateEnv(
      baseEnv({
        NODE_ENV: 'development',
        OIDC_ENABLED: true,
        OIDC_ISSUER: 'https://accounts.google.com',
        OIDC_CLIENT_ID: 'google-client-id',
        OIDC_CLIENT_SECRET: 'google-client-secret',
        OIDC_REDIRECT_URI: `http://127.0.0.1:3001${OIDC_GOOGLE_CALLBACK_PATHNAME}`,
      }),
    );
    expect(env.OIDC_SCOPES).toBe('openid email profile');
    expect(env.OIDC_CLIENT_SECRET).toBe('google-client-secret');
  });

  it('WEB_PUBLIC_ORIGIN geçerli URL ile OIDC açıkken parse edilir', () => {
    const env = validateEnv(
      baseEnv({
        NODE_ENV: 'development',
        OIDC_ENABLED: true,
        OIDC_ISSUER: 'https://accounts.google.com',
        OIDC_CLIENT_ID: 'google-client-id',
        OIDC_CLIENT_SECRET: 'google-client-secret',
        OIDC_REDIRECT_URI: `http://localhost:3000${OIDC_GOOGLE_CALLBACK_PATHNAME}`,
        WEB_PUBLIC_ORIGIN: 'http://localhost:3000',
      }),
    );
    expect(env.WEB_PUBLIC_ORIGIN).toBe('http://localhost:3000');
  });

  it('WEB_PUBLIC_ORIGIN ile OIDC_REDIRECT_URI origin farklıysa hata', () => {
    const parsed = EnvSchema.safeParse(
      baseEnv({
        NODE_ENV: 'development',
        OIDC_ENABLED: true,
        OIDC_ISSUER: 'https://accounts.google.com',
        OIDC_CLIENT_ID: 'google-client-id',
        OIDC_CLIENT_SECRET: 'google-client-secret',
        OIDC_REDIRECT_URI: `http://127.0.0.1:3001${OIDC_GOOGLE_CALLBACK_PATHNAME}`,
        WEB_PUBLIC_ORIGIN: 'http://localhost:3000',
      }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(JSON.stringify(parsed.error.flatten().fieldErrors)).toContain('OIDC_REDIRECT_URI');
    }
  });
});
