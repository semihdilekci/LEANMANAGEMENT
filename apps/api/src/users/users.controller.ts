import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { Permission } from '@leanmgmt/shared-types';

import type {
  CreateUserInput,
  UpdateUserInput,
  UserAnonymizeInput,
  UserDeactivateInput,
  UserListQuery,
  UserReactivateInput,
} from '@leanmgmt/shared-schemas';
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserAnonymizeSchema,
  UserDeactivateSchema,
  UserListQuerySchema,
  UserReactivateSchema,
} from '@leanmgmt/shared-schemas';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission(Permission.USER_LIST_VIEW)
  async list(@Query(createZodValidationPipe(UserListQuerySchema)) query: UserListQuery) {
    return this.usersService.findMany(query);
  }

  @Post()
  @RequirePermission(Permission.USER_CREATE)
  async create(
    @Body(createZodValidationPipe(CreateUserSchema)) dto: CreateUserInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.create(dto, actor);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.findById(id, actor);
  }

  @Patch(':id')
  @RequirePermission(Permission.USER_UPDATE_ATTRIBUTE)
  async update(
    @Param('id') id: string,
    @Body(createZodValidationPipe(UpdateUserSchema)) dto: UpdateUserInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, actor);
  }

  @Post(':id/deactivate')
  @HttpCode(204)
  @RequirePermission(Permission.USER_DEACTIVATE)
  async deactivate(
    @Param('id') id: string,
    @Body(createZodValidationPipe(UserDeactivateSchema)) dto: UserDeactivateInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.usersService.deactivate(id, dto, actor);
  }

  @Post(':id/reactivate')
  @HttpCode(204)
  @RequirePermission(Permission.USER_REACTIVATE)
  async reactivate(
    @Param('id') id: string,
    @Body(createZodValidationPipe(UserReactivateSchema)) dto: UserReactivateInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.usersService.reactivate(id, dto, actor);
  }

  @Post(':id/anonymize')
  @HttpCode(204)
  @RequirePermission(Permission.USER_ANONYMIZE)
  async anonymize(
    @Param('id') id: string,
    @Body(createZodValidationPipe(UserAnonymizeSchema)) dto: UserAnonymizeInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.usersService.anonymize(id, dto, actor);
  }

  @Get(':id/roles')
  @RequirePermission(Permission.USER_LIST_VIEW)
  async getUserRoles(@Param('id') id: string) {
    return this.usersService.getUserRoles(id);
  }
}
