import { Injectable } from '@nestjs/common';
import type {
  EmployeeType,
  RoleRuleAttributeKey,
  RoleRuleConditionOperator,
} from '@leanmgmt/prisma-client';

/** Resolver’ın yüklediği kullanıcı alanları — ABAC eşlemesi için yeterli */
export interface AbacUserSnapshot {
  isActive: boolean;
  anonymizedAt: Date | null;
  companyId: string;
  locationId: string;
  departmentId: string;
  positionId: string;
  levelId: string;
  teamId: string | null;
  workAreaId: string;
  workSubAreaId: string | null;
  employeeType: EmployeeType;
}

export interface AbacConditionInput {
  attributeKey: RoleRuleAttributeKey;
  operator: RoleRuleConditionOperator;
  value: unknown;
}

export interface AbacConditionSetInput {
  conditions: AbacConditionInput[];
}

export interface AbacRoleRuleInput {
  roleId: string;
  conditionSets: AbacConditionSetInput[];
}

@Injectable()
export class AttributeRuleEvaluatorService {
  /**
   * Koşul setleri arası OR, set içi AND (docs/01_DOMAIN_MODEL).
   * Boş condition set listesi veya boş koşullu set → eşleşme yok (false).
   */
  evaluateRoleRule(user: AbacUserSnapshot, rule: AbacRoleRuleInput): boolean {
    if (!user.isActive || user.anonymizedAt) {
      return false;
    }
    if (rule.conditionSets.length === 0) {
      return false;
    }
    return rule.conditionSets.some((set) => {
      if (set.conditions.length === 0) {
        return false;
      }
      return set.conditions.every((c) => this.evaluateCondition(user, c));
    });
  }

  /**
   * Verilen kurallardan eşleşenlerin `roleId` listesi (sıra korunmaz, unique caller’da Set ile birleştirilir).
   */
  matchingRoleIds(user: AbacUserSnapshot, rules: AbacRoleRuleInput[]): string[] {
    const ids: string[] = [];
    for (const rule of rules) {
      if (this.evaluateRoleRule(user, rule)) {
        ids.push(rule.roleId);
      }
    }
    return ids;
  }

  private getUserAttributeValue(user: AbacUserSnapshot, key: RoleRuleAttributeKey): string | null {
    switch (key) {
      case 'COMPANY_ID':
        return user.companyId;
      case 'LOCATION_ID':
        return user.locationId;
      case 'DEPARTMENT_ID':
        return user.departmentId;
      case 'POSITION_ID':
        return user.positionId;
      case 'LEVEL_ID':
        return user.levelId;
      case 'TEAM_ID':
        return user.teamId;
      case 'WORK_AREA_ID':
        return user.workAreaId;
      case 'WORK_SUB_AREA_ID':
        return user.workSubAreaId;
      case 'EMPLOYEE_TYPE':
        return String(user.employeeType);
      default: {
        const _exhaustive: never = key;
        return _exhaustive;
      }
    }
  }

  private evaluateCondition(user: AbacUserSnapshot, condition: AbacConditionInput): boolean {
    const raw = this.getUserAttributeValue(user, condition.attributeKey);
    const userStr = raw === null || raw === undefined ? '' : String(raw);

    switch (condition.operator) {
      case 'EQUALS':
        return userStr === this.asScalarString(condition.value);
      case 'NOT_EQUALS':
        return userStr !== this.asScalarString(condition.value);
      case 'CONTAINS':
        return userStr.includes(this.asScalarString(condition.value));
      case 'STARTS_WITH':
        return userStr.startsWith(this.asScalarString(condition.value));
      case 'ENDS_WITH':
        return userStr.endsWith(this.asScalarString(condition.value));
      case 'IN':
        return this.asStringArray(condition.value).includes(userStr);
      case 'NOT_IN':
        return !this.asStringArray(condition.value).includes(userStr);
      default: {
        const _exhaustive: never = condition.operator;
        return _exhaustive;
      }
    }
  }

  private asScalarString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((v) => (v === null || v === undefined ? '' : String(v)));
  }
}
