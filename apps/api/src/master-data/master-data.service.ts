import { Inject, Injectable, Logger } from '@nestjs/common';

import type {
  CreateMasterDataInput,
  MasterDataListQuery,
  MasterDataPaginationQuery,
  MasterDataType,
  UpdateMasterDataInput,
} from '@leanmgmt/shared-schemas';

import { AuditLogService } from '../common/audit/audit-log.service.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import {
  MasterDataCodeDuplicateException,
  MasterDataCodeImmutableException,
  MasterDataInUseByUsersException,
  MasterDataParentInactiveException,
  MasterDataRecordNotFoundException,
  MasterDataUnknownTypeException,
} from './master-data.exceptions.js';

type SingularEntityName =
  | 'company'
  | 'location'
  | 'department'
  | 'level'
  | 'position'
  | 'team'
  | 'work_area'
  | 'work_sub_area';

const TYPE_TO_MODEL: Record<MasterDataType, string> = {
  companies: 'company',
  locations: 'location',
  departments: 'department',
  levels: 'level',
  positions: 'position',
  teams: 'team',
  'work-areas': 'workArea',
  'work-sub-areas': 'workSubArea',
};

const TYPE_TO_SINGULAR: Record<MasterDataType, SingularEntityName> = {
  companies: 'company',
  locations: 'location',
  departments: 'department',
  levels: 'level',
  positions: 'position',
  teams: 'team',
  'work-areas': 'work_area',
  'work-sub-areas': 'work_sub_area',
};

const TYPE_TO_USER_FK: Record<MasterDataType, string> = {
  companies: 'companyId',
  locations: 'locationId',
  departments: 'departmentId',
  levels: 'levelId',
  positions: 'positionId',
  teams: 'teamId',
  'work-areas': 'workAreaId',
  'work-sub-areas': 'workSubAreaId',
};

const VALID_TYPES = new Set<string>([
  'companies',
  'locations',
  'departments',
  'levels',
  'positions',
  'teams',
  'work-areas',
  'work-sub-areas',
]);

function assertValidType(type: string): asserts type is MasterDataType {
  if (!VALID_TYPES.has(type)) {
    throw new MasterDataUnknownTypeException(type);
  }
}

@Injectable()
export class MasterDataService {
  private readonly logger = new Logger(MasterDataService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly audit: AuditLogService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
  ) {}

  private getModel(type: MasterDataType) {
    const modelName = TYPE_TO_MODEL[type];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any)[modelName] as {
      findMany: (args: unknown) => Promise<unknown[]>;
      findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
      create: (args: unknown) => Promise<Record<string, unknown>>;
      update: (args: unknown) => Promise<Record<string, unknown>>;
      count: (args: unknown) => Promise<number>;
    };
  }

  private async countUsersForRecord(type: MasterDataType, id: string): Promise<number> {
    const fk = TYPE_TO_USER_FK[type];
    return this.prisma.user.count({
      where: { [fk]: id, isActive: true },
    });
  }

  private async serializeItem(
    type: MasterDataType,
    item: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const usersCount = await this.countUsersForRecord(type, item['id'] as string);
    const base: Record<string, unknown> = {
      id: item['id'],
      code: item['code'],
      name: item['name'],
      isActive: item['isActive'],
      usersCount,
      createdAt:
        item['createdAt'] instanceof Date ? item['createdAt'].toISOString() : item['createdAt'],
      updatedAt:
        item['updatedAt'] instanceof Date ? item['updatedAt'].toISOString() : item['updatedAt'],
    };
    if (type === 'work-sub-areas') {
      base['parentWorkAreaCode'] = item['parentWorkAreaCode'];
    }
    return base;
  }

  async findAll(type: string, query: MasterDataListQuery): Promise<Record<string, unknown>[]> {
    assertValidType(type);
    const model = this.getModel(type);

    const where: Record<string, unknown> = {};
    if (query.isActive !== 'all') {
      where['isActive'] = query.isActive === 'true';
    }
    if (query.search) {
      where['OR'] = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const items = (await model.findMany({ where, orderBy: { name: 'asc' } })) as Record<
      string,
      unknown
    >[];

    const serialized = await Promise.all(
      items.map((item) => this.serializeItem(type as MasterDataType, item)),
    );

    if (query.usageFilter === 'in-use') {
      return serialized.filter((i) => (i['usersCount'] as number) > 0);
    }
    if (query.usageFilter === 'unused') {
      return serialized.filter((i) => (i['usersCount'] as number) === 0);
    }
    return serialized;
  }

  async findById(type: string, id: string): Promise<Record<string, unknown>> {
    assertValidType(type);
    const model = this.getModel(type);

    const item = (await model.findUnique({ where: { id } })) as Record<string, unknown> | null;
    if (!item) throw new MasterDataRecordNotFoundException();

    return this.serializeItem(type as MasterDataType, item);
  }

  async create(
    type: string,
    dto: CreateMasterDataInput,
    actor: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    assertValidType(type);

    if (type === 'work-sub-areas' && !dto.parentWorkAreaCode) {
      throw new MasterDataParentInactiveException();
    }

    const model = this.getModel(type);

    const existing = await model.findUnique({ where: { code: dto.code } });
    if (existing) throw new MasterDataCodeDuplicateException(dto.code);

    if (type === 'work-sub-areas' && dto.parentWorkAreaCode) {
      const parent = await this.prisma.workArea.findUnique({
        where: { code: dto.parentWorkAreaCode },
        select: { id: true, isActive: true },
      });
      if (!parent) throw new MasterDataRecordNotFoundException();
      if (!parent.isActive) throw new MasterDataParentInactiveException();
    }

    const createData: Record<string, unknown> = {
      code: dto.code,
      name: dto.name,
      createdByUserId: actor.id,
    };
    if (type === 'work-sub-areas' && dto.parentWorkAreaCode) {
      createData['parentWorkAreaCode'] = dto.parentWorkAreaCode;
    }

    const created = (await model.create({ data: createData })) as Record<string, unknown>;

    await this.audit.append({
      userId: actor.id,
      action: 'CREATE_MASTER_DATA',
      entity: TYPE_TO_SINGULAR[type as MasterDataType],
      entityId: created['id'] as string,
      ipHash: 'api',
      metadata: { type, code: dto.code },
    });

    this.logger.log({ event: 'master_data.created', type, id: created['id'], actorId: actor.id });

    return this.serializeItem(type as MasterDataType, created);
  }

  async update(
    type: string,
    id: string,
    dto: UpdateMasterDataInput & { code?: unknown },
    actor: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    assertValidType(type);

    if ('code' in dto) throw new MasterDataCodeImmutableException();

    const model = this.getModel(type);
    const item = await model.findUnique({ where: { id } });
    if (!item) throw new MasterDataRecordNotFoundException();

    const updated = (await model.update({
      where: { id },
      data: { name: dto.name },
    })) as Record<string, unknown>;

    await this.audit.append({
      userId: actor.id,
      action: 'UPDATE_MASTER_DATA',
      entity: TYPE_TO_SINGULAR[type as MasterDataType],
      entityId: id,
      ipHash: 'api',
      metadata: {
        type,
        oldName: String((item as Record<string, unknown>)['name']),
        newName: dto.name,
      },
    });

    return this.serializeItem(type as MasterDataType, updated);
  }

  async deactivate(type: string, id: string, actor: AuthenticatedUser): Promise<void> {
    assertValidType(type);
    const model = this.getModel(type);

    const item = (await model.findUnique({ where: { id } })) as Record<string, unknown> | null;
    if (!item) throw new MasterDataRecordNotFoundException();

    const activeUsersCount = await this.countUsersForRecord(type as MasterDataType, id);
    if (activeUsersCount > 0) throw new MasterDataInUseByUsersException(activeUsersCount);

    const cascadedChildrenIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any)[TYPE_TO_MODEL[type as MasterDataType]].update({
        where: { id },
        data: { isActive: false },
      });

      if (type === 'work-areas') {
        const children = await tx.workSubArea.findMany({
          where: { parentWorkAreaCode: item['code'] as string, isActive: true },
          select: { id: true },
        });
        for (const child of children) {
          await tx.workSubArea.update({ where: { id: child.id }, data: { isActive: false } });
          cascadedChildrenIds.push(child.id);
        }
      }
    });

    await this.audit.append({
      userId: actor.id,
      action: 'DEACTIVATE_MASTER_DATA',
      entity: TYPE_TO_SINGULAR[type as MasterDataType],
      entityId: id,
      ipHash: 'api',
      metadata: {
        type,
        cascaded: cascadedChildrenIds.length > 0,
        cascadedChildrenIds,
      },
    });
  }

  async reactivate(type: string, id: string, actor: AuthenticatedUser): Promise<void> {
    assertValidType(type);
    const model = this.getModel(type);

    const item = (await model.findUnique({ where: { id } })) as Record<string, unknown> | null;
    if (!item) throw new MasterDataRecordNotFoundException();

    if (type === 'work-sub-areas') {
      const parentCode = item['parentWorkAreaCode'] as string | undefined;
      if (parentCode) {
        const parent = await this.prisma.workArea.findUnique({
          where: { code: parentCode },
          select: { isActive: true },
        });
        if (!parent?.isActive) throw new MasterDataParentInactiveException();
      }
    }

    await model.update({ where: { id }, data: { isActive: true } });

    await this.audit.append({
      userId: actor.id,
      action: 'REACTIVATE_MASTER_DATA',
      entity: TYPE_TO_SINGULAR[type as MasterDataType],
      entityId: id,
      ipHash: 'api',
      metadata: { type },
    });
  }

  async getUsersForRecord(
    type: string,
    id: string,
    query: MasterDataPaginationQuery,
  ): Promise<{
    items: Record<string, unknown>[];
    pagination: { nextCursor: string | null; hasMore: boolean };
  }> {
    assertValidType(type);
    const model = this.getModel(type);

    const item = await model.findUnique({ where: { id } });
    if (!item) throw new MasterDataRecordNotFoundException();

    const fk = TYPE_TO_USER_FK[type as MasterDataType];
    const limit = query.limit;

    const users = await this.prisma.user.findMany({
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      where: { [fk]: id, isActive: true },
      orderBy: { lastName: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        sicilEncrypted: true,
        emailEncrypted: true,
        anonymizedAt: true,
        isActive: true,
        position: { select: { code: true, name: true } },
      },
    });

    const hasMore = users.length > limit;
    if (hasMore) users.pop();
    const nextCursor = hasMore ? (users[users.length - 1]?.id ?? null) : null;

    return {
      items: users.map((u) => {
        const anonymized = Boolean(u.anonymizedAt);
        return {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          sicil: anonymized ? null : this.encryption.decryptSicil(u.sicilEncrypted as Buffer),
          email: anonymized ? null : this.encryption.decryptEmail(u.emailEncrypted as Buffer),
          position: u.position ? { code: u.position.code, name: u.position.name } : null,
          isActive: u.isActive,
        };
      }),
      pagination: { nextCursor, hasMore },
    };
  }
}
