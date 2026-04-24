import { Controller, Get, HttpCode, Inject, Param } from '@nestjs/common';

import { ConsentVersionIdParamSchema } from '@leanmgmt/shared-schemas';
import { SkipConsent } from '../common/decorators/skip-consent.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ConsentVersionsService } from './consent-versions.service.js';

@Controller('consent-versions')
export class ConsentVersionsController {
  constructor(
    @Inject(ConsentVersionsService) private readonly consentVersions: ConsentVersionsService,
  ) {}

  @SkipConsent()
  @Get(':id')
  @HttpCode(200)
  async getById(
    @Param('id', createZodValidationPipe(ConsentVersionIdParamSchema)) id: string,
  ): Promise<{
    id: string;
    version: number;
    title: string;
    body: string;
    locale: string;
  }> {
    return this.consentVersions.getActivePublishedById(id);
  }
}
