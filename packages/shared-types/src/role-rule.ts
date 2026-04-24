/**
 * Prisma `role_rule_attribute_key` / `role_rule_condition_operator` ile aynı değerler
 * (apps/api/prisma/schema.prisma). shared-types Prisma’ya bağımlı olmamalı.
 */
export const RoleRuleAttributeKey = {
  COMPANY_ID: 'COMPANY_ID',
  LOCATION_ID: 'LOCATION_ID',
  DEPARTMENT_ID: 'DEPARTMENT_ID',
  POSITION_ID: 'POSITION_ID',
  LEVEL_ID: 'LEVEL_ID',
  TEAM_ID: 'TEAM_ID',
  WORK_AREA_ID: 'WORK_AREA_ID',
  WORK_SUB_AREA_ID: 'WORK_SUB_AREA_ID',
  EMPLOYEE_TYPE: 'EMPLOYEE_TYPE',
} as const;

export type RoleRuleAttributeKey = (typeof RoleRuleAttributeKey)[keyof typeof RoleRuleAttributeKey];

export const RoleRuleConditionOperator = {
  EQUALS: 'EQUALS',
  NOT_EQUALS: 'NOT_EQUALS',
  CONTAINS: 'CONTAINS',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
  STARTS_WITH: 'STARTS_WITH',
  ENDS_WITH: 'ENDS_WITH',
} as const;

export type RoleRuleConditionOperator =
  (typeof RoleRuleConditionOperator)[keyof typeof RoleRuleConditionOperator];
