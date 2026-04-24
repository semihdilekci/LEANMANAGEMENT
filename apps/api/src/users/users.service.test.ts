import { describe, it, expect, vi, beforeEach } from 'vitest';

import { UsersService } from './users.service.js';
import {
  UserSelfEditForbiddenException,
  UserNotFoundException,
  UserAlreadyPassiveException,
  UserAlreadyActiveException,
  UserAnonymizedException,
} from './users.exceptions.js';

function makeActor(id = 'actor-1') {
  return { id, sessionId: 'sess-1', jti: 'jti-1' };
}

describe('UsersService — manager cycle detection', () => {
  let service: UsersService;
  let prismaFindUniqueMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prismaFindUniqueMock = vi.fn();
    service = new UsersService(
      { user: { findUnique: prismaFindUniqueMock } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: vi.fn() } as never,
    );
  });

  it('cycle yok — farklı bir chain', async () => {
    // A → B → C (no cycle back to A)
    prismaFindUniqueMock.mockImplementation(({ where }: { where: { id: string } }) => {
      const chain: Record<string, string | null> = { B: 'C', C: null };
      return Promise.resolve({ managerUserId: chain[where.id] ?? null });
    });

    const hasCycle = await (
      service as unknown as { detectManagerCycle: (u: string, m: string) => Promise<boolean> }
    ).detectManagerCycle('A', 'B');
    expect(hasCycle).toBe(false);
  });

  it('A→B→C→A döngüsünü yakalar', async () => {
    // B's manager is C, C's manager is A — creates cycle when setting A's manager to B
    prismaFindUniqueMock.mockImplementation(({ where }: { where: { id: string } }) => {
      const chain: Record<string, string | null> = { B: 'C', C: 'A', A: null };
      return Promise.resolve({ managerUserId: chain[where.id] ?? null });
    });

    const hasCycle = await (
      service as unknown as { detectManagerCycle: (u: string, m: string) => Promise<boolean> }
    ).detectManagerCycle('A', 'B');
    expect(hasCycle).toBe(true);
  });

  it('direct self-reference döngüsünü yakalar', async () => {
    // Setting A's manager to A
    prismaFindUniqueMock.mockImplementation(() => Promise.resolve({ managerUserId: null }));

    const hasCycle = await (
      service as unknown as { detectManagerCycle: (u: string, m: string) => Promise<boolean> }
    ).detectManagerCycle('A', 'A');
    expect(hasCycle).toBe(true);
  });

  it('kırık zincir — node bulunamaz', async () => {
    prismaFindUniqueMock.mockImplementation(() => Promise.resolve(null));

    const hasCycle = await (
      service as unknown as { detectManagerCycle: (u: string, m: string) => Promise<boolean> }
    ).detectManagerCycle('A', 'B');
    expect(hasCycle).toBe(false);
  });
});

describe('UsersService — deactivate validation', () => {
  let service: UsersService;
  let prismaMock: Record<string, unknown>;

  beforeEach(() => {
    prismaMock = {
      user: { findUnique: vi.fn() },
      session: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      $transaction: vi
        .fn()
        .mockImplementation(async (fn: (tx: unknown) => Promise<void>) => fn(prismaMock)),
    };

    service = new UsersService(
      prismaMock as never,
      {} as never,
      { append: vi.fn() } as never,
      { invalidateUser: vi.fn() } as never,
      {} as never,
      { emit: vi.fn() } as never,
    );
  });

  it('USER_NOT_FOUND — kullanıcı yoksa', async () => {
    (prismaMock.user as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
      null,
    );
    await expect(service.deactivate('X', { reason: 'test' }, makeActor())).rejects.toBeInstanceOf(
      UserNotFoundException,
    );
  });

  it('USER_SELF_EDIT_FORBIDDEN — aktör kendi hesabını deaktive edemez', async () => {
    (prismaMock.user as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue({
      id: 'actor-1',
      isActive: true,
    });
    await expect(
      service.deactivate('actor-1', { reason: 'test' }, makeActor('actor-1')),
    ).rejects.toBeInstanceOf(UserSelfEditForbiddenException);
  });

  it('USER_ALREADY_PASSIVE — zaten pasif kullanıcı', async () => {
    (prismaMock.user as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue({
      id: 'user-2',
      isActive: false,
    });
    await expect(
      service.deactivate('user-2', { reason: 'test' }, makeActor()),
    ).rejects.toBeInstanceOf(UserAlreadyPassiveException);
  });
});

describe('UsersService — reactivate validation', () => {
  let service: UsersService;
  let prismaMock: Record<string, unknown>;

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    service = new UsersService(
      prismaMock as never,
      {} as never,
      { append: vi.fn() } as never,
      { invalidateUser: vi.fn() } as never,
      {} as never,
      { emit: vi.fn() } as never,
    );
  });

  it('USER_NOT_FOUND — kullanıcı yoksa', async () => {
    (prismaMock.user as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
      null,
    );
    await expect(service.reactivate('X', { reason: 'test' }, makeActor())).rejects.toBeInstanceOf(
      UserNotFoundException,
    );
  });

  it('USER_ANONYMIZED — anonimleştirilmiş reaktive edilemez', async () => {
    (prismaMock.user as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue({
      id: 'user-2',
      isActive: false,
      anonymizedAt: new Date(),
    });
    await expect(
      service.reactivate('user-2', { reason: 'test' }, makeActor()),
    ).rejects.toBeInstanceOf(UserAnonymizedException);
  });

  it('USER_ALREADY_ACTIVE — zaten aktif', async () => {
    (prismaMock.user as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue({
      id: 'user-2',
      isActive: true,
      anonymizedAt: null,
    });
    await expect(
      service.reactivate('user-2', { reason: 'test' }, makeActor()),
    ).rejects.toBeInstanceOf(UserAlreadyActiveException);
  });
});
