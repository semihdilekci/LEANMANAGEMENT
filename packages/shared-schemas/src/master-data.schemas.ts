import { z } from 'zod';

export const MASTER_DATA_TYPES = [
  'companies',
  'locations',
  'departments',
  'levels',
  'positions',
  'teams',
  'work-areas',
  'work-sub-areas',
] as const;

export type MasterDataType = (typeof MASTER_DATA_TYPES)[number];

export const MasterDataTypeParamSchema = z.enum(MASTER_DATA_TYPES);

export const CreateMasterDataSchema = z
  .object({
    code: z.string().min(2).max(32),
    name: z.string().min(1).max(200),
    /** Yalnız work-sub-areas için gerekli */
    parentWorkAreaCode: z.string().min(1).max(32).optional(),
  })
  .strict();

export type CreateMasterDataInput = z.infer<typeof CreateMasterDataSchema>;

export const UpdateMasterDataSchema = z
  .object({
    name: z.string().min(1).max(200),
  })
  .strict();

export type UpdateMasterDataInput = z.infer<typeof UpdateMasterDataSchema>;

export const MasterDataListQuerySchema = z
  .object({
    isActive: z.enum(['true', 'false', 'all']).default('all'),
    search: z.string().max(100).optional(),
    usageFilter: z.enum(['all', 'in-use', 'unused']).default('all'),
  })
  .strict();

export type MasterDataListQuery = z.infer<typeof MasterDataListQuerySchema>;

export const MasterDataIdParamSchema = z.object({ id: z.string().min(1) }).strict();
export type MasterDataIdParam = z.infer<typeof MasterDataIdParamSchema>;

export const MasterDataPaginationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
  })
  .strict();

export type MasterDataPaginationQuery = z.infer<typeof MasterDataPaginationQuerySchema>;
