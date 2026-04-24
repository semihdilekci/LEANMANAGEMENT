import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  AssignUserToRoleInput,
  CreateRoleInput,
  RoleListQuery,
  RoleUsersListQuery,
  UpdateRoleInput,
} from '@leanmgmt/shared-schemas';

import { AppException } from '../common/exceptions/app.exception.js';
import { AuditLogService } from '../common/audit/audit-log.service.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserNotFoundException } from '../users/users.exceptions.js';

import {
  PERMISSION_CACHE_EVENT,
  type UserPermissionCacheInvalidatePayload,
} from './permission-cache.events.js';
import {
  AttributeRuleEvaluatorService,
  type AbacRoleRuleInput,
  type AbacUserSnapshot,
} from './attribute-rule-evaluator.service.js';
import { PermissionResolverService } from './permission-resolver.service.js';
import {
  RoleCodeDuplicateException,
  RoleNotFoundException,
  RoleSelfDeleteForbiddenException,
  RoleSystemCannotDeleteException,
} from './roles.exceptions.js';

@Injectable()
export class RolesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EventEmitter2) private readonly events: EventEmitter2,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
    @Inject(AttributeRuleEvaluatorService)
    private readonly attributeRuleEvaluator: AttributeRuleEvaluatorService,
    @Inject(AuditLogService) private readonly audit: AuditLogService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
  ) {}

  async findMany(query: RoleListQuery): Promise<
    {
      id: string;
      code: string;
      name: string;
      description: string | null;
      isSystem: boolean;
      isActive: boolean;
      permissionCount: number;
      userCount: number;
      createdAt: string;
    }[]
  > {
    const where: Prisma.RoleWhereInput = {};

    if (query.isActive === 'true') where.isActive = true;
    else if (query.isActive === 'false') where.isActive = false;

    if (query.isSystem === 'true') where.isSystem = true;
    else if (query.isSystem === 'false') where.isSystem = false;

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.role.findMany({
      where,
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
      include: {
        _count: {
          select: { rolePermissions: true, userRoles: true },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      isActive: r.isActive,
      permissionCount: r._count.rolePermissions,
      userCount: r._count.userRoles,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(input: CreateRoleInput, actor: AuthenticatedUser): Promise<Record<string, unknown>> {
    const existing = await this.prisma.role.findUnique({ where: { code: input.code } });
    if (existing) throw new RoleCodeDuplicateException();

    const role = await this.prisma.role.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        isSystem: false,
        isActive: true,
        createdByUserId: actor.id,
      },
    });

    await this.audit.append({
      userId: actor.id,
      action: 'CREATE_ROLE',
      entity: 'role',
      entityId: role.id,
      ipHash: 'api',
      metadata: { code: role.code } as const,
    });

    return this.serializeRoleSummary(role);
  }

  async findById(roleId: string): Promise<Record<string, unknown>> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, isActive: true },
      include: {
        rolePermissions: { select: { permissionKey: true }, orderBy: { permissionKey: 'asc' } },
        _count: { select: { roleRules: true } },
      },
    });
    if (!role) throw new RoleNotFoundException();
    return {
      ...(await this.serializeRoleSummary(role)),
      permissions: role.rolePermissions.map((p) => p.permissionKey),
      ruleCount: role._count.roleRules,
    };
  }

  async update(
    roleId: string,
    input: UpdateRoleInput,
    actor: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, isActive: true } });
    if (!role) throw new RoleNotFoundException();

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });

    await this.permissionResolver.invalidateRole(roleId);

    await this.audit.append({
      userId: actor.id,
      action: 'UPDATE_ROLE',
      entity: 'role',
      entityId: roleId,
      ipHash: 'api',
      metadata: { oldCode: role.code, newName: updated.name } as const,
    });

    return this.serializeRoleSummary(updated);
  }

  async delete(roleId: string, actor: AuthenticatedUser): Promise<void> {
    const role = await this.prisma.role.findFirst({ where: { id: roleId } });
    if (!role) throw new RoleNotFoundException();
    if (role.isSystem) throw new RoleSystemCannotDeleteException();

    const actorHas = await this.prisma.userRole.findFirst({
      where: { userId: actor.id, roleId },
    });
    if (actorHas) throw new RoleSelfDeleteForbiddenException();

    await this.permissionResolver.invalidateRole(roleId);
    await this.prisma.role.delete({ where: { id: roleId } });

    await this.audit.append({
      userId: actor.id,
      action: 'DELETE_ROLE',
      entity: 'role',
      entityId: roleId,
      ipHash: 'api',
      metadata: { code: role.code } as const,
    });
  }

  async getRolePermissions(roleId: string): Promise<{ key: string; grantedAt: string }[]> {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, isActive: true } });
    if (!role) throw new RoleNotFoundException();
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      orderBy: { permissionKey: 'asc' },
    });
    return rows.map((r) => ({
      key: r.permissionKey,
      grantedAt: r.grantedAt.toISOString(),
    }));
  }

  async assignUserToRole(
    roleId: string,
    input: AssignUserToRoleInput,
    actor: AuthenticatedUser,
  ): Promise<{ userRoleId: string; assignedAt: string }> {
    const [role, targetUser] = await Promise.all([
      this.prisma.role.findFirst({ where: { id: roleId, isActive: true } }),
      this.prisma.user.findFirst({ where: { id: input.userId, anonymizedAt: null } }),
    ]);
    if (!role) throw new RoleNotFoundException();
    if (!targetUser) throw new UserNotFoundException();

    const existingUr = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId: input.userId, roleId } },
    });
    if (existingUr) {
      throw new AppException('VALIDATION_FAILED', 'Bu kullanıcı role zaten atanmış.', 409, {
        existing: true,
      });
    }

    const created = await this.prisma.userRole.create({
      data: {
        userId: input.userId,
        roleId,
        assignedByUserId: actor.id,
      },
    });

    this.events.emit(PERMISSION_CACHE_EVENT.USER_INVALIDATE, {
      userId: input.userId,
    } satisfies UserPermissionCacheInvalidatePayload);

    await this.audit.append({
      userId: actor.id,
      action: 'ASSIGN_ROLE',
      entity: 'user_role',
      entityId: created.id,
      ipHash: 'api',
      metadata: { userId: input.userId, roleId, roleCode: role.code } as const,
    });

    return { userRoleId: created.id, assignedAt: created.assignedAt.toISOString() };
  }

  async unassignUserFromRole(
    roleId: string,
    userId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, isActive: true } });
    if (!role) throw new RoleNotFoundException();

    const deleted = await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });
    if (deleted.count === 0) {
      return;
    }

    this.events.emit(PERMISSION_CACHE_EVENT.USER_INVALIDATE, {
      userId,
    } satisfies UserPermissionCacheInvalidatePayload);

    await this.audit.append({
      userId: actor.id,
      action: 'UNASSIGN_ROLE',
      entity: 'user_role',
      entityId: userId,
      ipHash: 'api',
      metadata: { userId, roleId, roleCode: role.code } as const,
    });
  }

  private async serializeRoleSummary(role: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
  }): Promise<Record<string, unknown>> {
    const [permCount, urCount] = await Promise.all([
      this.prisma.rolePermission.count({ where: { roleId: role.id } }),
      this.prisma.userRole.count({ where: { roleId: role.id } }),
    ]);
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissionCount: permCount,
      userCount: urCount,
      createdAt: role.createdAt.toISOString(),
    };
  }

  async listRoleUsers(
    roleId: string,
    query: RoleUsersListQuery,
  ): Promise<{
    items: Record<string, unknown>[];
    pagination: { nextCursor: string | null; hasMore: boolean };
  }> {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, isActive: true } });
    if (!role) throw new RoleNotFoundException();

    const limit = query.limit;
    type Row = {
      user: {
        id: string;
        sicil: string;
        firstName: string;
        lastName: string;
        email: string;
        company: { id: string; code: string; name: string };
        position: { id: string; code: string; name: string };
      };
      source: 'DIRECT' | 'ATTRIBUTE_RULE';
      assignedAt?: string;
      assignedByUserId?: string;
      matchedRuleId?: string;
      matchedConditionSetOrder?: number;
    };

    const directRows = await this.prisma.userRole.findMany({
      where: { roleId },
      include: {
        user: {
          select: {
            id: true,
            sicilEncrypted: true,
            firstName: true,
            lastName: true,
            emailEncrypted: true,
            anonymizedAt: true,
            company: { select: { id: true, code: true, name: true } },
            position: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const toUserPayload = (u: (typeof directRows)[0]['user']): Row['user'] => ({
      id: u.id,
      sicil: u.anonymizedAt ? '' : this.encryption.decryptSicil(u.sicilEncrypted),
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.anonymizedAt ? '' : this.encryption.decryptEmail(u.emailEncrypted),
      company: { id: u.company.id, code: u.company.code, name: u.company.name },
      position: { id: u.position.id, code: u.position.code, name: u.position.name },
    });

    const directMapped: Row[] = directRows.map((ur) => ({
      user: toUserPayload(ur.user),
      source: 'DIRECT' as const,
      assignedAt: ur.assignedAt.toISOString(),
      assignedByUserId: ur.assignedByUserId,
    }));

    const directIds = new Set(directRows.map((d) => d.userId));

    const ruleRows: Row[] = [];
    if (query.source === 'attribute_rule' || query.source === 'all') {
      const rules = await this.prisma.roleRule.findMany({
        where: { roleId, isActive: true },
        orderBy: { ruleOrder: 'asc' },
        include: {
          conditionSets: {
            orderBy: { setOrder: 'asc' },
            include: { conditions: { orderBy: { createdAt: 'asc' } } },
          },
        },
      });

      const users = await this.prisma.user.findMany({
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
          sicilEncrypted: true,
          firstName: true,
          lastName: true,
          emailEncrypted: true,
          company: { select: { id: true, code: true, name: true } },
          position: { select: { id: true, code: true, name: true } },
        },
      });

      for (const u of users) {
        if (directIds.has(u.id)) continue;
        const snap: AbacUserSnapshot = {
          isActive: u.isActive,
          anonymizedAt: u.anonymizedAt,
          companyId: u.companyId,
          locationId: u.locationId,
          departmentId: u.departmentId,
          positionId: u.positionId,
          levelId: u.levelId,
          teamId: u.teamId,
          workAreaId: u.workAreaId,
          workSubAreaId: u.workSubAreaId,
          employeeType: u.employeeType,
        };
        for (const rr of rules) {
          const abac: AbacRoleRuleInput = {
            roleId,
            conditionSets: rr.conditionSets.map((cs) => ({
              conditions: cs.conditions.map((c) => ({
                attributeKey: c.attributeKey,
                operator: c.operator,
                value: c.value,
              })),
            })),
          };
          if (!this.attributeRuleEvaluator.evaluateRoleRule(snap, abac)) continue;
          const firstSetOrder = rr.conditionSets[0]?.setOrder ?? 0;
          ruleRows.push({
            user: {
              id: u.id,
              sicil: this.encryption.decryptSicil(u.sicilEncrypted),
              firstName: u.firstName,
              lastName: u.lastName,
              email: this.encryption.decryptEmail(u.emailEncrypted),
              company: { id: u.company.id, code: u.company.code, name: u.company.name },
              position: { id: u.position.id, code: u.position.code, name: u.position.name },
            },
            source: 'ATTRIBUTE_RULE',
            matchedRuleId: rr.id,
            matchedConditionSetOrder: firstSetOrder,
          });
          break;
        }
      }
    }

    let merged: Row[] = [];
    if (query.source === 'direct') merged = directMapped;
    else if (query.source === 'attribute_rule') merged = ruleRows;
    else merged = [...directMapped, ...ruleRows];

    if (query.search?.trim()) {
      const s = query.search.trim().toLowerCase();
      merged = merged.filter((r) => {
        const full =
          `${r.user.sicil} ${r.user.firstName} ${r.user.lastName} ${r.user.email}`.toLowerCase();
        return full.includes(s);
      });
    }

    merged.sort((a, b) => a.user.id.localeCompare(b.user.id));

    let start = 0;
    const listCursor = query.cursor;
    if (listCursor) {
      const idx = merged.findIndex((r) => r.user.id > listCursor);
      start = idx === -1 ? merged.length : idx;
    }

    const slice = merged.slice(start, start + limit + 1);
    const hasMore = slice.length > limit;
    const items = hasMore ? slice.slice(0, limit) : slice;

    return {
      items: items.map((r) => {
        const base: Record<string, unknown> = {
          user: r.user,
          source: r.source,
        };
        if (r.source === 'DIRECT') {
          base['assignedAt'] = r.assignedAt;
          base['assignedByUserId'] = r.assignedByUserId;
        } else {
          base['matchedRuleId'] = r.matchedRuleId;
          base['matchedConditionSetOrder'] = r.matchedConditionSetOrder;
        }
        return base;
      }),
      pagination: {
        nextCursor: hasMore ? (items[items.length - 1]?.user.id ?? null) : null,
        hasMore,
      },
    };
  }
}
