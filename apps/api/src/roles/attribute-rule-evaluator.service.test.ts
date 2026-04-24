import { describe, it, expect, beforeEach } from 'vitest';

import {
  AttributeRuleEvaluatorService,
  type AbacRoleRuleInput,
  type AbacUserSnapshot,
} from './attribute-rule-evaluator.service.js';

function baseUser(overrides: Partial<AbacUserSnapshot> = {}): AbacUserSnapshot {
  return {
    isActive: true,
    anonymizedAt: null,
    companyId: 'c1',
    locationId: 'l1',
    departmentId: 'd1',
    positionId: 'p1',
    levelId: 'lv1',
    teamId: 't1',
    workAreaId: 'wa1',
    workSubAreaId: 'ws1',
    employeeType: 'WHITE_COLLAR',
    ...overrides,
  };
}

describe('AttributeRuleEvaluatorService', () => {
  let evaluator: AttributeRuleEvaluatorService;

  beforeEach(() => {
    evaluator = new AttributeRuleEvaluatorService();
  });

  it('pasif kullanıcı için hiçbir kural eşleşmez', () => {
    const user = baseUser({ isActive: false });
    const rule: AbacRoleRuleInput = {
      roleId: 'r1',
      conditionSets: [
        {
          conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'c1' }],
        },
      ],
    };
    expect(evaluator.evaluateRoleRule(user, rule)).toBe(false);
  });

  it('anonimleştirilmiş kullanıcı için eşleşme yok', () => {
    const user = baseUser({ anonymizedAt: new Date() });
    const rule: AbacRoleRuleInput = {
      roleId: 'r1',
      conditionSets: [
        {
          conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'c1' }],
        },
      ],
    };
    expect(evaluator.evaluateRoleRule(user, rule)).toBe(false);
  });

  it('boş condition set listesi false döner', () => {
    const user = baseUser();
    const rule: AbacRoleRuleInput = { roleId: 'r1', conditionSets: [] };
    expect(evaluator.evaluateRoleRule(user, rule)).toBe(false);
  });

  it('içi boş koşullu set AND nedeniyle false', () => {
    const user = baseUser();
    const rule: AbacRoleRuleInput = {
      roleId: 'r1',
      conditionSets: [{ conditions: [] }],
    };
    expect(evaluator.evaluateRoleRule(user, rule)).toBe(false);
  });

  it('tek set tek koşul EQUALS eşleşir', () => {
    const user = baseUser({ companyId: 'acme' });
    const rule: AbacRoleRuleInput = {
      roleId: 'r1',
      conditionSets: [
        {
          conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'acme' }],
        },
      ],
    };
    expect(evaluator.evaluateRoleRule(user, rule)).toBe(true);
  });

  it('set içi AND: ikisi de doğru olmalı', () => {
    const user = baseUser({ companyId: 'acme', departmentId: 'it' });
    const rule: AbacRoleRuleInput = {
      roleId: 'r1',
      conditionSets: [
        {
          conditions: [
            { attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'acme' },
            { attributeKey: 'DEPARTMENT_ID', operator: 'EQUALS', value: 'it' },
          ],
        },
      ],
    };
    expect(evaluator.evaluateRoleRule(user, rule)).toBe(true);
  });

  it('set içi AND: biri yanlışsa false', () => {
    const user = baseUser({ companyId: 'acme', departmentId: 'hr' });
    const rule: AbacRoleRuleInput = {
      roleId: 'r1',
      conditionSets: [
        {
          conditions: [
            { attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'acme' },
            { attributeKey: 'DEPARTMENT_ID', operator: 'EQUALS', value: 'it' },
          ],
        },
      ],
    };
    expect(evaluator.evaluateRoleRule(user, rule)).toBe(false);
  });

  it('setler arası OR: bir set yeter', () => {
    const user = baseUser({ companyId: 'x', positionId: 'manager' });
    const rule: AbacRoleRuleInput = {
      roleId: 'r1',
      conditionSets: [
        {
          conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'y' }],
        },
        {
          conditions: [{ attributeKey: 'POSITION_ID', operator: 'EQUALS', value: 'manager' }],
        },
      ],
    };
    expect(evaluator.evaluateRoleRule(user, rule)).toBe(true);
  });

  it('CONTAINS / STARTS_WITH / ENDS_WITH', () => {
    const user = baseUser({ positionId: 'SeniorManager' });
    expect(
      evaluator.evaluateRoleRule(user, {
        roleId: 'r1',
        conditionSets: [
          { conditions: [{ attributeKey: 'POSITION_ID', operator: 'CONTAINS', value: 'Manager' }] },
        ],
      }),
    ).toBe(true);
    expect(
      evaluator.evaluateRoleRule(user, {
        roleId: 'r1',
        conditionSets: [
          {
            conditions: [{ attributeKey: 'POSITION_ID', operator: 'STARTS_WITH', value: 'Senior' }],
          },
        ],
      }),
    ).toBe(true);
    expect(
      evaluator.evaluateRoleRule(user, {
        roleId: 'r1',
        conditionSets: [
          {
            conditions: [{ attributeKey: 'POSITION_ID', operator: 'ENDS_WITH', value: 'Manager' }],
          },
        ],
      }),
    ).toBe(true);
  });

  it('IN / NOT_IN', () => {
    const user = baseUser({ companyId: 'c2' });
    expect(
      evaluator.evaluateRoleRule(user, {
        roleId: 'r1',
        conditionSets: [
          { conditions: [{ attributeKey: 'COMPANY_ID', operator: 'IN', value: ['c1', 'c2'] }] },
        ],
      }),
    ).toBe(true);
    expect(
      evaluator.evaluateRoleRule(user, {
        roleId: 'r1',
        conditionSets: [
          { conditions: [{ attributeKey: 'COMPANY_ID', operator: 'NOT_IN', value: ['c1', 'c3'] }] },
        ],
      }),
    ).toBe(true);
    expect(
      evaluator.evaluateRoleRule(user, {
        roleId: 'r1',
        conditionSets: [
          { conditions: [{ attributeKey: 'COMPANY_ID', operator: 'NOT_IN', value: ['c2'] }] },
        ],
      }),
    ).toBe(false);
  });

  it('NOT_EQUALS', () => {
    const user = baseUser({ locationId: 'hq' });
    expect(
      evaluator.evaluateRoleRule(user, {
        roleId: 'r1',
        conditionSets: [
          {
            conditions: [{ attributeKey: 'LOCATION_ID', operator: 'NOT_EQUALS', value: 'branch' }],
          },
        ],
      }),
    ).toBe(true);
  });

  it('EMPLOYEE_TYPE string karşılaştırması', () => {
    const user = baseUser({ employeeType: 'BLUE_COLLAR' });
    expect(
      evaluator.evaluateRoleRule(user, {
        roleId: 'r1',
        conditionSets: [
          {
            conditions: [
              { attributeKey: 'EMPLOYEE_TYPE', operator: 'EQUALS', value: 'BLUE_COLLAR' },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('matchingRoleIds birden fazla kuraldan eşleşen roleId döner', () => {
    const user = baseUser({ companyId: 'acme' });
    const rules: AbacRoleRuleInput[] = [
      {
        roleId: 'r-a',
        conditionSets: [
          { conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'other' }] },
        ],
      },
      {
        roleId: 'r-b',
        conditionSets: [
          { conditions: [{ attributeKey: 'COMPANY_ID', operator: 'EQUALS', value: 'acme' }] },
        ],
      },
    ];
    expect(evaluator.matchingRoleIds(user, rules)).toEqual(['r-b']);
  });
});
