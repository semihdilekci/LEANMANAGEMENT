import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Permission } from '@leanmgmt/shared-types';

import {
  type KtiStartInput,
  type ProcessCancelInput,
  type ProcessListQuery,
  type ProcessRollbackInput,
  KtiStartBodySchema,
  ProcessCancelBodySchema,
  ProcessListQuerySchema,
  ProcessRollbackBodySchema,
} from '@leanmgmt/shared-schemas';

import { Audit } from '../common/decorators/audit.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { ProcessesService } from './processes.service.js';

@Controller('processes')
export class ProcessesController {
  constructor(@Inject(ProcessesService) private readonly processesService: ProcessesService) {}

  @Get()
  async list(
    @Query(createZodValidationPipe(ProcessListQuerySchema)) query: ProcessListQuery,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.processesService.findManyForActor(query, actor);
  }

  @Get(':displayId')
  async detail(@Param('displayId') displayId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.processesService.findByDisplayIdForActor(displayId, actor);
  }

  @Post('kti/start')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.PROCESS_KTI_START)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Audit('START_PROCESS', 'process')
  async startKti(
    @Body(createZodValidationPipe(KtiStartBodySchema)) body: KtiStartInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.processesService.startKti(body, actor);
  }

  @Post(':displayId/cancel')
  @HttpCode(204)
  @RequirePermission(Permission.PROCESS_CANCEL)
  @Audit('CANCEL_PROCESS', 'process')
  async cancel(
    @Param('displayId') displayId: string,
    @Body(createZodValidationPipe(ProcessCancelBodySchema)) body: ProcessCancelInput,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.processesService.cancelByDisplayId(displayId, body, actor);
  }

  @Post(':displayId/rollback')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.PROCESS_ROLLBACK)
  @Audit('ROLLBACK_PROCESS', 'process')
  async rollback(
    @Param('displayId') displayId: string,
    @Body(createZodValidationPipe(ProcessRollbackBodySchema)) body: ProcessRollbackInput,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{
    newActiveTaskId: string;
    newActiveTaskStepKey: string;
    rolledBackFromStepOrder: number;
  }> {
    return this.processesService.rollbackByDisplayId(displayId, body, actor);
  }
}
