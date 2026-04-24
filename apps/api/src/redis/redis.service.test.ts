import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.schema.js';

import { RedisService } from './redis.service.js';

const { connectMock, pingMock, quitMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  pingMock: vi.fn(),
  quitMock: vi.fn(),
}));

vi.mock('ioredis', () => ({
  default: class MockRedis {
    connect = connectMock;
    ping = pingMock;
    quit = quitMock;
  },
}));

describe('RedisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectMock.mockResolvedValue(undefined);
    pingMock.mockResolvedValue('PONG');
    quitMock.mockResolvedValue('OK');
  });

  async function createService(): Promise<RedisService> {
    const mockConfig = {
      get: vi.fn(<K extends keyof Env>(key: K) => {
        if (key === 'REDIS_URL') return 'redis://127.0.0.1:6379' as Env[K];
        throw new Error(`unexpected key ${String(key)}`);
      }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [RedisService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();
    return moduleRef.get(RedisService);
  }

  it('onModuleInit Redis ping başarılı olunca tamamlanır', async () => {
    const svc = await createService();
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(pingMock).toHaveBeenCalledTimes(1);
  });

  it('onModuleInit ping PONG değilse hata fırlatır', async () => {
    pingMock.mockResolvedValueOnce('ERR');
    const svc = await createService();
    await expect(svc.onModuleInit()).rejects.toThrow(/Redis bağlantısı kurulamadı/);
  });
});
