import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import {
  AdminConsentVersionCreateBodySchema,
  AdminConsentVersionPatchBodySchema,
  AdminConsentVersionPublishBodySchema,
  ConsentVersionIdParamSchema,
  type AdminConsentVersionCreateBody,
  type AdminConsentVersionPatchBody,
  type AdminConsentVersionPublishBody,
} from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import { Audit } from '../common/decorators/audit.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { ConsentVersionsService } from './consent-versions.service.js';

@Controller('admin/consent-versions')
export class AdminConsentVersionsController {
  constructor(
    @Inject(ConsentVersionsService) private readonly consentVersions: ConsentVersionsService,
  ) {}

  @Get()
  @HttpCode(200)
  @RequirePermission(Permission.CONSENT_VERSION_VIEW)
  async list() {
    return this.consentVersions.adminList();
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission(Permission.CONSENT_VERSION_VIEW)
  async getById(@Param('id', createZodValidationPipe(ConsentVersionIdParamSchema)) id: string) {
    return this.consentVersions.adminGetById(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(Permission.CONSENT_VERSION_EDIT)
  @Audit('CREATE_CONSENT_VERSION', 'consent_version')
  async create(
    @Body(createZodValidationPipe(AdminConsentVersionCreateBodySchema))
    body: AdminConsentVersionCreateBody,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.consentVersions.adminCreate(body, actor);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission(Permission.CONSENT_VERSION_EDIT)
  @Audit('UPDATE_CONSENT_VERSION', 'consent_version')
  async patch(
    @Param('id', createZodValidationPipe(ConsentVersionIdParamSchema)) id: string,
    @Body(createZodValidationPipe(AdminConsentVersionPatchBodySchema))
    body: AdminConsentVersionPatchBody,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.consentVersions.adminPatch(id, body, actor);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermission(Permission.CONSENT_VERSION_PUBLISH)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Audit('PUBLISH_CONSENT_VERSION', 'consent_version')
  async publish(
    @Param('id', createZodValidationPipe(ConsentVersionIdParamSchema)) id: string,
    @Body(createZodValidationPipe(AdminConsentVersionPublishBodySchema))
    body: AdminConsentVersionPublishBody,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.consentVersions.adminPublish(id, body, actor);
  }
}
