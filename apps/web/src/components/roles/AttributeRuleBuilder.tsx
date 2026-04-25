'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Permission,
  RoleRuleAttributeKey,
  RoleRuleConditionOperator,
} from '@leanmgmt/shared-types';

import { AttributeRuleBuilderRuleList } from '@/components/roles/AttributeRuleBuilderRuleList';
import type { LocalCond } from '@/components/roles/role-rule-local';
import { RoleRuleValueInput } from '@/components/roles/RoleRuleValueInput';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { SimpleAlertDialog } from '@/components/shared/SimpleAlertDialog';
import { RoleSummaryBand } from '@/components/roles/RoleSummaryBand';
import {
  useCreateRoleRuleMutation,
  useDeleteRoleRuleMutation,
  usePatchRoleRuleMutation,
  useRoleDetailQuery,
  useRoleRulesQuery,
  useTestRoleRuleMutation,
} from '@/lib/queries/roles';

const ATTR_OPTIONS = Object.values(RoleRuleAttributeKey) as string[];
const OP_OPTIONS = Object.values(RoleRuleConditionOperator) as string[];

function parseValue(op: string, raw: string): string | string[] {
  if (op === RoleRuleConditionOperator.IN || op === RoleRuleConditionOperator.NOT_IN) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return raw.trim();
}

export function AttributeRuleBuilder({ roleId }: { roleId: string }) {
  const { data: role } = useRoleDetailQuery(roleId);
  const { data: rules, refetch } = useRoleRulesQuery(roleId);
  const createMutation = useCreateRoleRuleMutation(roleId);
  const patchMutation = usePatchRoleRuleMutation(roleId);
  const deleteMutation = useDeleteRoleRuleMutation(roleId);
  const testMutation = useTestRoleRuleMutation(roleId);

  const [sets, setSets] = useState<{ conditions: LocalCond[] }[]>([
    {
      conditions: [
        {
          attributeKey: ATTR_OPTIONS[0] ?? 'COMPANY_ID',
          operator: OP_OPTIONS[0] ?? 'EQUALS',
          value: '',
        },
      ],
    },
  ]);
  const [testOpen, setTestOpen] = useState(false);
  const [testBody, setTestBody] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);

  const addCondition = (setIdx: number) => {
    setSets((prev) =>
      prev.map((s, i) =>
        i === setIdx
          ? {
              ...s,
              conditions: [
                ...s.conditions,
                {
                  attributeKey: ATTR_OPTIONS[0] ?? 'COMPANY_ID',
                  operator: OP_OPTIONS[0] ?? 'EQUALS',
                  value: '',
                },
              ],
            }
          : s,
      ),
    );
  };

  const addSet = () => {
    setSets((prev) => [
      ...prev,
      {
        conditions: [
          {
            attributeKey: ATTR_OPTIONS[0] ?? 'COMPANY_ID',
            operator: OP_OPTIONS[0] ?? 'EQUALS',
            value: '',
          },
        ],
      },
    ]);
  };

  const updateCond = (setIdx: number, condIdx: number, patch: Partial<LocalCond>) => {
    setSets((prev) =>
      prev.map((s, si) =>
        si === setIdx
          ? {
              ...s,
              conditions: s.conditions.map((c, ci) => (ci === condIdx ? { ...c, ...patch } : c)),
            }
          : s,
      ),
    );
  };

  const removeCond = (setIdx: number, condIdx: number) => {
    setSets((prev) =>
      prev.map((s, si) =>
        si === setIdx ? { ...s, conditions: s.conditions.filter((_, ci) => ci !== condIdx) } : s,
      ),
    );
  };

  const buildPayload = () =>
    sets.map((set) => ({
      conditions: set.conditions.map((c) => ({
        attributeKey: c.attributeKey,
        operator: c.operator,
        value: parseValue(c.operator, c.value),
      })),
    }));

  const submitNew = async () => {
    setError(null);
    try {
      await createMutation.mutateAsync({ conditionSets: buildPayload() });
      toast.success('Kural kaydedildi');
      setSets([
        {
          conditions: [
            {
              attributeKey: ATTR_OPTIONS[0] ?? 'COMPANY_ID',
              operator: OP_OPTIONS[0] ?? 'EQUALS',
              value: '',
            },
          ],
        },
      ]);
      void refetch();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      setError(err.response?.data?.error?.message ?? 'Kural oluşturulamadı.');
    }
  };

  const runTest = async () => {
    setError(null);
    try {
      const res = await testMutation.mutateAsync({ conditionSets: buildPayload() });
      const rows = res.sampleUsers.slice(0, 10).map((u) => (
        <li key={u.id}>
          {u.sicil} — {u.firstName} {u.lastName} ({u.company?.name ?? '—'})
        </li>
      ));
      setTestBody(
        <>
          <p className="mb-2">
            Eşleşen kullanıcı sayısı: <strong>{res.matchingUserCount}</strong>
          </p>
          {rows.length > 0 ? (
            <>
              <p className="text-xs text-[var(--color-neutral-600)]">İlk kayıtlar:</p>
              <ul className="mt-1 list-inside list-disc text-xs">{rows}</ul>
            </>
          ) : null}
        </>,
      );
      setTestOpen(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      setError(err.response?.data?.error?.message ?? 'Test başarısız.');
    }
  };

  if (!role) {
    return (
      <div className="h-32 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]" />
    );
  }

  return (
    <div className="space-y-[var(--space-4)]">
      <nav className="text-sm text-[var(--color-neutral-600)]">
        <Link href="/roles">Roller</Link>
        <span aria-hidden> / </span>
        <Link href={`/roles/${role.id}`}>{role.name}</Link>
        <span aria-hidden> / </span>
        <span className="text-[var(--color-neutral-900)]">Kurallar</span>
      </nav>

      <RoleSummaryBand role={role} active="rules" />

      <section className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] p-4">
        <h2 className="text-sm font-semibold text-[var(--color-neutral-900)]">Yeni kural</h2>
        <p className="mt-1 text-xs text-[var(--color-neutral-600)]">
          Gruplar arası OR, grup içi AND. Master data alanlarında listeden seçim; IN için çoklu
          seçim.
        </p>
        <div className="mt-3 space-y-4">
          {sets.map((set, si) => (
            <div
              key={si}
              className="rounded border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-3"
            >
              <p className="mb-2 text-xs font-medium text-[var(--color-neutral-700)]">
                Grup {si + 1}
              </p>
              {set.conditions.map((c, ci) => (
                <div key={ci} className="mb-2 flex flex-wrap items-end gap-2">
                  <label className="text-xs">
                    Alan
                    <select
                      className="ls-input mt-0.5 block text-sm"
                      value={c.attributeKey}
                      onChange={(e) =>
                        updateCond(si, ci, { attributeKey: e.target.value, value: '' })
                      }
                    >
                      {ATTR_OPTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    Operatör
                    <select
                      className="ls-input mt-0.5 block text-sm"
                      value={c.operator}
                      onChange={(e) => updateCond(si, ci, { operator: e.target.value, value: '' })}
                    >
                      {OP_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                  <RoleRuleValueInput
                    attributeKey={c.attributeKey}
                    operator={c.operator}
                    value={c.value}
                    onChange={(v) => updateCond(si, ci, { value: v })}
                  />
                  <button
                    type="button"
                    className="ls-btn ls-btn--neutral ls-btn--sm"
                    onClick={() => removeCond(si, ci)}
                  >
                    Sil
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ls-btn ls-btn--neutral ls-btn--sm"
                onClick={() => addCondition(si)}
              >
                Koşul ekle
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="ls-btn ls-btn--neutral ls-btn--sm" onClick={addSet}>
            Grup ekle (VEYA)
          </button>
          <PermissionGate permission={Permission.ROLE_RULE_MANAGE}>
            <button
              type="button"
              className="ls-btn ls-btn--neutral ls-btn--sm"
              disabled={testMutation.isPending}
              onClick={() => void runTest()}
            >
              Taslağı test et
            </button>
            <button
              type="button"
              className="ls-btn ls-btn--primary ls-btn--sm"
              disabled={createMutation.isPending}
              onClick={() => void submitNew()}
            >
              Kuralı kaydet
            </button>
          </PermissionGate>
        </div>
      </section>

      <SimpleAlertDialog open={testOpen} title="Kural testi" onOpenChange={setTestOpen}>
        {testBody}
      </SimpleAlertDialog>

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-error-600)]">
          {error}
        </p>
      ) : null}

      <AttributeRuleBuilderRuleList
        rules={rules ?? []}
        patchMutation={patchMutation}
        deleteMutation={deleteMutation}
        onRefetch={() => void refetch()}
      />
    </div>
  );
}
