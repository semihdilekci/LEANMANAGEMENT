import { execSync } from 'node:child_process';
import path from 'node:path';

import cookie from '@fastify/cookie';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { PermissionResolverService } from '../src/roles/permission-resolver.service.js';
import { RedisService } from '../src/redis/redis.service.js';

const PII_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const PII_PEPPER = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const JWT_SECRET = 'dev-only-jwt-secret-min-32-characters-long!!';

function parseSetCookie(setCookie: string | string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const line of lines) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1).trim();
    out[name] = val;
  }
  return out;
}

let pg: StartedPostgreSqlContainer;
let redis: StartedTestContainer;
let app: NestFastifyApplication;
const apiDir = path.join(__dirname, '..');

beforeAll(async () => {
  pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  redis = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
  const databaseUrl = pg.getConnectionUri();
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    APP_PII_ENCRYPTION_KEY: PII_KEY,
    APP_PII_PEPPER: PII_PEPPER,
    JWT_ACCESS_SECRET_CURRENT: JWT_SECRET,
    AUTH_EXPOSE_RESET_TOKEN: 'false',
  };
  execSync('pnpm exec prisma migrate deploy', { cwd: apiDir, stdio: 'inherit', env });
  execSync('pnpm exec prisma db seed', { cwd: apiDir, stdio: 'inherit', env });
  Object.assign(process.env, env);
  const { AppModule } = await import('../src/app.module.js');
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(cookie as unknown as Parameters<NestFastifyApplication['register']>[0], {
    secret: 'test-cookie-signing-secret-min-32-chars___',
  });
  app.setGlobalPrefix('api/v1');
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
}, 180_000);

afterAll(async () => {
  if (app) await app.close();
  if (pg) await pg.stop();
  if (redis) await redis.stop();
});

describe('4-katman + cache invalidation (integration)', () => {
  it('Layer1_JWT: Bearer yok — 401', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const res = await srv.inject({ method: 'GET', url: '/api/v1/users', headers: {} });
    expect(res.statusCode).toBe(401);
  });

  it('Layer2_PermissionGuard: USER_LIST_VIEW yok — 403', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const login = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'integration_process@leanmgmt.local',
        password: 'OnlyProc123!@#',
      }),
    });
    expect(login.statusCode).toBe(200);
    const { data } = JSON.parse(login.body) as { data: { accessToken: string } };
    const list = await srv.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${data.accessToken}` },
    });
    expect(list.statusCode).toBe(403);
  });

  it('Layer2_ok: superadmin listeler', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const login = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'superadmin@leanmgmt.local', password: 'AdminPass123!@#' }),
    });
    const { data } = JSON.parse(login.body) as { data: { accessToken: string } };
    const list = await srv.inject({
      method: 'GET',
      url: '/api/v1/users?limit=5',
      headers: { authorization: `Bearer ${data.accessToken}` },
    });
    expect(list.statusCode).toBe(200);
  });

  it('Layer3_ownership: USER_LIST_VIEW yok — yabancı detay 404', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const su = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'superadmin@leanmgmt.local', password: 'AdminPass123!@#' }),
    });
    const suId = (JSON.parse(su.body) as { data: { user: { id: string } } }).data.user.id;
    const proc = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'integration_process@leanmgmt.local',
        password: 'OnlyProc123!@#',
      }),
    });
    const procTok = (JSON.parse(proc.body) as { data: { accessToken: string } }).data.accessToken;
    const detail = await srv.inject({
      method: 'GET',
      url: `/api/v1/users/${suId}`,
      headers: { authorization: `Bearer ${procTok}` },
    });
    expect(detail.statusCode).toBe(404);
  });

  it('Layer4_field: liste satırında location yok, detayda var', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const su = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'superadmin@leanmgmt.local', password: 'AdminPass123!@#' }),
    });
    const token = (JSON.parse(su.body) as { data: { accessToken: string } }).data.accessToken;
    const list = await srv.inject({
      method: 'GET',
      url: '/api/v1/users?limit=20',
      headers: { authorization: `Bearer ${token}` },
    });
    const listJson = JSON.parse(list.body) as { data: { items: { id: string }[] } };
    const anyRow = listJson.data.items[0];
    expect(anyRow).toBeDefined();
    const rowBody = anyRow as unknown as Record<string, unknown>;
    expect('location' in rowBody).toBe(false);
    const detail = await srv.inject({
      method: 'GET',
      url: `/api/v1/users/${anyRow.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const detailJson = JSON.parse(detail.body) as { data: { location?: { id: string } } };
    expect(detailJson.data.location).toBeDefined();
  });

  it('Rol yetki değişimi: Redis user_permissions temizlenir', async () => {
    const prisma = app.get(PrismaService);
    const onlyProc = await prisma.user.findFirst({
      where: { firstName: 'Proc', lastName: 'Only' },
    });
    expect(onlyProc).toBeTruthy();
    const onlyProcId = onlyProc!.id;
    const procRole = await prisma.role.findFirstOrThrow({ where: { code: 'PROCESS_MANAGER' } });
    const keys = await prisma.rolePermission.findMany({
      where: { roleId: procRole.id },
      select: { permissionKey: true },
    });
    const permissionKeys = keys.map((k) => k.permissionKey);

    const srv = app.getHttpAdapter().getInstance();
    const loginP = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'integration_process@leanmgmt.local',
        password: 'OnlyProc123!@#',
      }),
    });
    const tokP = (JSON.parse(loginP.body) as { data: { accessToken: string } }).data;
    await srv.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${tokP.accessToken}` },
    });
    const redisKey = `user_permissions:${onlyProcId}`;
    const r0 = app.get(RedisService).raw;
    if (!(await r0.get(redisKey))) {
      const res = app.get(PermissionResolverService);
      await res.getUserPermissions(onlyProcId);
    }
    expect(await r0.get(redisKey)).toBeTruthy();

    const loginS = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'superadmin@leanmgmt.local', password: 'AdminPass123!@#' }),
    });
    const b = JSON.parse(loginS.body) as { data: { accessToken: string; csrfToken: string } };
    const cookies = parseSetCookie(loginS.headers['set-cookie']);
    const put = await srv.inject({
      method: 'PUT',
      url: `/api/v1/roles/${procRole.id}/permissions`,
      headers: {
        authorization: `Bearer ${b.data.accessToken}`,
        'x-csrf-token': b.data.csrfToken,
        'content-type': 'application/json',
        cookie: `refresh_token=${cookies.refresh_token ?? ''}; csrf_token=${cookies.csrf_token ?? ''}`,
      },
      payload: JSON.stringify({ permissionKeys }),
    });
    expect(put.statusCode).toBe(200);
    expect(await r0.get(redisKey)).toBeNull();
  });

  it('Rol kuralı ekleme: Redis user_permissions temizlenir', async () => {
    const prisma = app.get(PrismaService);
    const onlyProc = await prisma.user.findFirst({
      where: { firstName: 'Proc', lastName: 'Only' },
    });
    expect(onlyProc).toBeTruthy();
    const onlyProcId = onlyProc!.id;
    const companyId = onlyProc!.companyId;
    expect(companyId).toBeTruthy();
    const procRole = await prisma.role.findFirstOrThrow({ where: { code: 'PROCESS_MANAGER' } });

    const srv = app.getHttpAdapter().getInstance();
    const loginP = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'integration_process@leanmgmt.local',
        password: 'OnlyProc123!@#',
      }),
    });
    const tokP = (JSON.parse(loginP.body) as { data: { accessToken: string } }).data;
    await srv.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${tokP.accessToken}` },
    });
    const redisKey = `user_permissions:${onlyProcId}`;
    const r0 = app.get(RedisService).raw;
    if (!(await r0.get(redisKey))) {
      const res = app.get(PermissionResolverService);
      await res.getUserPermissions(onlyProcId);
    }
    expect(await r0.get(redisKey)).toBeTruthy();

    const loginS = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'superadmin@leanmgmt.local', password: 'AdminPass123!@#' }),
    });
    const b = JSON.parse(loginS.body) as { data: { accessToken: string; csrfToken: string } };
    const cookies = parseSetCookie(loginS.headers['set-cookie']);
    const post = await srv.inject({
      method: 'POST',
      url: `/api/v1/roles/${procRole.id}/rules`,
      headers: {
        authorization: `Bearer ${b.data.accessToken}`,
        'x-csrf-token': b.data.csrfToken,
        'content-type': 'application/json',
        cookie: `refresh_token=${cookies.refresh_token ?? ''}; csrf_token=${cookies.csrf_token ?? ''}`,
      },
      payload: JSON.stringify({
        conditionSets: [
          {
            conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: companyId! }],
          },
        ],
      }),
    });
    expect(post.statusCode).toBe(201);
    expect(await r0.get(redisKey)).toBeNull();
  });

  it('MasterData_list: PROCESS_KTI_START yokken companies listesi — 403', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const loginP = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'integration_process@leanmgmt.local',
        password: 'OnlyProc123!@#',
      }),
    });
    expect(loginP.statusCode).toBe(200);
    const tokP = (JSON.parse(loginP.body) as { data: { accessToken: string } }).data.accessToken;
    const list = await srv.inject({
      method: 'GET',
      url: '/api/v1/master-data/companies?isActive=true',
      headers: { authorization: `Bearer ${tokP}` },
    });
    expect(list.statusCode).toBe(403);
  });

  it('MasterData_list: PROCESS_KTI_START ile companies — yalnız kendi şirketi', async () => {
    const prisma = app.get(PrismaService);
    const onlyProc = await prisma.user.findFirstOrThrow({
      where: { firstName: 'Proc', lastName: 'Only' },
    });
    const procRole = await prisma.role.findFirstOrThrow({ where: { code: 'PROCESS_MANAGER' } });
    const superUser = await prisma.user.findFirstOrThrow({
      where: { firstName: 'Super', lastName: 'Admin' },
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionKey: { roleId: procRole.id, permissionKey: 'PROCESS_KTI_START' },
      },
      create: {
        roleId: procRole.id,
        permissionKey: 'PROCESS_KTI_START',
        grantedByUserId: superUser.id,
      },
      update: {},
    });
    const r0 = app.get(RedisService).raw;
    await r0.del(`user_permissions:${onlyProc.id}`);

    const srv = app.getHttpAdapter().getInstance();
    const loginP = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'integration_process@leanmgmt.local',
        password: 'OnlyProc123!@#',
      }),
    });
    expect(loginP.statusCode).toBe(200);
    const tokP = (JSON.parse(loginP.body) as { data: { accessToken: string } }).data.accessToken;
    const list = await srv.inject({
      method: 'GET',
      url: '/api/v1/master-data/companies?isActive=true',
      headers: { authorization: `Bearer ${tokP}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as { data: Array<{ id: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(onlyProc.companyId);
  });

  it('MasterData_list: PROCESS_KTI_START ile lokasyon listesi — 403', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const loginP = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'integration_process@leanmgmt.local',
        password: 'OnlyProc123!@#',
      }),
    });
    expect(loginP.statusCode).toBe(200);
    const tokP = (JSON.parse(loginP.body) as { data: { accessToken: string } }).data.accessToken;
    const list = await srv.inject({
      method: 'GET',
      url: '/api/v1/master-data/locations?isActive=true',
      headers: { authorization: `Bearer ${tokP}` },
    });
    expect(list.statusCode).toBe(403);
  });
});
