import { describe, it, expect, vi, beforeEach } from 'vitest';

import { UsersService } from './users.service.js';
import {
  UserSelfEditForbiddenException,
  UserNotFoundException,
  UserAlreadyPassiveException,
  UserAlreadyActiveException,
  UserAnonymizedException,
} from './users.exceptions.js';

const baseUserSelect = {
  id: 'u-1',
  isActive: true,
  anonymizedAt: null,
  companyId: 'c-1',
  locationId: 'l-1',
  departmentId: 'd-1',
  positionId: 'p-1',
  levelId: 'lv-1',
  teamId: null,
  workAreaId: 'wa-1',
  workSubAreaId: null,
  employeeType: 'WHITE_COLLAR' as const,
};

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

describe('UsersService — getUserRoles (DIRECT + ABAC)', () => {
  let service: UsersService;
  const evaluateRoleRule = vi.fn();
  const prismaMock = {
    user: { findUnique: vi.fn() },
    userRole: { findMany: vi.fn() },
    roleRule: { findMany: vi.fn() },
  };

  beforeEach(() => {
    evaluateRoleRule.mockReset();
    service = new UsersService(
      prismaMock as never,
      {} as never,
      { append: vi.fn() } as never,
      { invalidateUser: vi.fn() } as never,
      { evaluateRoleRule } as never,
      {} as never,
      { emit: vi.fn() } as never,
    );
  });

  it('USER_NOT_FOUND', async () => {
    (prismaMock.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(service.getUserRoles('x')).rejects.toBeInstanceOf(UserNotFoundException);
  });

  it('sadece DIRECT atamalar', async () => {
    (prismaMock.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(baseUserSelect);
    (prismaMock.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        assignedAt: new Date('2024-01-10T00:00:00.000Z'),
        assignedByUserId: 'actor-1',
        role: { id: 'r-1', code: 'R1', name: 'Bir' },
      },
    ]);
    (prismaMock.roleRule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const out = await service.getUserRoles('u-1');
    expect(out).toEqual([
      {
        id: 'r-1',
        code: 'R1',
        name: 'Bir',
        source: 'DIRECT',
        assignedAt: '2024-01-10T00:00:00.000Z',
        assignedByUserId: 'actor-1',
      },
    ]);
  });

  it('ABAC eşleşmesi — ilgili RoleRule yanıtlanır', async () => {
    (prismaMock.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(baseUserSelect);
    (prismaMock.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prismaMock.roleRule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'rr-99',
        roleId: 'r-abac',
        updatedAt: new Date('2024-06-01T12:00:00.000Z'),
        role: { id: 'r-abac', code: 'KTI', name: 'KTI' },
        conditionSets: [
          {
            conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'c-1' }],
          },
        ],
      },
    ]);
    evaluateRoleRule.mockReturnValue(true);

    const out = await service.getUserRoles('u-1');
    expect(out[0]!.source).toBe('ATTRIBUTE_RULE');
    expect(out[0]).toMatchObject({
      id: 'r-abac',
      matchedRuleId: 'rr-99',
      assignedByUserId: null,
    });
  });
});
