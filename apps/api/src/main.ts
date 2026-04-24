import cookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.1,
    });
  }

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  // Nest FastifyAdapter ile @fastify/cookie FastifyInstance tipleri farklı paket köklerinden geliyor — çalışma zamanı uyumludur
  await app.register(cookie as unknown as Parameters<NestFastifyApplication['register']>[0], {
    secret: process.env.COOKIE_SIGNING_SECRET ?? 'dev-cookie-signing-secret-min-32-chars___',
  });
  app.setGlobalPrefix('api/v1');
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
