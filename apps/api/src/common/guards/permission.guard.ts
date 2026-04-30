import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import type { Permission } from '@leanmgmt/shared-types';

import { ANY_PERMISSIONS_KEY } from '../decorators/require-any-permission.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator.js';
import { AppException } from '../exceptions/app.exception.js';
import { PermissionResolverService } from '../../roles/permission-resolver.service.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const anyRequired = this.reflector.getAllAndOverride<Permission[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!anyRequired?.length && !required?.length) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: { id: string } }>();
    const user = request.user;
    if (!user) {
      throw new AppException('PERMISSION_DENIED', 'Bu işlem için yetkiniz bulunmamaktadır.', 403);
    }

    const permissions = await this.permissionResolver.getUserPermissions(user.id);

    if (anyRequired?.length) {
      const hasOne = anyRequired.some((p) => permissions.has(p));
      if (!hasOne) {
        throw new AppException(
          'PERMISSION_DENIED',
          'Bu işlem için yetkiniz bulunmamaktadır.',
          403,
          {
            required: anyRequired,
            mode: 'any',
          },
        );
      }
      return true;
    }

    const missing = (required ?? []).filter((p) => !permissions.has(p));

    if (missing.length > 0) {
      throw new AppException('PERMISSION_DENIED', 'Bu işlem için yetkiniz bulunmamaktadır.', 403, {
        required,
        missing,
      });
    }

    return true;
  }
}
