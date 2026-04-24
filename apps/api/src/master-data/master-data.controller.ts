import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { Permission } from '@leanmgmt/shared-types';

import type {
  CreateMasterDataInput,
  MasterDataListQuery,
  MasterDataPaginationQuery,
  UpdateMasterDataInput,
} from '@leanmgmt/shared-schemas';
import {
  CreateMasterDataSchema,
  MasterDataListQuerySchema,
  MasterDataPaginationQuerySchema,
  UpdateMasterDataSchema,
} from '@leanmgmt/shared-schemas';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { MasterDataService } from './master-data.service.js';

@Controller('master-data/:type')
export class MasterDataController {
  constructor(@Inject(MasterDataService) private readonly masterDataService: MasterDataService) {}

  @Get()
  @RequirePermission(Permission.MASTER_DATA_MANAGE)
  async list(
    @Param('type') type: string,
    @Query(createZodValidationPipe(MasterDataListQuerySchema)) query: MasterDataListQuery,
  ) {
    return this.masterDataService.findAll(type, query);
  }

  @Post()
  @RequirePermission(Permission.MASTER_DATA_MANAGE)
  async create(
    @Param('type') type: string,
    @Body(createZodValidationPipe(CreateMasterDataSchema)) dto: CreateMasterDataInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.masterDataService.create(type, dto, actor);
  }

  @Get(':id')
  @RequirePermission(Permission.MASTER_DATA_MANAGE)
  async findById(@Param('type') type: string, @Param('id') id: string) {
    return this.masterDataService.findById(type, id);
  }

  @Patch(':id')
  @RequirePermission(Permission.MASTER_DATA_MANAGE)
  async update(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body(createZodValidationPipe(UpdateMasterDataSchema)) dto: UpdateMasterDataInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.masterDataService.update(type, id, dto, actor);
  }

  @Post(':id/deactivate')
  @HttpCode(204)
  @RequirePermission(Permission.MASTER_DATA_MANAGE)
  async deactivate(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.masterDataService.deactivate(type, id, actor);
  }

  @Post(':id/reactivate')
  @HttpCode(204)
  @RequirePermission(Permission.MASTER_DATA_MANAGE)
  async reactivate(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.masterDataService.reactivate(type, id, actor);
  }

  @Get(':id/users')
  @RequirePermission(Permission.MASTER_DATA_MANAGE)
  async getUsers(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query(createZodValidationPipe(MasterDataPaginationQuerySchema))
    query: MasterDataPaginationQuery,
  ) {
    return this.masterDataService.getUsersForRecord(type, id, query);
  }
}
