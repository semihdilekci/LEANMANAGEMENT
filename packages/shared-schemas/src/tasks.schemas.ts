import { z } from 'zod';

const TASK_LIST_TAB = ['started', 'pending', 'completed'] as const;
const PROCESS_TYPE_FILTER = ['BEFORE_AFTER_KAIZEN'] as const;

/** docs/03_API_CONTRACTS.md §9.6 — GET /api/v1/tasks */
export const TaskListQuerySchema = z
  .object({
    tab: z.enum(TASK_LIST_TAB).default('pending'),
    processType: z.enum(PROCESS_TYPE_FILTER).optional(),
    startedAtFrom: z.string().datetime().optional(),
    startedAtTo: z.string().datetime().optional(),
    search: z.string().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;

const KTI_MANAGER_ACTIONS = ['APPROVE', 'REJECT', 'REQUEST_REVISION'] as const;

/** docs/03_API_CONTRACTS.md §9.6 — POST /api/v1/tasks/:id/complete (gövde iskeleti; adım bazlı ek doğrulama API’de) */
export const TaskCompleteBodySchema = z
  .object({
    action: z.enum(KTI_MANAGER_ACTIONS).optional(),
    reason: z
      .string()
      .min(10, 'Gerekçe en az 10 karakter olmalıdır')
      .max(5000, 'Gerekçe en fazla 5000 karakter olabilir')
      .optional(),
    formData: z.unknown().optional(),
  })
  .strict();

export type TaskCompleteBodyInput = z.infer<typeof TaskCompleteBodySchema>;
