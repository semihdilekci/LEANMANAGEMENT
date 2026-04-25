import { z } from 'zod';

/** docs/03_API_CONTRACTS.md §9.2 — sicil 8 haneli numerik */
const SicilSchema = z.string().regex(/^\d{8}$/, 'Sicil numarası 8 haneli rakamdan oluşmalıdır');

const PhoneRequiredSchema = z
  .string()
  .regex(/^(\+90|0)?5\d{9}$/, 'Geçerli bir Türkiye cep telefonu numarası giriniz');

/** PATCH: boş string → null ile telefon kaldırılabilir */
const UpdatePhoneSchema = z.preprocess(
  (v) => (v === '' ? null : v),
  z.union([PhoneRequiredSchema, z.null()]).optional(),
);

const ManagerEmailSchema = z
  .string()
  .email()
  .max(254)
  .transform((e) => e.toLowerCase().trim());

const EmployeeTypeSchema = z.enum(['WHITE_COLLAR', 'BLUE_COLLAR', 'INTERN']);

/** HTML select boş değer → null (opsiyonel FK) */
const optionalFkId = z.preprocess(
  (v) => (v === '' ? null : v),
  z.union([z.string().min(1), z.null()]).optional(),
);

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
    phone: z.preprocess(
      (v) => (v === '' || v === undefined ? undefined : v),
      PhoneRequiredSchema.optional(),
    ),
    employeeType: EmployeeTypeSchema,
    companyId: z.string().min(1),
    locationId: z.string().min(1),
    departmentId: z.string().min(1),
    positionId: z.string().min(1),
    levelId: z.string().min(1),
    teamId: optionalFkId,
    workAreaId: z.string().min(1),
    workSubAreaId: optionalFkId,
    managerUserId: optionalFkId,
    managerEmail: z.preprocess(
      (v) => (v === '' || v === undefined ? undefined : v),
      ManagerEmailSchema.optional(),
    ),
    hireDate: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.string().date('Geçerli bir tarih giriniz (YYYY-MM-DD)').nullable().optional(),
    ),
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
    phone: UpdatePhoneSchema,
    employeeType: EmployeeTypeSchema.optional(),
    companyId: z.string().min(1).optional(),
    locationId: z.string().min(1).optional(),
    departmentId: z.string().min(1).optional(),
    positionId: z.string().min(1).optional(),
    levelId: z.string().min(1).optional(),
    teamId: optionalFkId,
    workAreaId: z.string().min(1).optional(),
    workSubAreaId: optionalFkId,
    managerUserId: optionalFkId,
    managerEmail: z.preprocess(
      (v) => (v === '' ? null : v),
      z.union([ManagerEmailSchema, z.null()]).optional(),
    ),
    hireDate: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().date('Geçerli bir tarih giriniz (YYYY-MM-DD)').nullable().optional(),
    ),
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

/** `GET /api/v1/users/:id/roles` — docs/03 §9.2, S-USER-ROLES */
const UserRoleConditionSchema = z
  .object({
    attributeKey: z.string().min(1),
    operator: z.string().min(1),
    value: z.unknown(),
  })
  .strict();

const UserRoleConditionSetNodeSchema = z
  .object({
    conditions: z.array(UserRoleConditionSchema),
  })
  .strict();

export const UserRoleMatchedConditionSetSchema = z
  .object({
    conditionSets: z.array(UserRoleConditionSetNodeSchema),
  })
  .strict();

export const UserRoleItemSchema = z
  .object({
    id: z.string().min(1),
    code: z.string().min(1),
    name: z.string().min(1),
    source: z.enum(['DIRECT', 'ATTRIBUTE_RULE']),
    assignedAt: z.string().min(1),
    assignedByUserId: z.string().min(1).nullable().optional(),
    matchedRuleId: z.string().min(1).optional(),
    matchedConditionSet: UserRoleMatchedConditionSetSchema.optional(),
  })
  .strict();

export const UserRoleListResponseSchema = z.array(UserRoleItemSchema);

export type UserRoleItem = z.infer<typeof UserRoleItemSchema>;
export type UserRoleMatchedConditionSet = z.infer<typeof UserRoleMatchedConditionSetSchema>;
