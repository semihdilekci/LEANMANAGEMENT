import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AttributeRuleEvaluatorService } from './attribute-rule-evaluator.service.js';
import { PermissionResolverService } from './permission-resolver.service.js';

function makeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    raw: {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      set: vi.fn(async (k: string, v: string, _mode: string, ttl: number) => {
        store.set(k, v);
        return ttl;
      }),
      del: vi.fn(async (k: string) => {
        store.delete(k);
        return 1;
      }),
      pipeline: vi.fn(() => {
        const cmds: { key: string }[] = [];
        return {
          del: (key: string) => {
            cmds.push({ key });
            return { del: () => {} };
          },
          exec: vi.fn(async () => {
            for (const { key } of cmds) {
              store.delete(key);
            }
            return [];
          }),
        };
      }),
    },
  };
}

describe('PermissionResolverService', () => {
  let redis: ReturnType<typeof makeRedis>;
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    role: { findMany: ReturnType<typeof vi.fn> };
    rolePermission: { findMany: ReturnType<typeof vi.fn> };
    roleRule: { findMany: ReturnType<typeof vi.fn> };
    userRole: { findMany: ReturnType<typeof vi.fn> };
  };
  let evaluator: AttributeRuleEvaluatorService;
  let resolver: PermissionResolverService;

  beforeEach(() => {
    redis = makeRedis();
    prisma = {
      user: { findUnique: vi.fn(), findMany: vi.fn() },
      role: { findMany: vi.fn() },
      rolePermission: { findMany: vi.fn() },
      roleRule: { findMany: vi.fn() },
      userRole: { findMany: vi.fn() },
    };
    evaluator = new AttributeRuleEvaluatorService();
    resolver = new PermissionResolverService(
      prisma as never,
      { raw: redis.raw } as never,
      evaluator,
    );
  });

  it('cache hit: Prisma çağrılmaz', async () => {
    redis.store.set('user_permissions:u1', JSON.stringify(['USER_LIST_VIEW']));
    prisma.user.findUnique.mockResolvedValue(null);

    const perms = await resolver.getUserPermissions('u1');

    expect(perms).toEqual(new Set(['USER_LIST_VIEW']));
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('kullanıcı yoksa boş set ve cache yazar', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const perms = await resolver.getUserPermissions('missing');

    expect(perms.size).toBe(0);
    expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
    expect(redis.raw.set).toHaveBeenCalledWith(
      'user_permissions:missing',
      JSON.stringify([]),
      'EX',
      300,
    );
  });

  it('RBAC: doğrudan rollerden permission birleşimi', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: true,
      anonymizedAt: null,
      companyId: 'c1',
      locationId: 'l1',
      departmentId: 'd1',
      positionId: 'p1',
      levelId: 'lv1',
      teamId: null,
      workAreaId: 'wa1',
      workSubAreaId: null,
      employeeType: 'WHITE_COLLAR',
    });
    prisma.roleRule.findMany.mockResolvedValue([]);
    prisma.rolePermission.findMany.mockResolvedValue([
      { permissionKey: 'USER_LIST_VIEW' },
      { permissionKey: 'USER_CREATE' },
    ]);

    const perms = await resolver.getUserPermissions('u1');

    expect(perms).toEqual(new Set(['USER_LIST_VIEW', 'USER_CREATE']));
    expect(prisma.rolePermission.findMany).toHaveBeenCalledTimes(1);
  });

  it('listAbacDerivedRolesForUser: doğrudan rol yokken kuraldan gelen rol döner', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: true,
      anonymizedAt: null,
      companyId: 'acme',
      locationId: 'l1',
      departmentId: 'd1',
      positionId: 'p1',
      levelId: 'lv1',
      teamId: null,
      workAreaId: 'wa1',
      workSubAreaId: null,
      employeeType: 'WHITE_COLLAR',
    });
    prisma.userRole.findMany.mockResolvedValue([]);
    prisma.roleRule.findMany.mockResolvedValue([
      {
        roleId: 'role-abac',
        conditionSets: [
          {
            conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'acme' }],
          },
        ],
      },
    ]);
    prisma.role.findMany.mockResolvedValue([{ id: 'role-abac', code: 'GENEL', name: 'Genel Rol' }]);

    const rows = await resolver.listAbacDerivedRolesForUser('u1');

    expect(rows).toEqual([{ id: 'role-abac', code: 'GENEL', name: 'Genel Rol', source: 'ABAC' }]);
    expect(prisma.role.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['role-abac'] }, isActive: true },
      select: { id: true, code: true, name: true },
    });
  });

  it('RBAC + ABAC: izinler birleşir', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: true,
      anonymizedAt: null,
      companyId: 'acme',
      locationId: 'l1',
      departmentId: 'd1',
      positionId: 'p1',
      levelId: 'lv1',
      teamId: null,
      workAreaId: 'wa1',
      workSubAreaId: null,
      employeeType: 'WHITE_COLLAR',
    });
    prisma.roleRule.findMany.mockResolvedValue([
      {
        roleId: 'role-abac',
        conditionSets: [
          {
            conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'acme' }],
          },
        ],
      },
    ]);
    prisma.rolePermission.findMany
      .mockResolvedValueOnce([{ permissionKey: 'USER_LIST_VIEW' }])
      .mockResolvedValueOnce([{ permissionKey: 'ROLE_VIEW' }, { permissionKey: 'ROLE_CREATE' }]);

    const perms = await resolver.getUserPermissions('u1');

    expect(perms).toEqual(new Set(['USER_LIST_VIEW', 'ROLE_VIEW', 'ROLE_CREATE']));
  });

  it('hasPermission doğru delegasyon', async () => {
    redis.store.set('user_permissions:u1', JSON.stringify(['MASTER_DATA_VIEW']));
    const ok = await resolver.hasPermission('u1', 'MASTER_DATA_VIEW');
    expect(ok).toBe(true);
    expect(await resolver.hasPermission('u1', 'ROLE_DELETE')).toBe(false);
  });

  it('invalidateUser cache anahtarını siler', async () => {
    redis.store.set('user_permissions:u1', '[]');
    await resolver.invalidateUser('u1');
    expect(redis.raw.del).toHaveBeenCalledWith('user_permissions:u1');
    expect(redis.store.has('user_permissions:u1')).toBe(false);
  });

  it('invalidateRole doğrudan atanan kullanıcılar için pipeline del çalıştırır', async () => {
    const delMock = vi.fn().mockReturnThis();
    const execMock = vi.fn().mockResolvedValue([]);
    redis.raw.pipeline = vi.fn(() => ({ del: delMock, exec: execMock }));
    prisma.userRole.findMany.mockResolvedValue([{ userId: 'a' }, { userId: 'b' }]);
    prisma.roleRule.findMany.mockResolvedValue([]);

    await resolver.invalidateRole('role-1');

    expect(prisma.userRole.findMany).toHaveBeenCalledWith({
      where: { roleId: 'role-1' },
      select: { userId: true },
    });
    expect(delMock).toHaveBeenCalledWith('user_permissions:a');
    expect(delMock).toHaveBeenCalledWith('user_permissions:b');
    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it('invalidateRole kural eşleşen kullanıcıyı da temizler (ABAC)', async () => {
    const delMock = vi.fn().mockReturnThis();
    const execMock = vi.fn().mockResolvedValue([]);
    redis.raw.pipeline = vi.fn(() => ({ del: delMock, exec: execMock }));
    prisma.userRole.findMany.mockResolvedValue([]);
    prisma.roleRule.findMany.mockResolvedValue([
      {
        roleId: 'role-abac',
        conditionSets: [
          {
            conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS' as const, value: 'c1' }],
          },
        ],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u-x',
        isActive: true,
        anonymizedAt: null,
        companyId: 'c1',
        locationId: 'l1',
        departmentId: 'd1',
        positionId: 'p1',
        levelId: 'lv1',
        teamId: null,
        workAreaId: 'wa1',
        workSubAreaId: null,
        employeeType: 'WHITE_COLLAR',
      },
    ]);

    await resolver.invalidateRole('role-abac');

    expect(delMock).toHaveBeenCalledWith('user_permissions:u-x');
  });
});
