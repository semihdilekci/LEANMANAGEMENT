import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  PERMISSION_CACHE_EVENT,
  type UserPermissionCacheInvalidatePayload,
} from './permission-cache.events.js';
import { PermissionResolverService } from './permission-resolver.service.js';

/**
 * Kullanıcı alanındaki değişimde yetki cache — deferred; rol toplu güncellemeleri doğrudan await invalidateRole
 */
@Injectable()
export class RoleCacheInvalidationListener {
  private readonly logger = new Logger(RoleCacheInvalidationListener.name);

  constructor(
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  @OnEvent(PERMISSION_CACHE_EVENT.USER_INVALIDATE, { async: true })
  async onUserPermissionCacheInvalidate(
    payload: UserPermissionCacheInvalidatePayload,
  ): Promise<void> {
    try {
      await this.permissionResolver.invalidateUser(payload.userId);
    } catch (err) {
      this.logErr('user_cache_invalidate', err, { userId: payload.userId });
    }
  }

  private logErr(event: string, err: unknown, ctx: Record<string, string>): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn({ event, ...ctx, message });
  }
}
