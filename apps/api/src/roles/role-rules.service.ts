import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateRoleRuleInput,
  PatchRoleRuleInput,
  RoleRuleConditionInput,
  RoleRuleTestBodyInput,
} from '@leanmgmt/shared-schemas';

import { AuditLogService } from '../common/audit/audit-log.service.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import {
  AttributeRuleEvaluatorService,
  type AbacRoleRuleInput,
  type AbacUserSnapshot,
} from './attribute-rule-evaluator.service.js';
import { PermissionResolverService } from './permission-resolver.service.js';
import {
  RoleNotFoundException,
  RoleRuleInvalidStructureException,
  RoleRuleNotFoundException,
} from './roles.exceptions.js';

@Injectable()
export class RoleRulesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AttributeRuleEvaluatorService)
    private readonly attributeRuleEvaluator: AttributeRuleEvaluatorService,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
    @Inject(AuditLogService) private readonly audit: AuditLogService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
  ) {}

  private assertConditionSets(conditionSets: CreateRoleRuleInput['conditionSets']): void {
    for (const set of conditionSets) {
      if (!set.conditions?.length) {
        throw new RoleRuleInvalidStructureException('Her koşul setinde en az bir koşul olmalı.');
      }
    }
  }

  private toJsonValue(value: string | string[]): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue;
  }

  private toAbacInput(
    roleId: string,
    conditionSets: CreateRoleRuleInput['conditionSets'],
  ): AbacRoleRuleInput {
    return {
      roleId,
      conditionSets: conditionSets.map((set: { conditions: RoleRuleConditionInput[] }) => ({
        conditions: set.conditions.map((c: RoleRuleConditionInput) => ({
          attributeKey: c.attributeKey,
          operator: c.operator,
          value: c.value,
        })),
      })),
    };
  }

  async countMatchingUsersForRule(abacRule: AbacRoleRuleInput): Promise<number> {
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
      },
    });
    let n = 0;
    for (const u of users) {
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
      if (this.attributeRuleEvaluator.evaluateRoleRule(snap, abacRule)) {
        n += 1;
      }
    }
    return n;
  }

  async sampleMatchingUsers(
    abacRule: AbacRoleRuleInput,
    take: number,
  ): Promise<
    {
      id: string;
      sicil: string;
      firstName: string;
      lastName: string;
      company: { id: string; code: string; name: string };
      position: { id: string; code: string; name: string };
    }[]
  > {
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
        company: { select: { id: true, code: true, name: true } },
        position: { select: { id: true, code: true, name: true } },
      },
    });
    const out: {
      id: string;
      sicil: string;
      firstName: string;
      lastName: string;
      company: { id: string; code: string; name: string };
      position: { id: string; code: string; name: string };
    }[] = [];
    for (const u of users) {
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
      if (!this.attributeRuleEvaluator.evaluateRoleRule(snap, abacRule)) continue;
      if (out.length >= take) break;
      out.push({
        id: u.id,
        sicil: this.encryption.decryptSicil(u.sicilEncrypted),
        firstName: u.firstName,
        lastName: u.lastName,
        company: { id: u.company.id, code: u.company.code, name: u.company.name },
        position: { id: u.position.id, code: u.position.code, name: u.position.name },
      });
    }
    return out;
  }

  async listRules(roleId: string): Promise<
    {
      id: string;
      order: number;
      isActive: boolean;
      matchingUserCount: number;
      conditionSets: {
        id: string;
        order: number;
        conditions: { id: string; attributeKey: string; operator: string; value: unknown }[];
      }[];
    }[]
  > {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, isActive: true } });
    if (!role) throw new RoleNotFoundException();

    const rules = await this.prisma.roleRule.findMany({
      where: { roleId },
      orderBy: { ruleOrder: 'asc' },
      include: {
        conditionSets: {
          orderBy: { setOrder: 'asc' },
          include: {
            conditions: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    const result: {
      id: string;
      order: number;
      isActive: boolean;
      matchingUserCount: number;
      conditionSets: {
        id: string;
        order: number;
        conditions: { id: string; attributeKey: string; operator: string; value: unknown }[];
      }[];
    }[] = [];

    for (const r of rules) {
      const abacReal: AbacRoleRuleInput = {
        roleId,
        conditionSets: r.conditionSets.map((cs) => ({
          conditions: cs.conditions.map((c) => ({
            attributeKey: c.attributeKey,
            operator: c.operator,
            value: c.value,
          })),
        })),
      };
      const matchingUserCount = r.isActive ? await this.countMatchingUsersForRule(abacReal) : 0;
      result.push({
        id: r.id,
        order: r.ruleOrder,
        isActive: r.isActive,
        matchingUserCount,
        conditionSets: r.conditionSets.map((cs) => ({
          id: cs.id,
          order: cs.setOrder,
          conditions: cs.conditions.map((c) => ({
            id: c.id,
            attributeKey: c.attributeKey,
            operator: c.operator,
            value: c.value,
          })),
        })),
      });
    }
    return result;
  }

  async createRule(
    roleId: string,
    input: CreateRoleRuleInput,
    actor: AuthenticatedUser,
  ): Promise<{ id: string }> {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, isActive: true } });
    if (!role) throw new RoleNotFoundException();
    this.assertConditionSets(input.conditionSets);

    const maxOrder = await this.prisma.roleRule.aggregate({
      where: { roleId },
      _max: { ruleOrder: true },
    });
    const ruleOrder = input.order ?? (maxOrder._max.ruleOrder ?? -1) + 1;

    const rule = await this.prisma.$transaction(async (tx) => {
      const created = await tx.roleRule.create({
        data: {
          roleId,
          ruleOrder,
          isActive: true,
          createdByUserId: actor.id,
        },
      });
      for (let si = 0; si < input.conditionSets.length; si += 1) {
        const set = input.conditionSets[si];
        const cs = await tx.roleRuleConditionSet.create({
          data: {
            roleRuleId: created.id,
            setOrder: si,
          },
        });
        for (const c of set.conditions) {
          await tx.roleRuleCondition.create({
            data: {
              conditionSetId: cs.id,
              attributeKey: c.attributeKey,
              operator: c.operator,
              value: this.toJsonValue(c.value),
            },
          });
        }
      }
      return created;
    });

    await this.permissionResolver.invalidateRole(roleId);

    await this.audit.append({
      userId: actor.id,
      action: 'CREATE_ROLE_RULE',
      entity: 'role_rule',
      entityId: rule.id,
      ipHash: 'api',
      metadata: { roleId } as const,
    });

    return { id: rule.id };
  }

  async patchRule(
    roleId: string,
    ruleId: string,
    input: PatchRoleRuleInput,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const rule = await this.prisma.roleRule.findFirst({
      where: { id: ruleId, roleId, role: { isActive: true } },
    });
    if (!rule) throw new RoleRuleNotFoundException();

    const newSets = input.conditionSets;
    if (newSets !== undefined) {
      this.assertConditionSets(newSets);
      await this.prisma.$transaction(async (tx) => {
        await tx.roleRuleConditionSet.deleteMany({ where: { roleRuleId: ruleId } });
        for (let si = 0; si < newSets.length; si += 1) {
          const set = newSets[si];
          const cs = await tx.roleRuleConditionSet.create({
            data: { roleRuleId: ruleId, setOrder: si },
          });
          for (const c of set.conditions) {
            await tx.roleRuleCondition.create({
              data: {
                conditionSetId: cs.id,
                attributeKey: c.attributeKey,
                operator: c.operator,
                value: this.toJsonValue(c.value),
              },
            });
          }
        }
        await tx.roleRule.update({
          where: { id: ruleId },
          data: {
            ...(input.order !== undefined ? { ruleOrder: input.order } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
        });
      });
    } else {
      await this.prisma.roleRule.update({
        where: { id: ruleId },
        data: {
          ...(input.order !== undefined ? { ruleOrder: input.order } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    }

    await this.permissionResolver.invalidateRole(roleId);

    await this.audit.append({
      userId: actor.id,
      action: 'UPDATE_ROLE_RULE',
      entity: 'role_rule',
      entityId: ruleId,
      ipHash: 'api',
      metadata: { roleId } as const,
    });
  }

  async deleteRule(roleId: string, ruleId: string, actor: AuthenticatedUser): Promise<void> {
    const rule = await this.prisma.roleRule.findFirst({
      where: { id: ruleId, roleId, role: { isActive: true } },
    });
    if (!rule) throw new RoleRuleNotFoundException();

    await this.prisma.roleRule.delete({ where: { id: ruleId } });

    await this.permissionResolver.invalidateRole(roleId);

    await this.audit.append({
      userId: actor.id,
      action: 'DELETE_ROLE_RULE',
      entity: 'role_rule',
      entityId: ruleId,
      ipHash: 'api',
      metadata: { roleId } as const,
    });
  }

  async testDraft(
    roleId: string,
    body: RoleRuleTestBodyInput,
  ): Promise<{
    matchingUserCount: number;
    sampleUsers: {
      id: string;
      sicil: string;
      firstName: string;
      lastName: string;
      company: { id: string; code: string; name: string };
      position: { id: string; code: string; name: string };
    }[];
  }> {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, isActive: true } });
    if (!role) throw new RoleNotFoundException();
    this.assertConditionSets(body.conditionSets);
    const abac: AbacRoleRuleInput = this.toAbacInput(roleId, body.conditionSets);
    const matchingUserCount = await this.countMatchingUsersForRule(abac);
    const sampleUsers = await this.sampleMatchingUsers(abac, 10);
    return { matchingUserCount, sampleUsers };
  }
}
