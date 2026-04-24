'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  Permission,
  RoleRuleAttributeKey,
  RoleRuleConditionOperator,
} from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
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

type LocalCond = { attributeKey: string; operator: string; value: string };

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
  const [testResult, setTestResult] = useState<string | null>(null);
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
      const sample = res.sampleUsers.map((u) => u.sicil).join(', ');
      setTestResult(
        `Eşleşen: ${res.matchingUserCount} kullanıcı. Örnek siciller: ${sample || '—'}`,
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
          Gruplar arası OR, grup içi AND. IN operatöründe değerleri virgülle ayırın.
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
                      onChange={(e) => updateCond(si, ci, { attributeKey: e.target.value })}
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
                      onChange={(e) => updateCond(si, ci, { operator: e.target.value })}
                    >
                      {OP_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-[8rem] flex-1 text-xs">
                    Değer
                    <input
                      className="ls-input mt-0.5 block w-full text-sm"
                      value={c.value}
                      onChange={(e) => updateCond(si, ci, { value: e.target.value })}
                    />
                  </label>
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
              onClick={() => void runTest()}
            >
              Taslağı test et
            </button>
            <button
              type="button"
              className="ls-btn ls-btn--primary ls-btn--sm"
              onClick={() => void submitNew()}
            >
              Kuralı kaydet
            </button>
          </PermissionGate>
        </div>
      </section>

      {testOpen ? (
        <div
          className="rounded border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-3 text-sm"
          role="status"
        >
          <p>{testResult}</p>
          <button
            type="button"
            className="mt-2 text-[var(--color-primary-700)] underline"
            onClick={() => setTestOpen(false)}
          >
            Kapat
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-error-600)]">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Kayıtlı kurallar</h2>
        <ul className="space-y-3">
          {(rules ?? []).map((r) => (
            <li key={r.id} className="rounded border border-[var(--color-neutral-200)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Kural #{r.order + 1}</span>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    onChange={async (e) => {
                      await patchMutation.mutateAsync({
                        ruleId: r.id,
                        body: { isActive: e.target.checked },
                      });
                      void refetch();
                    }}
                  />
                  Aktif
                </label>
              </div>
              <p className="mt-1 text-xs text-[var(--color-neutral-600)]">
                Eşleşen kullanıcı: {r.matchingUserCount}
              </p>
              <RuleEditor
                rule={r}
                onSave={async (payload) => {
                  await patchMutation.mutateAsync({
                    ruleId: r.id,
                    body: { conditionSets: payload },
                  });
                  void refetch();
                }}
              />
              <PermissionGate permission={Permission.ROLE_RULE_MANAGE}>
                <button
                  type="button"
                  className="mt-2 text-xs text-[var(--color-error-700)] underline"
                  onClick={async () => {
                    if (!window.confirm('Kural silinsin mi?')) return;
                    await deleteMutation.mutateAsync(r.id);
                    void refetch();
                  }}
                >
                  Kuralı sil
                </button>
              </PermissionGate>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RuleEditor({
  rule,
  onSave,
}: {
  rule: {
    conditionSets: { conditions: { attributeKey: string; operator: string; value: unknown }[] }[];
  };
  onSave: (
    payload: {
      conditions: { attributeKey: string; operator: string; value: string | string[] }[];
    }[],
  ) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState<{ conditions: LocalCond[] }[]>([]);

  const loadFromRule = () =>
    rule.conditionSets.map((s) => ({
      conditions: s.conditions.map((c) => ({
        attributeKey: c.attributeKey,
        operator: c.operator,
        value: Array.isArray(c.value) ? (c.value as string[]).join(',') : String(c.value ?? ''),
      })),
    }));

  if (!expanded) {
    return (
      <button
        type="button"
        className="mt-2 text-xs text-[var(--color-primary-700)] underline"
        onClick={() => {
          setLocal(loadFromRule());
          setExpanded(true);
        }}
      >
        Koşulları düzenle
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-[var(--color-neutral-100)] pt-3">
      {local.map((set, si) => (
        <div key={si} className="rounded bg-[var(--color-neutral-50)] p-2">
          {set.conditions.map((c, ci) => (
            <div key={ci} className="mb-2 flex flex-wrap gap-2">
              <select
                className="ls-input text-xs"
                value={c.attributeKey}
                onChange={(e) => {
                  setLocal((prev) =>
                    prev.map((s, i) =>
                      i === si
                        ? {
                            ...s,
                            conditions: s.conditions.map((cond, j) =>
                              j === ci ? { ...cond, attributeKey: e.target.value } : cond,
                            ),
                          }
                        : s,
                    ),
                  );
                }}
              >
                {ATTR_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select
                className="ls-input text-xs"
                value={c.operator}
                onChange={(e) => {
                  setLocal((prev) =>
                    prev.map((s, i) =>
                      i === si
                        ? {
                            ...s,
                            conditions: s.conditions.map((cond, j) =>
                              j === ci ? { ...cond, operator: e.target.value } : cond,
                            ),
                          }
                        : s,
                    ),
                  );
                }}
              >
                {OP_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <input
                className="ls-input flex-1 text-xs"
                value={c.value}
                onChange={(e) => {
                  setLocal((prev) =>
                    prev.map((s, i) =>
                      i === si
                        ? {
                            ...s,
                            conditions: s.conditions.map((cond, j) =>
                              j === ci ? { ...cond, value: e.target.value } : cond,
                            ),
                          }
                        : s,
                    ),
                  );
                }}
              />
            </div>
          ))}
        </div>
      ))}
      <button
        type="button"
        className="ls-btn ls-btn--primary ls-btn--sm"
        onClick={() =>
          void onSave(
            local.map((s) => ({
              conditions: s.conditions.map((c) => ({
                attributeKey: c.attributeKey,
                operator: c.operator,
                value: parseValue(c.operator, c.value),
              })),
            })),
          )
        }
      >
        Kaydet
      </button>
    </div>
  );
}
