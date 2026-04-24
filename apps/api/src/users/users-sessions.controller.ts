import { Controller, Delete, Get, HttpCode, Inject, Param } from '@nestjs/common';
import { Permission } from '@leanmgmt/shared-types';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { UsersService } from './users.service.js';

@Controller('users/:id/sessions')
export class UsersSessionsController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission(Permission.USER_SESSION_VIEW)
  async list(@Param('id') id: string) {
    return this.usersService.getUserSessions(id);
  }

  @Delete(':sessionId')
  @HttpCode(204)
  @RequirePermission(Permission.USER_SESSION_REVOKE)
  async revoke(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.usersService.revokeSession(id, sessionId, actor);
  }

  @Delete()
  @HttpCode(204)
  @RequirePermission(Permission.USER_SESSION_REVOKE)
  async revokeAll(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.usersService.revokeAllSessions(id, actor);
  }
}
