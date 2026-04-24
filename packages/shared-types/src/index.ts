export {
  Permission,
  PERMISSION_METADATA,
  type PermissionCategory,
  type PermissionMetadata,
} from './permission.js';
export { RoleRuleAttributeKey, RoleRuleConditionOperator } from './role-rule.js';

/** Geriye dönük — boş export kaldırılmasın */
export type Placeholder = { _brand: 'shared-types' };
