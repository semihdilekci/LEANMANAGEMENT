import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Permission } from '@leanmgmt/shared-types';
import {
  AssignUserToRoleSchema,
  CreateRoleRuleSchema,
  CreateRoleSchema,
  PatchRoleRuleSchema,
  RoleListQuerySchema,
  RoleRuleTestBodySchema,
  UpdateRolePermissionsSchema,
  UpdateRoleSchema,
  RoleUsersListQuerySchema,
} from '@leanmgmt/shared-schemas';
import type {
  AssignUserToRoleInput,
  CreateRoleInput,
  CreateRoleRuleInput,
  PatchRoleRuleInput,
  RoleListQuery,
  RoleRuleTestBodyInput,
  UpdateRoleInput,
  UpdateRolePermissionsInput,
  RoleUsersListQuery,
} from '@leanmgmt/shared-schemas';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RolePermissionManagementService } from './role-permission-management.service.js';
import { RoleRulesService } from './role-rules.service.js';
import { RolesService } from './roles.service.js';

@Controller('roles')
export class RolesController {
  constructor(
    @Inject(RolePermissionManagementService)
    private readonly rolePermissionManagement: RolePermissionManagementService,
    @Inject(RolesService) private readonly rolesService: RolesService,
    @Inject(RoleRulesService) private readonly roleRulesService: RoleRulesService,
  ) {}

  @Get()
  @RequirePermission(Permission.ROLE_VIEW)
  async list(@Query(createZodValidationPipe(RoleListQuerySchema)) query: RoleListQuery) {
    return this.rolesService.findMany(query);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(Permission.ROLE_CREATE)
  async create(
    @Body(createZodValidationPipe(CreateRoleSchema)) body: CreateRoleInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.create(body, actor);
  }

  @Get(':id')
  @RequirePermission(Permission.ROLE_VIEW)
  async findById(@Param('id') roleId: string) {
    return this.rolesService.findById(roleId);
  }

  @Patch(':id')
  @RequirePermission(Permission.ROLE_UPDATE)
  async update(
    @Param('id') roleId: string,
    @Body(createZodValidationPipe(UpdateRoleSchema)) body: UpdateRoleInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.update(roleId, body, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(Permission.ROLE_DELETE)
  async delete(
    @Param('id') roleId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.rolesService.delete(roleId, actor);
  }

  @Get(':id/permissions')
  @RequirePermission(Permission.ROLE_VIEW)
  async getRolePermissions(@Param('id') roleId: string) {
    return this.rolesService.getRolePermissions(roleId);
  }

  @Put(':id/permissions')
  @RequirePermission(Permission.ROLE_PERMISSION_MANAGE)
  async replaceRolePermissions(
    @Param('id') roleId: string,
    @Body(createZodValidationPipe(UpdateRolePermissionsSchema)) body: UpdateRolePermissionsInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolePermissionManagement.replaceRolePermissions(roleId, body, actor);
  }

  @Get(':id/users')
  @RequirePermission(Permission.ROLE_VIEW)
  async listRoleUsers(
    @Param('id') roleId: string,
    @Query(createZodValidationPipe(RoleUsersListQuerySchema)) query: RoleUsersListQuery,
  ) {
    return this.rolesService.listRoleUsers(roleId, query);
  }

  @Post(':id/users')
  @HttpCode(201)
  @RequirePermission(Permission.ROLE_ASSIGN)
  async assignUser(
    @Param('id') roleId: string,
    @Body(createZodValidationPipe(AssignUserToRoleSchema)) body: AssignUserToRoleInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.assignUserToRole(roleId, body, actor);
  }

  @Delete(':id/users/:userId')
  @HttpCode(204)
  @RequirePermission(Permission.ROLE_ASSIGN)
  async unassignUser(
    @Param('id') roleId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.rolesService.unassignUserFromRole(roleId, userId, actor);
  }

  @Get(':id/rules')
  @RequirePermission(Permission.ROLE_VIEW)
  async listRules(@Param('id') roleId: string) {
    return this.roleRulesService.listRules(roleId);
  }

  @Post(':id/rules/test')
  @RequirePermission(Permission.ROLE_RULE_MANAGE)
  async testRule(
    @Param('id') roleId: string,
    @Body(createZodValidationPipe(RoleRuleTestBodySchema)) body: RoleRuleTestBodyInput,
  ) {
    return this.roleRulesService.testDraft(roleId, body);
  }

  @Post(':id/rules')
  @HttpCode(201)
  @RequirePermission(Permission.ROLE_RULE_MANAGE)
  async createRule(
    @Param('id') roleId: string,
    @Body(createZodValidationPipe(CreateRoleRuleSchema)) body: CreateRoleRuleInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.roleRulesService.createRule(roleId, body, actor);
  }

  @Patch(':id/rules/:ruleId')
  @RequirePermission(Permission.ROLE_RULE_MANAGE)
  async patchRule(
    @Param('id') roleId: string,
    @Param('ruleId') ruleId: string,
    @Body(createZodValidationPipe(PatchRoleRuleSchema)) body: PatchRoleRuleInput,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.roleRulesService.patchRule(roleId, ruleId, body, actor);
  }

  @Delete(':id/rules/:ruleId')
  @HttpCode(204)
  @RequirePermission(Permission.ROLE_RULE_MANAGE)
  async deleteRule(
    @Param('id') roleId: string,
    @Param('ruleId') ruleId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.roleRulesService.deleteRule(roleId, ruleId, actor);
  }
}
