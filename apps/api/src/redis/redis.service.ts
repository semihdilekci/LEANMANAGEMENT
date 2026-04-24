import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { Env } from '../config/env.schema.js';

function redisEndpointForLog(redisUrl: string): string {
  try {
    const u = new URL(redisUrl);
    return `${u.hostname}:${u.port || '6379'}`;
  } catch {
    return '(geçersiz REDIS_URL)';
  }
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly raw: Redis;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {
    const redisUrl = this.config.get('REDIS_URL', { infer: true });
    this.raw = new Redis(redisUrl, {
      /** Komut başına yeniden deneme; Redis kapalıyken hızlı geri bildirim için sınırlı */
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times: number): number | null {
        if (times > 10) return null;
        return Math.min(times * 200, 2000);
      },
    });
  }

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.get('REDIS_URL', { infer: true });
    const endpoint = redisEndpointForLog(redisUrl);
    try {
      await this.raw.connect();
      const pong = await this.raw.ping();
      if (pong !== 'PONG') {
        throw new Error(`unexpected ping reply: ${pong}`);
      }
      this.logger.log({ event: 'redis_ready', endpoint });
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      this.logger.error({
        event: 'redis_connection_failed',
        endpoint,
        cause,
        hint: 'docker compose up -d redis (repo kökü)',
      });
      throw new Error(
        `Redis bağlantısı kurulamadı (${endpoint}). Yerelde: repo kökünde \`docker compose up -d redis\` çalıştırın; REDIS_URL değerini kontrol edin. (${cause})`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.raw.quit();
  }
}
