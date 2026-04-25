'use client';

import type { MasterDataType } from '@leanmgmt/shared-schemas';
import { RoleRuleAttributeKey, RoleRuleConditionOperator } from '@leanmgmt/shared-types';

import { useAllMasterDataQuery } from '@/lib/queries/master-data';

const EMPLOYEE_TYPES = ['WHITE_COLLAR', 'BLUE_COLLAR', 'INTERN'] as const;

function attributeKeyToMasterType(attributeKey: string): MasterDataType | null {
  const map: Record<string, MasterDataType> = {
    [RoleRuleAttributeKey.COMPANY_ID]: 'companies',
    [RoleRuleAttributeKey.LOCATION_ID]: 'locations',
    [RoleRuleAttributeKey.DEPARTMENT_ID]: 'departments',
    [RoleRuleAttributeKey.POSITION_ID]: 'positions',
    [RoleRuleAttributeKey.LEVEL_ID]: 'levels',
    [RoleRuleAttributeKey.TEAM_ID]: 'teams',
    [RoleRuleAttributeKey.WORK_AREA_ID]: 'work-areas',
    [RoleRuleAttributeKey.WORK_SUB_AREA_ID]: 'work-sub-areas',
  };
  return map[attributeKey] ?? null;
}

function isMultiOperator(operator: string) {
  return operator === RoleRuleConditionOperator.IN || operator === RoleRuleConditionOperator.NOT_IN;
}

function parseIds(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface RoleRuleValueInputProps {
  attributeKey: string;
  operator: string;
  value: string;
  onChange: (value: string) => void;
}

function EmployeeTypeValueInput({
  operator,
  value,
  onChange,
}: Pick<RoleRuleValueInputProps, 'operator' | 'value' | 'onChange'>) {
  const multi = isMultiOperator(operator);
  const selected = multi ? new Set(parseIds(value)) : new Set(value ? [value] : []);
  const toggle = (id: string) => {
    if (multi) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange([...next].join(','));
    } else {
      onChange(id);
    }
  };
  return (
    <fieldset className="min-w-[10rem] flex-1 space-y-1 text-xs">
      <legend className="sr-only">Çalışan tipi</legend>
      {multi ? (
        <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-[var(--color-neutral-200)] p-2">
          {EMPLOYEE_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input type="checkbox" checked={selected.has(t)} onChange={() => toggle(t)} />
              <span>{t}</span>
            </label>
          ))}
        </div>
      ) : (
        <select
          className="ls-input mt-0.5 block w-full text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Seçin</option>
          {EMPLOYEE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
    </fieldset>
  );
}

function MasterDataValueInput({
  masterType,
  operator,
  value,
  onChange,
}: {
  masterType: MasterDataType;
} & Pick<RoleRuleValueInputProps, 'operator' | 'value' | 'onChange'>) {
  const { data: masterItems, isLoading } = useAllMasterDataQuery(masterType);
  const multi = isMultiOperator(operator);
  const items = masterItems ?? [];
  const selected = multi ? new Set(parseIds(value)) : new Set(value ? [value] : []);

  const toggleMaster = (id: string) => {
    if (multi) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange([...next].join(','));
    } else {
      onChange(id);
    }
  };

  if (isLoading) {
    return <p className="text-xs text-[var(--color-neutral-500)]">Yükleniyor…</p>;
  }

  if (multi) {
    return (
      <fieldset className="min-w-[10rem] flex-1 text-xs">
        <legend className="mb-1 text-[var(--color-neutral-600)]">Değerler (çoklu)</legend>
        <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-[var(--color-neutral-200)] p-2">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggleMaster(item.id)}
              />
              <span>
                {item.name} <span className="text-[var(--color-neutral-500)]">({item.code})</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <label className="min-w-[10rem] flex-1 text-xs">
      Değer
      <select
        className="ls-input mt-0.5 block w-full text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Seçin</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} ({item.code})
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Attribute + operatöre göre değer alanı — master data ve EMPLOYEE_TYPE için seçici.
 */
export function RoleRuleValueInput({
  attributeKey,
  operator,
  value,
  onChange,
}: RoleRuleValueInputProps) {
  if (attributeKey === RoleRuleAttributeKey.EMPLOYEE_TYPE) {
    return <EmployeeTypeValueInput operator={operator} value={value} onChange={onChange} />;
  }
  const masterType = attributeKeyToMasterType(attributeKey);
  if (masterType) {
    return (
      <MasterDataValueInput
        masterType={masterType}
        operator={operator}
        value={value}
        onChange={onChange}
      />
    );
  }
  return (
    <label className="min-w-[8rem] flex-1 text-xs">
      Değer
      <input
        className="ls-input mt-0.5 block w-full text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isMultiOperator(operator) ? 'Virgülle ayırın' : 'Değer'}
      />
    </label>
  );
}
