import { z } from 'zod';

/** docs/03_API_CONTRACTS.md §9.2 — sicil 8 haneli numerik */
const SicilSchema = z.string().regex(/^\d{8}$/, 'Sicil numarası 8 haneli rakamdan oluşmalıdır');

/** TR mobil format */
const PhoneSchema = z
  .string()
  .regex(/^(\+90|0)?5\d{9}$/, 'Geçerli bir Türkiye cep telefonu numarası giriniz')
  .optional();

const EmployeeTypeSchema = z.enum(['WHITE_COLLAR', 'BLUE_COLLAR', 'INTERN']);

export const CreateUserSchema = z
  .object({
    sicil: SicilSchema,
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z
      .string()
      .email()
      .max(254)
      .transform((e) => e.toLowerCase().trim()),
    phone: PhoneSchema,
    employeeType: EmployeeTypeSchema,
    companyId: z.string().min(1),
    locationId: z.string().min(1),
    departmentId: z.string().min(1),
    positionId: z.string().min(1),
    levelId: z.string().min(1),
    teamId: z.string().min(1).nullable().optional(),
    workAreaId: z.string().min(1),
    workSubAreaId: z.string().min(1).nullable().optional(),
    managerUserId: z.string().min(1).nullable().optional(),
    hireDate: z.string().date('Geçerli bir tarih giriniz (YYYY-MM-DD)').nullable().optional(),
  })
  .strict();

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

/** sicil güncellenemez — planla uyumlu */
export const UpdateUserSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    email: z
      .string()
      .email()
      .max(254)
      .transform((e) => e.toLowerCase().trim())
      .optional(),
    phone: PhoneSchema,
    employeeType: EmployeeTypeSchema.optional(),
    companyId: z.string().min(1).optional(),
    locationId: z.string().min(1).optional(),
    departmentId: z.string().min(1).optional(),
    positionId: z.string().min(1).optional(),
    levelId: z.string().min(1).optional(),
    teamId: z.string().min(1).nullable().optional(),
    workAreaId: z.string().min(1).optional(),
    workSubAreaId: z.string().min(1).nullable().optional(),
    managerUserId: z.string().min(1).nullable().optional(),
    hireDate: z.string().date('Geçerli bir tarih giriniz (YYYY-MM-DD)').nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'En az bir alan güncellenmelidir',
  });

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

const ALLOWED_SORT_VALUES = ['sicil_asc', 'last_name_asc', 'created_at_desc'] as const;

export const UserListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
    search: z.string().max(100).optional(),
    companyId: z.string().optional(),
    locationId: z.string().optional(),
    departmentId: z.string().optional(),
    positionId: z.string().optional(),
    levelId: z.string().optional(),
    employeeType: EmployeeTypeSchema.optional(),
    isActive: z.enum(['true', 'false', 'all']).default('true'),
    sort: z.enum(ALLOWED_SORT_VALUES).default('last_name_asc'),
  })
  .strict();

export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export const UserIdParamSchema = z.object({ id: z.string().min(1) }).strict();
export type UserIdParam = z.infer<typeof UserIdParamSchema>;

export const UserDeactivateSchema = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .strict();

export type UserDeactivateInput = z.infer<typeof UserDeactivateSchema>;

export const UserReactivateSchema = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .strict();

export type UserReactivateInput = z.infer<typeof UserReactivateSchema>;

export const UserAnonymizeSchema = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .strict();

export type UserAnonymizeInput = z.infer<typeof UserAnonymizeSchema>;
