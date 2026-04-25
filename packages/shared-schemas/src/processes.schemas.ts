import { z } from 'zod';

const PROCESS_SCOPE = ['my-started', 'admin'] as const;
const PROCESS_LIST_STATUS = [
  'INITIATED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'all',
] as const;
const PROCESS_LIST_SORT = ['started_at_desc', 'started_at_asc'] as const;
const PROCESS_TYPE_FILTER = ['BEFORE_AFTER_KAIZEN'] as const;

/** docs/03_API_CONTRACTS.md §9.5 — GET /api/v1/processes */
export const ProcessListQuerySchema = z
  .object({
    scope: z.enum(PROCESS_SCOPE).default('my-started'),
    status: z.enum(PROCESS_LIST_STATUS).default('all'),
    processType: z.enum(PROCESS_TYPE_FILTER).optional(),
    displayId: z.string().min(1).max(40).optional(),
    startedAtFrom: z.string().datetime().optional(),
    startedAtTo: z.string().datetime().optional(),
    startedByUserId: z.string().min(1).optional(),
    companyId: z.string().min(1).optional(),
    /** Yalnızca scope=admin; CANCELLED süreçleri listeye dahil et (varsayılan: hayır) */
    showCancelled: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
    sort: z.enum(PROCESS_LIST_SORT).default('started_at_desc'),
  })
  .strict();

export type ProcessListQuery = z.infer<typeof ProcessListQuerySchema>;

/** docs/03_API_CONTRACTS.md 9.5 — POST /processes/:displayId/cancel */
export const ProcessCancelBodySchema = z
  .object({
    reason: z
      .string()
      .min(10, 'İptal gerekçesi en az 10 karakter olmalıdır')
      .max(1000, 'İptal gerekçesi en fazla 1000 karakter olabilir'),
  })
  .strict();

export type ProcessCancelInput = z.infer<typeof ProcessCancelBodySchema>;

/** docs/03_API_CONTRACTS.md 9.5 — POST /processes/:displayId/rollback */
export const ProcessRollbackBodySchema = z
  .object({
    targetStepOrder: z.coerce.number().int().min(1, 'Hedef adım en az 1 olmalıdır'),
    reason: z
      .string()
      .min(10, 'Geri alma gerekçesi en az 10 karakter olmalıdır')
      .max(1000, 'Geri alma gerekçesi en fazla 1000 karakter olabilir'),
  })
  .strict();

export type ProcessRollbackInput = z.infer<typeof ProcessRollbackBodySchema>;

/** docs/03_API_CONTRACTS.md — POST /processes/kti/start */
export const KtiStartBodySchema = z
  .object({
    companyId: z.string().min(1, 'Şirket seçimi zorunludur'),
    beforePhotoDocumentIds: z
      .array(z.string().min(1))
      .min(1, 'En az bir önce fotoğraf dokümanı gerekir')
      .max(10, 'Öncesi fotoğraflar en fazla 10 adet olabilir'),
    afterPhotoDocumentIds: z
      .array(z.string().min(1))
      .min(1, 'En az bir sonra fotoğraf dokümanı gerekir')
      .max(10, 'Sonrası fotoğraflar en fazla 10 adet olabilir'),
    savingAmount: z.number().int().nonnegative('Tasarruf tutarı negatif olamaz'),
    description: z
      .string()
      .min(10, 'Açıklama en az 10 karakter olmalıdır')
      .max(5000, 'Açıklama en fazla 5000 karakter olabilir'),
  })
  .strict();

export type KtiStartInput = z.infer<typeof KtiStartBodySchema>;
