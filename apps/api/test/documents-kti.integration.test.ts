import { execSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import cookie from '@fastify/cookie';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { PrismaService } from '../src/prisma/prisma.service.js';

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
    DOCUMENTS_STORAGE_DRIVER: 'noop',
    S3_DOCUMENTS_BUCKET: 'vitest-placeholder',
    AWS_REGION: 'eu-central-1',
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

async function loginSuperadmin() {
  const srv = app.getHttpAdapter().getInstance();
  const login = await srv.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: 'superadmin@leanmgmt.local', password: 'AdminPass123!@#' }),
  });
  expect(login.statusCode).toBe(200);
  const body = JSON.parse(login.body) as { data: { accessToken: string; csrfToken: string } };
  const cookies = parseSetCookie(login.headers['set-cookie']);
  return {
    accessToken: body.data.accessToken,
    csrfToken: body.data.csrfToken,
    cookie: `refresh_token=${cookies.refresh_token ?? ''}; csrf_token=${cookies.csrf_token ?? ''}`,
  };
}

async function createCleanImageDoc(
  prisma: PrismaService,
  uploadedByUserId: string,
): Promise<string> {
  const id = randomUUID();
  await prisma.document.create({
    data: {
      id,
      uploadedByUserId,
      s3Key: `staging/${id}-x.jpg`,
      originalFilename: 'x.jpg',
      fileSizeBytes: 1024n,
      contentType: 'image/jpeg',
      scanStatus: 'CLEAN',
    },
  });
  return id;
}

describe('Documents + KTİ start (integration)', () => {
  it('POST /processes/kti/start — 201, süreç ve yönetici onay task’ı', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await loginSuperadmin();
    const prisma = app.get(PrismaService);
    const superUser = await prisma.user.findFirstOrThrow({
      where: { firstName: 'Super', lastName: 'Admin' },
    });
    const b1 = await createCleanImageDoc(prisma, superUser.id);
    const b2 = await createCleanImageDoc(prisma, superUser.id);
    const a1 = await createCleanImageDoc(prisma, superUser.id);
    const a2 = await createCleanImageDoc(prisma, superUser.id);

    const res = await srv.inject({
      method: 'POST',
      url: '/api/v1/processes/kti/start',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${auth.accessToken}`,
        'x-csrf-token': auth.csrfToken,
        cookie: auth.cookie,
      },
      payload: JSON.stringify({
        companyId: superUser.companyId,
        beforePhotoDocumentIds: [b1, b2],
        afterPhotoDocumentIds: [a1, a2],
        savingAmount: 5000,
        description: 'Entegrasyon testi KTİ başlatma açıklaması en az on karakter.',
      }),
    });
    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body) as {
      data: {
        displayId: string;
        firstTaskId: string;
        status: string;
        processType: string;
      };
    };
    expect(json.data.displayId).toMatch(/^KTI-\d{6}$/);
    expect(json.data.status).toBe('IN_PROGRESS');
    expect(json.data.processType).toBe('BEFORE_AFTER_KAIZEN');
    const tasks = await prisma.task.findMany({
      where: { process: { displayId: json.data.displayId } },
      orderBy: { stepOrder: 'asc' },
    });
    expect(tasks).toHaveLength(2);
    expect(tasks[0].status).toBe('COMPLETED');
    expect(tasks[1].status).toBe('PENDING');
    expect(tasks[1].id).toBe(json.data.firstTaskId);
  });

  it('POST /processes/kti/start — PENDING_SCAN dokümanda 409', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await loginSuperadmin();
    const prisma = app.get(PrismaService);
    const superUser = await prisma.user.findFirstOrThrow({
      where: { firstName: 'Super', lastName: 'Admin' },
    });
    const pendingId = randomUUID();
    await prisma.document.create({
      data: {
        id: pendingId,
        uploadedByUserId: superUser.id,
        s3Key: `staging/${pendingId}-p.jpg`,
        originalFilename: 'p.jpg',
        fileSizeBytes: 100n,
        contentType: 'image/jpeg',
        scanStatus: 'PENDING_SCAN',
      },
    });
    const b1 = await createCleanImageDoc(prisma, superUser.id);
    const b2 = await createCleanImageDoc(prisma, superUser.id);
    const a1 = await createCleanImageDoc(prisma, superUser.id);

    const res = await srv.inject({
      method: 'POST',
      url: '/api/v1/processes/kti/start',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${auth.accessToken}`,
        'x-csrf-token': auth.csrfToken,
        cookie: auth.cookie,
      },
      payload: JSON.stringify({
        companyId: superUser.companyId,
        beforePhotoDocumentIds: [pendingId, b1],
        afterPhotoDocumentIds: [a1, b2],
        savingAmount: 0,
        description: 'Bekleyen tarama dokümanı ile negatif test senaryosu açıklaması.',
      }),
    });
    expect(res.statusCode).toBe(409);
    const json = JSON.parse(res.body) as { error: { code: string } };
    expect(json.error.code).toBe('DOCUMENT_SCAN_PENDING');
  });

  it('POST /processes/kti/start — INFECTED dokümanda 403', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await loginSuperadmin();
    const prisma = app.get(PrismaService);
    const superUser = await prisma.user.findFirstOrThrow({
      where: { firstName: 'Super', lastName: 'Admin' },
    });
    const badId = randomUUID();
    await prisma.document.create({
      data: {
        id: badId,
        uploadedByUserId: superUser.id,
        s3Key: `staging/${badId}-bad.jpg`,
        originalFilename: 'bad.jpg',
        fileSizeBytes: 100n,
        contentType: 'image/jpeg',
        scanStatus: 'INFECTED',
        scanResultDetail: 'Test.Virus',
      },
    });
    const b1 = await createCleanImageDoc(prisma, superUser.id);
    const a1 = await createCleanImageDoc(prisma, superUser.id);
    const a2 = await createCleanImageDoc(prisma, superUser.id);

    const res = await srv.inject({
      method: 'POST',
      url: '/api/v1/processes/kti/start',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${auth.accessToken}`,
        'x-csrf-token': auth.csrfToken,
        cookie: auth.cookie,
      },
      payload: JSON.stringify({
        companyId: superUser.companyId,
        beforePhotoDocumentIds: [badId, b1],
        afterPhotoDocumentIds: [a1, a2],
        savingAmount: 0,
        description: 'Zararlı doküman ile negatif test senaryosu açıklama metni burada.',
      }),
    });
    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.body) as { error: { code: string } };
    expect(json.error.code).toBe('DOCUMENT_INFECTED');
  });

  it('POST /processes/kti/start — şirket uyuşmazlığı 400', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await loginSuperadmin();
    const prisma = app.get(PrismaService);
    const superUser = await prisma.user.findFirstOrThrow({
      where: { firstName: 'Super', lastName: 'Admin' },
    });
    const b1 = await createCleanImageDoc(prisma, superUser.id);
    const b2 = await createCleanImageDoc(prisma, superUser.id);
    const a1 = await createCleanImageDoc(prisma, superUser.id);
    const a2 = await createCleanImageDoc(prisma, superUser.id);
    const wrongCompany = await prisma.company.create({
      data: { code: `T${randomUUID().slice(0, 6)}`, name: 'Other Co' },
    });

    const res = await srv.inject({
      method: 'POST',
      url: '/api/v1/processes/kti/start',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${auth.accessToken}`,
        'x-csrf-token': auth.csrfToken,
        cookie: auth.cookie,
      },
      payload: JSON.stringify({
        companyId: wrongCompany.id,
        beforePhotoDocumentIds: [b1, b2],
        afterPhotoDocumentIds: [a1, a2],
        savingAmount: 0,
        description: 'Yanlış şirket kimliği ile doğrulama hatası beklenen test açıklaması.',
      }),
    });
    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_FAILED');
  });
});
