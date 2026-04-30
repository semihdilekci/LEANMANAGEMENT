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
  UserRoleItemSchema,
  UserRoleListResponseSchema,
  UserRoleMatchedConditionSetSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserAnonymizeInput,
  type UserDeactivateInput,
  type UserIdParam,
  type UserListQuery,
  type UserReactivateInput,
  type UserRoleItem,
  type UserRoleMatchedConditionSet,
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

export {
  ProcessCancelBodySchema,
  ProcessListQuerySchema,
  ProcessRollbackBodySchema,
  KtiStartBodySchema,
  type ProcessCancelInput,
  type ProcessListQuery,
  type ProcessRollbackInput,
  type KtiStartInput,
} from './processes.schemas.js';

export {
  TaskCompleteBodySchema,
  TaskListQuerySchema,
  type TaskCompleteBodyInput,
  type TaskListQuery,
} from './tasks.schemas.js';

export {
  DOCUMENT_ALLOWED_CONTENT_TYPES,
  DocumentCreateBodySchema,
  DocumentIdParamSchema,
  DocumentUploadInitiateBodySchema,
  type DocumentCreateInput,
  type DocumentIdParam,
  type DocumentUploadInitiateInput,
} from './documents.schemas.js';

export {
  NOTIFICATION_EVENT_TYPES,
  NotificationListQuerySchema,
  NotificationPreferencesPutSchema,
  type NotificationEventTypeValue,
  type NotificationListQuery,
  type NotificationPreferencesPutInput,
} from './notifications.schemas.js';

export {
  EmailTemplateEventTypeParamSchema,
  EmailTemplatePreviewSchema,
  EmailTemplateSendTestSchema,
  UpdateEmailTemplateSchema,
  type EmailTemplatePreviewInput,
  type EmailTemplateSendTestInput,
  type UpdateEmailTemplateInput,
} from './email-templates.schemas.js';

export {
  SYSTEM_SETTING_KEYS,
  SystemSettingKeyParamSchema,
  SystemSettingPutBodySchema,
  AuditLogListQuerySchema,
  AuditLogExportQuerySchema,
  AdminConsentVersionCreateBodySchema,
  AdminConsentVersionPatchBodySchema,
  AdminConsentVersionPublishBodySchema,
  AuditChainIntegrityVerifyBodySchema,
  AdminOrganizationSummaryResponseSchema,
  parseSystemSettingValue,
  type SystemSettingKey,
  type SystemSettingPutBody,
  type AuditLogListQuery,
  type AuditLogExportQuery,
  type AdminConsentVersionCreateBody,
  type AdminConsentVersionPatchBody,
  type AdminConsentVersionPublishBody,
  type AuditChainIntegrityVerifyBody,
  type AdminOrganizationSummary,
} from './admin.schemas.js';

/** Ortak Zod şemaları */
export const EmptyObjectSchema = z.object({}).strict();

export type EmptyObjectInput = z.infer<typeof EmptyObjectSchema>;
