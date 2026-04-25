import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { describe, expect, it, vi } from 'vitest';

import { ProcessListQuerySchema } from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import { AppException } from '../common/exceptions/app.exception.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionResolverService } from '../roles/permission-resolver.service.js';

import { ProcessTypeRegistryService } from './process-type-registry.service.js';
import { ProcessesService } from './processes.service.js';
import { KtiManagerRequiredException } from './processes.exceptions.js';
import { KtiWorkflow } from './workflows/kti.workflow.js';

describe('ProcessesService.startKti', () => {
  it('yönetici yoksa KtiManagerRequiredException fırlatır', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          managerUserId: null,
          companyId: 'company-1',
        }),
      },
    };
    const documentsService = {
      assertKtiPhotoDocumentsCleanAndOwned: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProcessesService,
        { provide: PrismaService, useValue: prisma },
        ProcessTypeRegistryService,
        KtiWorkflow,
        { provide: DocumentsService, useValue: documentsService },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
        { provide: PermissionResolverService, useValue: { hasPermission: vi.fn() } },
        { provide: EncryptionService, useValue: { decryptSicil: vi.fn() } },
      ],
    }).compile();
    const service = moduleRef.get(ProcessesService);
    await expect(
      service.startKti(
        {
          companyId: 'company-1',
          beforePhotoDocumentIds: ['a'],
          afterPhotoDocumentIds: ['b'],
          savingAmount: 0,
          description: 'Test açıklaması on karakter uzunluğunda olmalıdır.',
        },
        { id: 'user-1', sessionId: 's', jti: 'j' },
      ),
    ).rejects.toThrow(KtiManagerRequiredException);
    expect(documentsService.assertKtiPhotoDocumentsCleanAndOwned).not.toHaveBeenCalled();
  });
});

describe('ProcessesService.findManyForActor', () => {
  it('scope=admin ve PROCESS_VIEW_ALL yoksa PERMISSION_DENIED', async () => {
    const prisma = { process: { findMany: vi.fn() } };
    const permissionResolver = { hasPermission: vi.fn().mockResolvedValue(false) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProcessesService,
        { provide: PrismaService, useValue: prisma },
        ProcessTypeRegistryService,
        KtiWorkflow,
        { provide: DocumentsService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
        { provide: PermissionResolverService, useValue: permissionResolver },
        { provide: EncryptionService, useValue: { decryptSicil: vi.fn() } },
      ],
    }).compile();
    const service = moduleRef.get(ProcessesService);
    const query = ProcessListQuerySchema.parse({
      scope: 'admin',
      status: 'all',
      limit: 20,
      sort: 'started_at_desc',
    });
    await expect(
      service.findManyForActor(query, { id: 'u1', sessionId: 's', jti: 'j' }),
    ).rejects.toThrow(AppException);
    await expect(
      service.findManyForActor(query, { id: 'u1', sessionId: 's', jti: 'j' }),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    expect(permissionResolver.hasPermission).toHaveBeenCalledWith(
      'u1',
      Permission.PROCESS_VIEW_ALL,
    );
    expect(prisma.process.findMany).not.toHaveBeenCalled();
  });
});
