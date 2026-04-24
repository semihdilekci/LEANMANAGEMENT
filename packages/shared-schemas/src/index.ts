import { z } from 'zod';

export {
  ChangePasswordFormSchema,
  ChangePasswordSchema,
  ConsentAcceptSchema,
  ConsentVersionIdParamSchema,
  LoginSchema,
  PasswordPolicySchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  type ChangePasswordFormInput,
  type ChangePasswordInput,
  type ConsentAcceptInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
} from './auth.schemas.js';

export {
  CreateMasterDataSchema,
  MASTER_DATA_TYPES,
  MasterDataIdParamSchema,
  MasterDataListQuerySchema,
  MasterDataPaginationQuerySchema,
  MasterDataTypeParamSchema,
  UpdateMasterDataSchema,
  type CreateMasterDataInput,
  type MasterDataIdParam,
  type MasterDataListQuery,
  type MasterDataPaginationQuery,
  type MasterDataType,
  type UpdateMasterDataInput,
} from './master-data.schemas.js';

export {
  CreateUserSchema,
  UpdateUserSchema,
  UserAnonymizeSchema,
  UserDeactivateSchema,
  UserIdParamSchema,
  UserListQuerySchema,
  UserReactivateSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserAnonymizeInput,
  type UserDeactivateInput,
  type UserIdParam,
  type UserListQuery,
  type UserReactivateInput,
} from './users.schemas.js';

export {
  AssignUserToRoleSchema,
  CreateRoleRuleSchema,
  CreateRoleSchema,
  PatchRoleRuleSchema,
  RoleListQuerySchema,
  RoleRuleTestBodySchema,
  RoleRuleConditionInputSchema,
  RoleRuleConditionSetInputSchema,
  RoleIdParamSchema,
  RoleRuleIdParamSchema,
  RoleUsersListQuerySchema,
  UpdateRolePermissionsSchema,
  UpdateRoleRuleActiveSchema,
  UpdateRoleSchema,
  UserIdInRoleParamSchema,
  type AssignUserToRoleInput,
  type CreateRoleInput,
  type CreateRoleRuleInput,
  type PatchRoleRuleInput,
  type RoleIdParam,
  type RoleListQuery,
  type RoleRuleIdParam,
  type RoleRuleTestBodyInput,
  type RoleRuleConditionInput,
  type RoleRuleConditionSetInput,
  type RoleUsersListQuery,
  type UpdateRoleInput,
  type UpdateRolePermissionsInput,
  type UpdateRoleRuleActiveInput,
  type UserIdInRoleParam,
} from './roles.schemas.js';

/** Ortak Zod şemaları */
export const EmptyObjectSchema = z.object({}).strict();

export type EmptyObjectInput = z.infer<typeof EmptyObjectSchema>;
