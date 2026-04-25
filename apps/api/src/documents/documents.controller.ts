import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Permission } from '@leanmgmt/shared-types';

import {
  type DocumentCreateInput,
  type DocumentUploadInitiateInput,
  DocumentCreateBodySchema,
  DocumentUploadInitiateBodySchema,
} from '@leanmgmt/shared-schemas';

import { Audit } from '../common/decorators/audit.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { DocumentsService } from './documents.service.js';

@Controller('documents')
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documentsService: DocumentsService) {}

  @Post('upload-initiate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.DOCUMENT_UPLOAD)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async uploadInitiate(
    @Body(createZodValidationPipe(DocumentUploadInitiateBodySchema))
    body: DocumentUploadInitiateInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.documentsService.initiateUpload(body, actor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.DOCUMENT_UPLOAD)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Audit('UPLOAD_DOCUMENT', 'document')
  async createDocument(
    @Body(createZodValidationPipe(DocumentCreateBodySchema)) body: DocumentCreateInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.documentsService.completeUpload(body, actor);
  }

  @Get(':id')
  async getDocument(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.getMeta(actor, id);
  }

  @Get(':id/scan-status')
  @Header('Cache-Control', 'no-store')
  async scanStatus(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.getScanStatus(actor, id);
  }

  @Get(':id/download-url')
  @Throttle({ default: { limit: 50, ttl: 300_000 } })
  async downloadUrl(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.getDownloadUrl(actor, id);
  }
}
