import { createHash, randomInt } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type User } from '@leanmgmt/prisma-client';

import {
  WEATHER_AVATAR_KEYS,
  type CreateUserInput,
  type UpdateUserInput,
  type UserAnonymizeInput,
  type UserDeactivateInput,
  type UserListQuery,
  type UserReactivateInput,
  type UserRoleItem,
} from '@leanmgmt/shared-schemas';

import { AuditLogService } from '../common/audit/audit-log.service.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import {
  PERMISSION_CACHE_EVENT,
  type UserPermissionCacheInvalidatePayload,
} from '../roles/permission-cache.events.js';
import {
  AttributeRuleEvaluatorService,
  type AbacRoleRuleInput,
  type AbacUserSnapshot,
} from '../roles/attribute-rule-evaluator.service.js';
import { PermissionResolverService } from '../roles/permission-resolver.service.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

import {
  MasterDataInUseException,
  MasterDataNotFoundException,
  UserAlreadyActiveException,
  UserAlreadyPassiveException,
  UserAnonymizedException,
  UserEmailDuplicateException,
  UserManagerCycleException,
  UserNotFoundException,
  UserSelfEditForbiddenException,
  UserSicilDuplicateException,
} from './users.exceptions.js';

const ANON_PLACEHOLDER_PREFIX = 'ANONYMIZED';

const USER_DETAIL_INCLUDE = {
  company: true,
  location: true,
  department: true,
  position: true,
  level: true,
  team: true,
  workArea: true,
  workSubArea: true,
  manager: true,
  createdByUser: { select: { id: true, firstName: true, lastName: true } },
  userRoles: { include: { role: true } },
} as const;

type UserWithDetailRelations = Prisma.UserGetPayload<{
  include: typeof USER_DETAIL_INCLUDE;
}>;

function sha256Short(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
    @Inject(AuditLogService) private readonly audit: AuditLogService,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
    @Inject(AttributeRuleEvaluatorService)
    private readonly attributeRuleEvaluator: AttributeRuleEvaluatorService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(EventEmitter2) private readonly events: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------------------
  // Serialization helpers
  // ---------------------------------------------------------------------------

  private serializeUser(user: User & Record<string, unknown>): Record<string, unknown> {
    return {
      id: user.id,
      sicil: user.anonymizedAt ? null : this.encryption.decryptSicil(user.sicilEncrypted),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.anonymizedAt ? null : this.encryption.decryptEmail(user.emailEncrypted),
      phone:
        !user.anonymizedAt && user.phoneEncrypted && user.phoneDek
          ? this.encryption.decryptPhone(user.phoneEncrypted, user.phoneDek)
          : null,
      employeeType: user.employeeType,
      avatarKey: user.avatarKey,
      companyId: user.companyId,
      locationId: user.locationId,
      departmentId: user.departmentId,
      positionId: user.positionId,
      levelId: user.levelId,
      teamId: user.teamId,
      workAreaId: user.workAreaId,
      workSubAreaId: user.workSubAreaId,
      managerUserId: user.managerUserId,
      managerEmail:
        !user.anonymizedAt && user.managerEmailEncrypted
          ? this.encryption.decryptEmail(user.managerEmailEncrypted)
          : null,
      hireDate: user.hireDate ? (user.hireDate as Date).toISOString().split('T')[0] : null,
      isActive: user.isActive,
      anonymizedAt: user.anonymizedAt ? (user.anonymizedAt as Date).toISOString() : null,
      anonymizationReason: user.anonymizationReason ?? null,
      passwordChangedAt: user.passwordChangedAt
        ? (user.passwordChangedAt as Date).toISOString()
        : null,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil ? (user.lockedUntil as Date).toISOString() : null,
      lastLoginAt: user.lastLoginAt ? (user.lastLoginAt as Date).toISOString() : null,
      passwordIsSet: Boolean(user.passwordHash),
      createdByUserId: user.createdByUserId,
      createdAt: (user.createdAt as Date).toISOString(),
      updatedAt: (user.updatedAt as Date).toISOString(),
    };
  }

  private serializeUserWithRelations(user: UserWithDetailRelations): Record<string, unknown> {
    const base = this.serializeUser(user);
    return {
      ...base,
      company: { id: user.company.id, code: user.company.code, name: user.company.name },
      location: { id: user.location.id, code: user.location.code, name: user.location.name },
      department: {
        id: user.department.id,
        code: user.department.code,
        name: user.department.name,
      },
      position: { id: user.position.id, code: user.position.code, name: user.position.name },
      level: { id: user.level.id, code: user.level.code, name: user.level.name },
      team: user.team ? { id: user.team.id, code: user.team.code, name: user.team.name } : null,
      workArea: { id: user.workArea.id, code: user.workArea.code, name: user.workArea.name },
      workSubArea: user.workSubArea
        ? { id: user.workSubArea.id, code: user.workSubArea.code, name: user.workSubArea.name }
        : null,
      manager: user.manager
        ? {
            id: user.manager.id,
            sicil: this.encryption.decryptSicil(user.manager.sicilEncrypted),
            firstName: user.manager.firstName,
            lastName: user.manager.lastName,
          }
        : null,
      createdBy: user.createdByUser
        ? {
            id: user.createdByUser.id,
            firstName: user.createdByUser.firstName,
            lastName: user.createdByUser.lastName,
          }
        : null,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
        source: 'DIRECT' as const,
        assignedAt: ur.assignedAt.toISOString(),
        assignedByUserId: ur.assignedByUserId,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Manager cycle detection — iterative A → B → C → A detect
  // ---------------------------------------------------------------------------

  private async detectManagerCycle(userId: string, proposedManagerId: string): Promise<boolean> {
    let current: string | null = proposedManagerId;
    const visited = new Set<string>();

    while (current !== null) {
      if (current === userId) return true;
      if (visited.has(current)) break;
      visited.add(current);

      const row: { managerUserId: string | null } | null = await this.prisma.user.findUnique({
        where: { id: current },
        select: { managerUserId: true },
      });
      current = row?.managerUserId ?? null;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // FK validation helpers
  // ---------------------------------------------------------------------------

  private async assertMasterDataActive(
    model:
      | 'company'
      | 'location'
      | 'department'
      | 'position'
      | 'level'
      | 'team'
      | 'workArea'
      | 'workSubArea',
    id: string,
    field: string,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = await (this.prisma as any)[model].findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!record) throw new MasterDataNotFoundException(field);
    if (!record.isActive) throw new MasterDataInUseException(field);
  }

  private async validateFKs(dto: CreateUserInput | UpdateUserInput): Promise<void> {
    if ('companyId' in dto && dto.companyId) {
      await this.assertMasterDataActive('company', dto.companyId, 'companyId');
    }
    if ('locationId' in dto && dto.locationId) {
      await this.assertMasterDataActive('location', dto.locationId, 'locationId');
    }
    if ('departmentId' in dto && dto.departmentId) {
      await this.assertMasterDataActive('department', dto.departmentId, 'departmentId');
    }
    if ('positionId' in dto && dto.positionId) {
      await this.assertMasterDataActive('position', dto.positionId, 'positionId');
    }
    if ('levelId' in dto && dto.levelId) {
      await this.assertMasterDataActive('level', dto.levelId, 'levelId');
    }
    if ('teamId' in dto && dto.teamId) {
      await this.assertMasterDataActive('team', dto.teamId, 'teamId');
    }
    if ('workAreaId' in dto && dto.workAreaId) {
      await this.assertMasterDataActive('workArea', dto.workAreaId, 'workAreaId');
    }
    if ('workSubAreaId' in dto && dto.workSubAreaId) {
      await this.assertMasterDataActive('workSubArea', dto.workSubAreaId, 'workSubAreaId');
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(dto: CreateUserInput, actor: AuthenticatedUser): Promise<Record<string, unknown>> {
    await this.validateFKs(dto);

    const sicilBlind = this.encryption.sicilBlindIndex(dto.sicil);
    const existing = await this.prisma.user.findUnique({ where: { sicilBlindIndex: sicilBlind } });
    if (existing) throw new UserSicilDuplicateException(dto.sicil);

    const emailBlind = this.encryption.emailBlindIndex(dto.email);
    const existingEmail = await this.prisma.user.findUnique({
      where: { emailBlindIndex: emailBlind },
    });
    if (existingEmail) throw new UserEmailDuplicateException();

    if (dto.managerUserId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.managerUserId },
        select: { id: true, isActive: true },
      });
      if (!manager) throw new MasterDataNotFoundException('managerUserId');
      if (!manager.isActive) throw new MasterDataInUseException('managerUserId');
    }

    const sicilEncrypted = this.encryption.encryptSicil(dto.sicil);
    const emailEncrypted = this.encryption.encryptEmail(dto.email);

    let phoneEncrypted: Uint8Array | undefined;
    let phoneDek: Uint8Array | undefined;
    if (dto.phone) {
      const result = this.encryption.encryptPhone(dto.phone);
      phoneEncrypted = result.ciphertext;
      phoneDek = result.dek;
    }

    let managerEmailEncrypted: Uint8Array | undefined;
    let managerEmailBlindIndex: string | undefined;
    if (dto.managerEmail) {
      managerEmailEncrypted = this.encryption.encryptEmail(dto.managerEmail);
      managerEmailBlindIndex = this.encryption.emailBlindIndex(dto.managerEmail);
    }

    const user = await this.prisma.user.create({
      data: {
        sicilEncrypted: sicilEncrypted as Prisma.Bytes,
        sicilBlindIndex: sicilBlind,
        firstName: dto.firstName,
        lastName: dto.lastName,
        emailEncrypted: emailEncrypted as Prisma.Bytes,
        emailBlindIndex: emailBlind,
        phoneEncrypted: (phoneEncrypted ?? null) as Prisma.Bytes | null,
        phoneDek: (phoneDek ?? null) as Prisma.Bytes | null,
        employeeType: dto.employeeType,
        companyId: dto.companyId,
        locationId: dto.locationId,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        levelId: dto.levelId,
        teamId: dto.teamId ?? null,
        workAreaId: dto.workAreaId,
        workSubAreaId: dto.workSubAreaId ?? null,
        managerUserId: dto.managerUserId ?? null,
        managerEmailEncrypted: (managerEmailEncrypted ?? null) as Prisma.Bytes | null,
        managerEmailBlindIndex: managerEmailBlindIndex ?? null,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
        avatarKey: WEATHER_AVATAR_KEYS[randomInt(WEATHER_AVATAR_KEYS.length)],
        createdByUserId: actor.id,
      },
      include: USER_DETAIL_INCLUDE,
    });

    await this.audit.append({
      userId: actor.id,
      action: 'CREATE_USER',
      entity: 'user',
      entityId: user.id,
      ipHash: 'api',
      metadata: { createdUserId: user.id },
    });

    this.logger.log({ event: 'user.created', actorId: actor.id, userId: user.id });

    return this.serializeUserWithRelations(user);
  }

  async findMany(query: UserListQuery): Promise<{
    items: Record<string, unknown>[];
    pagination: { nextCursor: string | null; hasMore: boolean; total?: number };
  }> {
    const isActive = query.isActive === 'all' ? undefined : query.isActive === 'true';

    const orderBy =
      query.sort === 'sicil_asc'
        ? { sicilBlindIndex: 'asc' as const }
        : query.sort === 'created_at_desc'
          ? { createdAt: 'desc' as const }
          : { lastName: 'asc' as const };

    const where: Record<string, unknown> = {};
    if (isActive !== undefined) where['isActive'] = isActive;
    if (query.companyId) where['companyId'] = query.companyId;
    if (query.locationId) where['locationId'] = query.locationId;
    if (query.departmentId) where['departmentId'] = query.departmentId;
    if (query.positionId) where['positionId'] = query.positionId;
    if (query.levelId) where['levelId'] = query.levelId;
    if (query.employeeType) where['employeeType'] = query.employeeType;

    if (query.search) {
      const search = query.search.trim();
      const emailBlind = this.encryption.emailBlindIndex(search);
      const sicilBlind = search.match(/^\d{8}$/)
        ? this.encryption.sicilBlindIndex(search)
        : undefined;

      const orConditions: Record<string, unknown>[] = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { emailBlindIndex: emailBlind },
      ];
      if (sicilBlind) orConditions.push({ sicilBlindIndex: sicilBlind });

      where['OR'] = orConditions;
    }

    const limit = query.limit;
    const items = await this.prisma.user.findMany({
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      orderBy,
      where,
      include: {
        company: { select: { id: true, code: true, name: true } },
        position: { select: { id: true, code: true, name: true } },
      },
    });

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    return {
      items: items.map((u) => ({
        id: u.id,
        sicil: u.anonymizedAt ? null : this.encryption.decryptSicil(u.sicilEncrypted),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.anonymizedAt ? null : this.encryption.decryptEmail(u.emailEncrypted),
        company: { id: u.company.id, code: u.company.code, name: u.company.name },
        position: { id: u.position.id, code: u.position.code, name: u.position.name },
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
      })),
      pagination: { nextCursor, hasMore },
    };
  }

  async findById(id: string, actor: AuthenticatedUser): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: USER_DETAIL_INCLUDE,
    });

    if (!user) throw new UserNotFoundException();

    // kendi kaydına ya da USER_LIST_VIEW ile başkasına erişim
    const isSelf = actor.id === id;
    if (!isSelf) {
      const hasViewPermission = await this.permissionResolver.hasPermission(
        actor.id,
        'USER_LIST_VIEW',
      );
      if (!hasViewPermission) throw new UserNotFoundException();
    }

    return this.serializeUserWithRelations(user);
  }

  async update(
    id: string,
    dto: UpdateUserInput,
    actor: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    if (actor.id === id) throw new UserSelfEditForbiddenException();

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException();

    await this.validateFKs(dto);

    if (dto.email) {
      const emailBlind = this.encryption.emailBlindIndex(dto.email);
      const conflict = await this.prisma.user.findUnique({
        where: { emailBlindIndex: emailBlind },
      });
      if (conflict && conflict.id !== id) throw new UserEmailDuplicateException();
    }

    if (dto.managerUserId !== undefined && dto.managerUserId !== null) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.managerUserId },
        select: { id: true, isActive: true },
      });
      if (!manager) throw new MasterDataNotFoundException('managerUserId');
      if (!manager.isActive) throw new MasterDataInUseException('managerUserId');

      const hasCycle = await this.detectManagerCycle(id, dto.managerUserId);
      if (hasCycle) throw new UserManagerCycleException();
    }

    const updateData: Record<string, unknown> = {};
    if (dto.firstName !== undefined) updateData['firstName'] = dto.firstName;
    if (dto.lastName !== undefined) updateData['lastName'] = dto.lastName;
    if (dto.employeeType !== undefined) updateData['employeeType'] = dto.employeeType;
    if (dto.companyId !== undefined) updateData['companyId'] = dto.companyId;
    if (dto.locationId !== undefined) updateData['locationId'] = dto.locationId;
    if (dto.departmentId !== undefined) updateData['departmentId'] = dto.departmentId;
    if (dto.positionId !== undefined) updateData['positionId'] = dto.positionId;
    if (dto.levelId !== undefined) updateData['levelId'] = dto.levelId;
    if ('teamId' in dto) updateData['teamId'] = dto.teamId ?? null;
    if (dto.workAreaId !== undefined) updateData['workAreaId'] = dto.workAreaId;
    if ('workSubAreaId' in dto) updateData['workSubAreaId'] = dto.workSubAreaId ?? null;
    if ('managerUserId' in dto) updateData['managerUserId'] = dto.managerUserId ?? null;
    if ('hireDate' in dto) updateData['hireDate'] = dto.hireDate ? new Date(dto.hireDate) : null;

    if (dto.email) {
      const emailBlind = this.encryption.emailBlindIndex(dto.email);
      updateData['emailEncrypted'] = this.encryption.encryptEmail(dto.email);
      updateData['emailBlindIndex'] = emailBlind;
    }

    if (dto.phone !== undefined) {
      if (dto.phone) {
        const { ciphertext, dek } = this.encryption.encryptPhone(dto.phone);
        updateData['phoneEncrypted'] = ciphertext;
        updateData['phoneDek'] = dek;
      } else {
        updateData['phoneEncrypted'] = null;
        updateData['phoneDek'] = null;
      }
    }

    if (dto.managerEmail !== undefined) {
      if (dto.managerEmail) {
        updateData['managerEmailEncrypted'] = this.encryption.encryptEmail(dto.managerEmail);
        updateData['managerEmailBlindIndex'] = this.encryption.emailBlindIndex(dto.managerEmail);
      } else {
        updateData['managerEmailEncrypted'] = null;
        updateData['managerEmailBlindIndex'] = null;
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: USER_DETAIL_INCLUDE,
    });

    this.events.emit(PERMISSION_CACHE_EVENT.USER_INVALIDATE, {
      userId: id,
    } satisfies UserPermissionCacheInvalidatePayload);

    await this.audit.append({
      userId: actor.id,
      action: 'UPDATE_USER_ATTRIBUTE',
      entity: 'user',
      entityId: id,
      ipHash: 'api',
      metadata: { changedFields: Object.keys(updateData) },
    });

    return this.serializeUserWithRelations(updated);
  }

  async deactivate(id: string, dto: UserDeactivateInput, actor: AuthenticatedUser): Promise<void> {
    if (actor.id === id) throw new UserSelfEditForbiddenException();

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException();
    if (!user.isActive) throw new UserAlreadyPassiveException();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { isActive: false } });
      await tx.session.updateMany({
        where: { userId: id, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date(), revocationReason: 'ADMIN_REVOKED' },
      });
    });

    this.events.emit(PERMISSION_CACHE_EVENT.USER_INVALIDATE, {
      userId: id,
    } satisfies UserPermissionCacheInvalidatePayload);

    await this.audit.append({
      userId: actor.id,
      action: 'DEACTIVATE_USER',
      entity: 'user',
      entityId: id,
      ipHash: 'api',
      metadata: { reason: dto.reason },
    });
  }

  async reactivate(id: string, dto: UserReactivateInput, actor: AuthenticatedUser): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException();
    if (user.anonymizedAt) throw new UserAnonymizedException();
    if (user.isActive) throw new UserAlreadyActiveException();

    await this.prisma.user.update({ where: { id }, data: { isActive: true } });

    await this.audit.append({
      userId: actor.id,
      action: 'REACTIVATE_USER',
      entity: 'user',
      entityId: id,
      ipHash: 'api',
      metadata: { reason: dto.reason },
    });
  }

  async anonymize(id: string, dto: UserAnonymizeInput, actor: AuthenticatedUser): Promise<void> {
    if (actor.id === id) throw new UserSelfEditForbiddenException();

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException();
    if (user.anonymizedAt) throw new UserAnonymizedException();

    const suffix = sha256Short(id);
    const anonSicil = `ANON${suffix.slice(0, 4)}`;
    const anonEmail = `anonymized_${suffix}@anon.invalid`;

    const sicilBlind = this.encryption.sicilBlindIndex(anonSicil);
    const emailBlind = this.encryption.emailBlindIndex(anonEmail);
    const sicilEncrypted = this.encryption.encryptSicil(anonSicil);
    const emailEncrypted = this.encryption.encryptEmail(anonEmail);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          sicilEncrypted: sicilEncrypted as Prisma.Bytes,
          sicilBlindIndex: sicilBlind,
          firstName: ANON_PLACEHOLDER_PREFIX,
          lastName: ANON_PLACEHOLDER_PREFIX,
          emailEncrypted: emailEncrypted as Prisma.Bytes,
          emailBlindIndex: emailBlind,
          phoneEncrypted: null,
          phoneDek: null,
          managerUserId: null,
          managerEmailEncrypted: null,
          managerEmailBlindIndex: null,
          anonymizedAt: new Date(),
          anonymizationReason: dto.reason,
          isActive: false,
        },
      });
      await tx.session.updateMany({
        where: { userId: id, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date(), revocationReason: 'ADMIN_REVOKED' },
      });
    });

    this.events.emit(PERMISSION_CACHE_EVENT.USER_INVALIDATE, {
      userId: id,
    } satisfies UserPermissionCacheInvalidatePayload);

    await this.audit.append({
      userId: actor.id,
      action: 'ANONYMIZE_USER',
      entity: 'user',
      entityId: id,
      ipHash: 'api',
      metadata: { reason: dto.reason },
    });

    this.logger.warn({ event: 'user.anonymized', actorId: actor.id, userId: id });
  }

  async getUserRoles(id: string): Promise<UserRoleItem[]> {
    const user = await this.prisma.user.findUnique({
      where: { id },
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
    if (!user) throw new UserNotFoundException();

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: id },
      include: { role: true },
      orderBy: { assignedAt: 'desc' },
    });

    const direct: UserRoleItem[] = userRoles.map((ur) => ({
      id: ur.role.id,
      code: ur.role.code,
      name: ur.role.name,
      source: 'DIRECT',
      assignedAt: ur.assignedAt.toISOString(),
      assignedByUserId: ur.assignedByUserId,
    }));

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

    const roleRules = await this.prisma.roleRule.findMany({
      where: { isActive: true, role: { isActive: true } },
      orderBy: [{ roleId: 'asc' }, { ruleOrder: 'asc' }, { id: 'asc' }],
      include: {
        role: { select: { id: true, code: true, name: true } },
        conditionSets: {
          orderBy: { setOrder: 'asc' },
          include: {
            conditions: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    const abac: UserRoleItem[] = [];
    const abacCoveredRoleIds = new Set<string>();
    for (const rr of roleRules) {
      if (abacCoveredRoleIds.has(rr.roleId)) {
        continue;
      }
      const abacInput: AbacRoleRuleInput = {
        roleId: rr.roleId,
        conditionSets: rr.conditionSets.map((cs) => ({
          conditions: cs.conditions.map((c) => ({
            attributeKey: c.attributeKey,
            operator: c.operator,
            value: c.value,
          })),
        })),
      };
      if (!this.attributeRuleEvaluator.evaluateRoleRule(snapshot, abacInput)) {
        continue;
      }
      abacCoveredRoleIds.add(rr.roleId);
      abac.push({
        id: rr.role.id,
        code: rr.role.code,
        name: rr.role.name,
        source: 'ATTRIBUTE_RULE',
        assignedAt: rr.updatedAt.toISOString(),
        assignedByUserId: null,
        matchedRuleId: rr.id,
        matchedConditionSet: {
          conditionSets: rr.conditionSets.map((cs) => ({
            conditions: cs.conditions.map((c) => ({
              attributeKey: c.attributeKey,
              operator: c.operator,
              value: c.value,
            })),
          })),
        },
      });
    }

    return [...direct, ...abac];
  }

  async getUserSessions(id: string): Promise<Record<string, unknown>[]> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException();

    const sessions = await this.prisma.session.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return sessions.map((s) => ({
      id: s.id,
      status: s.status,
      ipHash: s.ipHash,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      lastActiveAt: s.lastActiveAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
      revocationReason: s.revocationReason,
    }));
  }

  async revokeSession(userId: string, sessionId: string, actor: AuthenticatedUser): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserNotFoundException();

    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new UserNotFoundException();

    if (session.status === 'ACTIVE') {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { status: 'REVOKED', revokedAt: new Date(), revocationReason: 'ADMIN_REVOKED' },
      });
      await this.redis.raw.del(`csrf:${sessionId}`);
    }

    await this.audit.append({
      userId: actor.id,
      action: 'REVOKE_USER_SESSION',
      entity: 'session',
      entityId: sessionId,
      ipHash: 'api',
      metadata: { targetUserId: userId },
    });
  }

  async revokeAllSessions(userId: string, actor: AuthenticatedUser): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserNotFoundException();

    const activeSessions = await this.prisma.session.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { id: true },
    });

    await this.prisma.session.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date(), revocationReason: 'ADMIN_REVOKED' },
    });

    const pipeline = this.redis.raw.pipeline();
    for (const { id } of activeSessions) {
      pipeline.del(`csrf:${id}`);
    }
    await pipeline.exec();

    await this.audit.append({
      userId: actor.id,
      action: 'REVOKE_ALL_USER_SESSIONS',
      entity: 'user',
      entityId: userId,
      ipHash: 'api',
      metadata: { revokedCount: activeSessions.length },
    });
  }
}
