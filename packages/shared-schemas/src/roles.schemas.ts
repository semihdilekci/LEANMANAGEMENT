import {
  Permission,
  RoleRuleAttributeKey,
  RoleRuleConditionOperator,
} from '@leanmgmt/shared-types';
import { z } from 'zod';

const ROLE_RULE_ATTRIBUTE_KEYS = [
  RoleRuleAttributeKey.COMPANY_ID,
  RoleRuleAttributeKey.LOCATION_ID,
  RoleRuleAttributeKey.DEPARTMENT_ID,
  RoleRuleAttributeKey.POSITION_ID,
  RoleRuleAttributeKey.LEVEL_ID,
  RoleRuleAttributeKey.TEAM_ID,
  RoleRuleAttributeKey.WORK_AREA_ID,
  RoleRuleAttributeKey.WORK_SUB_AREA_ID,
  RoleRuleAttributeKey.EMPLOYEE_TYPE,
] as const;

const ROLE_RULE_OPERATORS = [
  RoleRuleConditionOperator.EQUALS,
  RoleRuleConditionOperator.NOT_EQUALS,
  RoleRuleConditionOperator.CONTAINS,
  RoleRuleConditionOperator.IN,
  RoleRuleConditionOperator.NOT_IN,
  RoleRuleConditionOperator.STARTS_WITH,
  RoleRuleConditionOperator.ENDS_WITH,
] as const;

/** docs/03_API_CONTRACTS.md — PUT /roles/:id/permissions */
export const UpdateRolePermissionsSchema = z
  .object({
    permissionKeys: z.array(z.nativeEnum(Permission)),
  })
  .strict();

export type UpdateRolePermissionsInput = z.infer<typeof UpdateRolePermissionsSchema>;

export const RoleIdParamSchema = z.object({
  id: z.string().min(1),
});

export type RoleIdParam = z.infer<typeof RoleIdParamSchema>;

/** docs/03 — POST /roles/:id/users */
export const AssignUserToRoleSchema = z
  .object({
    userId: z.string().min(1),
  })
  .strict();

export type AssignUserToRoleInput = z.infer<typeof AssignUserToRoleSchema>;

export const UserIdInRoleParamSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});

export type UserIdInRoleParam = z.infer<typeof UserIdInRoleParamSchema>;

export const RoleRuleIdParamSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
});

export type RoleRuleIdParam = z.infer<typeof RoleRuleIdParamSchema>;

/** PATCH /roles/:id/rules/:ruleId — isActive-only (hızlı toggle) */
export const UpdateRoleRuleActiveSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export type UpdateRoleRuleActiveInput = z.infer<typeof UpdateRoleRuleActiveSchema>;

const roleRuleAttributeKeySchema = z.enum(ROLE_RULE_ATTRIBUTE_KEYS);

const roleRuleConditionOperatorSchema = z.enum(ROLE_RULE_OPERATORS);

const roleRuleConditionValueSchema = z.union([z.string(), z.array(z.string().min(1))]);

export const RoleRuleConditionInputSchema = z
  .object({
    attributeKey: roleRuleAttributeKeySchema,
    operator: roleRuleConditionOperatorSchema,
    value: roleRuleConditionValueSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const multi =
      data.operator === RoleRuleConditionOperator.IN ||
      data.operator === RoleRuleConditionOperator.NOT_IN;
    if (multi && !Array.isArray(data.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'IN ve NOT_IN için değer dizi olmalı',
        path: ['value'],
      });
    }
    if (!multi && Array.isArray(data.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bu operatör için değer tek string olmalı',
        path: ['value'],
      });
    }
  });

export type RoleRuleConditionInput = z.infer<typeof RoleRuleConditionInputSchema>;

export const RoleRuleConditionSetInputSchema = z
  .object({
    conditions: z.array(RoleRuleConditionInputSchema).min(1),
  })
  .strict();

export type RoleRuleConditionSetInput = z.infer<typeof RoleRuleConditionSetInputSchema>;

/** POST /roles/:id/rules — yeni kural */
export const CreateRoleRuleSchema = z
  .object({
    order: z.number().int().min(0).optional(),
    conditionSets: z.array(RoleRuleConditionSetInputSchema).min(1),
  })
  .strict();

export type CreateRoleRuleInput = z.infer<typeof CreateRoleRuleSchema>;

/** PATCH /roles/:id/rules/:ruleId — tam yapı ve/veya isActive/order */
export const PatchRoleRuleSchema = z
  .object({
    isActive: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
    conditionSets: z.array(RoleRuleConditionSetInputSchema).min(1).optional(),
  })
  .strict()
  .refine(
    (d) => d.isActive !== undefined || d.order !== undefined || d.conditionSets !== undefined,
    {
      message: 'En az bir alan gerekli',
    },
  );

export type PatchRoleRuleInput = z.infer<typeof PatchRoleRuleSchema>;

/** POST /roles/:id/rules/test */
export const RoleRuleTestBodySchema = z
  .object({
    conditionSets: z.array(RoleRuleConditionSetInputSchema).min(1),
  })
  .strict();

export type RoleRuleTestBodyInput = z.infer<typeof RoleRuleTestBodySchema>;

/** GET /roles */
export const RoleListQuerySchema = z
  .object({
    isActive: z.enum(['true', 'false', 'all']).optional(),
    isSystem: z.enum(['true', 'false', 'all']).optional(),
    search: z.string().max(200).optional(),
  })
  .strict();

export type RoleListQuery = z.infer<typeof RoleListQuerySchema>;

/** POST /roles */
export const CreateRoleSchema = z
  .object({
    code: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[A-Z][A-Z0-9_]+$/, 'Kod büyük harf ile başlamalı ve yalnız A-Z, 0-9, _ içermeli'),
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
  })
  .strict();

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;

/** PATCH /roles/:id */
export const UpdateRoleSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
  })
  .strict()
  .refine((d) => d.name !== undefined || d.description !== undefined, {
    message: 'En az name veya description gönderilmeli',
  });

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;

/** GET /roles/:id/users */
export const RoleUsersListQuerySchema = z
  .object({
    source: z.enum(['direct', 'attribute_rule', 'all']).default('all'),
    search: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().optional(),
  })
  .strict();

export type RoleUsersListQuery = z.infer<typeof RoleUsersListQuerySchema>;
