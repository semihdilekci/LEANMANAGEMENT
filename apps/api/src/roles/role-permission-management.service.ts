import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { UpdateRolePermissionsInput } from '@leanmgmt/shared-schemas';

import { AuditLogService } from '../common/audit/audit-log.service.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

import {
  PERMISSION_CACHE_EVENT,
  type RoleAffectsUserPermissionsCachePayload,
} from './permission-cache.events.js';
import { PermissionResolverService } from './permission-resolver.service.js';
import {
  RoleNotFoundException,
  RolePermissionSelfEditForbiddenException,
} from './roles.exceptions.js';

@Injectable()
export class RolePermissionManagementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
    @Inject(AuditLogService) private readonly audit: AuditLogService,
    @Inject(EventEmitter2) private readonly events: EventEmitter2,
  ) {}

  /**
   * docs/03 — toplu replace + transaction. Self-edit: mevcut yetkiler, yeni kümede yoksa 403
   */
  async replaceRolePermissions(
    roleId: string,
    input: UpdateRolePermissionsInput,
    actor: AuthenticatedUser,
  ): Promise<{ permissionKeys: string[] }> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, isActive: true },
    });
    if (!role) throw new RoleNotFoundException();

    const newKeys = [...new Set(input.permissionKeys.map((k) => String(k)))];

    const before = await this.getPermissionKeysForRole(roleId);
    const proposed = await this.permissionResolver.projectPermissionsForUserWithRoleOverride(
      actor.id,
      roleId,
      newKeys,
    );
    const current = await this.permissionResolver.getUserPermissions(actor.id);
    for (const p of current) {
      if (!proposed.has(p)) {
        throw new RolePermissionSelfEditForbiddenException();
      }
    }

    const permissionRows = newKeys.map((key) => ({
      roleId,
      permissionKey: key,
      grantedByUserId: actor.id,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionRows.length > 0) {
        await tx.rolePermission.createMany({ data: permissionRows });
      }
    });

    await this.permissionResolver.invalidateRole(roleId);
    this.events.emit(PERMISSION_CACHE_EVENT.ROLE_AFFECTS_USER_PERMISSIONS, {
      roleId,
    } satisfies RoleAffectsUserPermissionsCachePayload);

    await this.audit.append({
      userId: actor.id,
      action: 'UPDATE_ROLE_PERMISSIONS',
      entity: 'role',
      entityId: roleId,
      ipHash: 'api',
      metadata: {
        oldPermissionKeys: before,
        newPermissionKeys: newKeys,
      } as const,
    });

    return { permissionKeys: newKeys };
  }

  private async getPermissionKeysForRole(roleId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionKey: true },
      orderBy: { permissionKey: 'asc' },
    });
    return rows.map((r) => r.permissionKey);
  }
}
