import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

import {
  AttributeRuleEvaluatorService,
  type AbacRoleRuleInput,
  type AbacUserSnapshot,
} from './attribute-rule-evaluator.service.js';

const CACHE_TTL_SEC = 300;

/**
 * RBAC (user_roles) + ABAC (role_rules) birleşik yetki kümesi.
 * Redis 5 dk TTL. invalidateRole: doğrudan atamalar + ABAC ile eşleşen kullanıcılar
 */
@Injectable()
export class PermissionResolverService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(AttributeRuleEvaluatorService)
    private readonly attributeRuleEvaluator: AttributeRuleEvaluatorService,
  ) {}

  async getUserPermissions(userId: string): Promise<Set<string>> {
    const cacheKey = this.cacheKey(userId);
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      return new Set<string>(JSON.parse(cached) as string[]);
    }

    const permissions = await this.resolveFromDb(userId);
    await this.redis.raw.set(cacheKey, JSON.stringify([...permissions]), 'EX', CACHE_TTL_SEC);
    return permissions;
  }

  /**
   * Yalnızca attribute kuralı ile eşleşen roller (`user_roles` satırı olmadan).
   * `GET /auth/me` içindeki `roles` alanında doğrudan atamalarla birleştirmek için.
   */
  async listAbacDerivedRolesForUser(
    userId: string,
  ): Promise<Array<{ id: string; code: string; name: string; source: 'ABAC' }>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        anonymizedAt: true,
        companyId: true,
        locationId: true,
        departmentId: true,
        positionId: true,
        levelId: true,
        teamId: true,
        workAreaId: true,
        workSubAreaId: true,
        employeeType: true,
      },
    });
    if (!user) return [];

    const directRows = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    const directSet = new Set(directRows.map((r) => r.roleId));

    const abacInputs = await this.loadActiveAbacRules();
    const matchedRoleIds = this.attributeRuleEvaluator.matchingRoleIds(
      this.toSnapshot(user),
      abacInputs,
    );
    const abacOnlyIds = matchedRoleIds.filter((id) => !directSet.has(id));
    if (abacOnlyIds.length === 0) return [];

    const roles = await this.prisma.role.findMany({
      where: { id: { in: abacOnlyIds }, isActive: true },
      select: { id: true, code: true, name: true },
    });
    return roles.map((r) => ({ id: r.id, code: r.code, name: r.name, source: 'ABAC' as const }));
  }

  private cacheKey(userId: string): string {
    return `user_permissions:${userId}`;
  }

  private toSnapshot(user: {
    isActive: boolean;
    anonymizedAt: Date | null;
    companyId: string;
    locationId: string;
    departmentId: string;
    positionId: string;
    levelId: string;
    teamId: string | null;
    workAreaId: string;
    workSubAreaId: string | null;
    employeeType: AbacUserSnapshot['employeeType'];
  }): AbacUserSnapshot {
    return {
      isActive: user.isActive,
      anonymizedAt: user.anonymizedAt,
      companyId: user.companyId,
      locationId: user.locationId,
      departmentId: user.departmentId,
      positionId: user.positionId,
      levelId: user.levelId,
      teamId: user.teamId,
      workAreaId: user.workAreaId,
      workSubAreaId: user.workSubAreaId,
      employeeType: user.employeeType,
    };
  }

  private async resolveFromDb(userId: string): Promise<Set<string>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        anonymizedAt: true,
        companyId: true,
        locationId: true,
        departmentId: true,
        positionId: true,
        levelId: true,
        teamId: true,
        workAreaId: true,
        workSubAreaId: true,
        employeeType: true,
      },
    });

    if (!user) {
      return new Set();
    }

    const directRows = await this.prisma.rolePermission.findMany({
      where: {
        role: {
          isActive: true,
          userRoles: { some: { userId } },
        },
      },
      select: { permissionKey: true },
      distinct: ['permissionKey'],
    });

    const abacInputs = await this.loadActiveAbacRules();
    const snapshot: AbacUserSnapshot = {
      isActive: user.isActive,
      anonymizedAt: user.anonymizedAt,
      companyId: user.companyId,
      locationId: user.locationId,
      departmentId: user.departmentId,
      positionId: user.positionId,
      levelId: user.levelId,
      teamId: user.teamId,
      workAreaId: user.workAreaId,
      workSubAreaId: user.workSubAreaId,
      employeeType: user.employeeType,
    };
    const matchedRoleIds = this.attributeRuleEvaluator.matchingRoleIds(snapshot, abacInputs);

    let abacPermRows: { permissionKey: string }[] = [];
    if (matchedRoleIds.length > 0) {
      abacPermRows = await this.prisma.rolePermission.findMany({
        where: {
          roleId: { in: matchedRoleIds },
          role: { isActive: true },
        },
        select: { permissionKey: true },
        distinct: ['permissionKey'],
      });
    }

    const keys = new Set<string>();
    for (const r of directRows) {
      keys.add(r.permissionKey);
    }
    for (const r of abacPermRows) {
      keys.add(r.permissionKey);
    }
    return keys;
  }

  private async loadActiveAbacRules(): Promise<AbacRoleRuleInput[]> {
    const rules = await this.prisma.roleRule.findMany({
      where: { isActive: true, role: { isActive: true } },
      select: {
        roleId: true,
        conditionSets: {
          orderBy: { setOrder: 'asc' },
          select: {
            conditions: {
              orderBy: { createdAt: 'asc' },
              select: {
                attributeKey: true,
                operator: true,
                value: true,
              },
            },
          },
        },
      },
    });

    return rules.map((r) => ({
      roleId: r.roleId,
      conditionSets: r.conditionSets.map((cs) => ({
        conditions: cs.conditions.map((c) => ({
          attributeKey: c.attributeKey,
          operator: c.operator,
          value: c.value,
        })),
      })),
    }));
  }

  private async loadAbacRuleInputsForRole(roleId: string): Promise<AbacRoleRuleInput[]> {
    const rules = await this.prisma.roleRule.findMany({
      where: { isActive: true, roleId, role: { isActive: true } },
      select: {
        roleId: true,
        conditionSets: {
          orderBy: { setOrder: 'asc' },
          select: {
            conditions: {
              orderBy: { createdAt: 'asc' },
              select: {
                attributeKey: true,
                operator: true,
                value: true,
              },
            },
          },
        },
      },
    });
    return rules.map((r) => ({
      roleId: r.roleId,
      conditionSets: r.conditionSets.map((cs) => ({
        conditions: cs.conditions.map((c) => ({
          attributeKey: c.attributeKey,
          operator: c.operator,
          value: c.value,
        })),
      })),
    })) as AbacRoleRuleInput[];
  }

  private userMatchesAbacRole(
    snapshot: AbacUserSnapshot,
    ruleInputs: AbacRoleRuleInput[],
    targetRoleId: string,
  ): boolean {
    const forRole = ruleInputs.filter((r) => r.roleId === targetRoleId);
    for (const rule of forRole) {
      if (this.attributeRuleEvaluator.evaluateRoleRule(snapshot, rule)) {
        return true;
      }
    }
    return false;
  }

  /**
   * `targetRoleId` yeni `newPermissionKeys` olsaydı kullanıcının birleşik yetkileri (self-edit eşiği)
   */
  async projectPermissionsForUserWithRoleOverride(
    userId: string,
    targetRoleId: string,
    newPermissionKeys: string[],
  ): Promise<Set<string>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        anonymizedAt: true,
        companyId: true,
        locationId: true,
        departmentId: true,
        positionId: true,
        levelId: true,
        teamId: true,
        workAreaId: true,
        workSubAreaId: true,
        employeeType: true,
      },
    });
    if (!user) {
      return new Set();
    }

    const directUrs = await this.prisma.userRole.findMany({
      where: { userId, role: { isActive: true } },
      select: { roleId: true },
    });
    const directSet = new Set(directUrs.map((d) => d.roleId));

    const abacInputs = await this.loadActiveAbacRules();
    const snapshot: AbacUserSnapshot = {
      isActive: user.isActive,
      anonymizedAt: user.anonymizedAt,
      companyId: user.companyId,
      locationId: user.locationId,
      departmentId: user.departmentId,
      positionId: user.positionId,
      levelId: user.levelId,
      teamId: user.teamId,
      workAreaId: user.workAreaId,
      workSubAreaId: user.workSubAreaId,
      employeeType: user.employeeType,
    };
    const abacMatched = this.attributeRuleEvaluator.matchingRoleIds(snapshot, abacInputs);
    const allRoleIds = new Set<string>([...directSet, ...abacMatched]);

    const keys = new Set<string>();
    for (const rid of allRoleIds) {
      if (rid === targetRoleId) {
        for (const p of newPermissionKeys) {
          keys.add(p);
        }
        continue;
      }
      const rows = await this.prisma.rolePermission.findMany({
        where: { roleId: rid, role: { isActive: true } },
        select: { permissionKey: true },
        distinct: ['permissionKey'],
      });
      for (const r of rows) {
        keys.add(r.permissionKey);
      }
    }
    return keys;
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.has(permission);
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.redis.raw.del(this.cacheKey(userId));
  }

  async invalidateUserIds(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const unique = [...new Set(userIds)];
    const pl = this.redis.raw.pipeline();
    for (const id of unique) {
      pl.del(this.cacheKey(id));
    }
    await pl.exec();
  }

  async invalidateRole(roleId: string): Promise<void> {
    const fromDirect = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    const userIds = new Set(fromDirect.map((a) => a.userId));

    const ruleInputs = await this.loadAbacRuleInputsForRole(roleId);
    if (ruleInputs.length > 0) {
      const abacUsers = await this.prisma.user.findMany({
        where: { isActive: true, anonymizedAt: null },
        select: {
          id: true,
          isActive: true,
          anonymizedAt: true,
          companyId: true,
          locationId: true,
          departmentId: true,
          positionId: true,
          levelId: true,
          teamId: true,
          workAreaId: true,
          workSubAreaId: true,
          employeeType: true,
        },
      });
      for (const u of abacUsers) {
        const snap = this.toSnapshot(u);
        if (this.userMatchesAbacRole(snap, ruleInputs, roleId)) {
          userIds.add(u.id);
        }
      }
    }

    if (userIds.size === 0) return;
    await this.invalidateUserIds([...userIds]);
  }
}
