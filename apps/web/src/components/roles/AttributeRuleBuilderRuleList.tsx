'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { RoleRuleValueInput } from '@/components/roles/RoleRuleValueInput';
import type { LocalCond } from '@/components/roles/role-rule-local';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PermissionGate } from '@/components/shared/PermissionGate';
import type { RoleRuleRow } from '@/lib/queries/roles';
import {
  Permission,
  RoleRuleAttributeKey,
  RoleRuleConditionOperator,
} from '@leanmgmt/shared-types';

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

type PatchRoleRuleMutationLike = {
  mutateAsync: (args: {
    ruleId: string;
    body: {
      isActive?: boolean;
      order?: number;
      conditionSets?: { conditions: unknown[] }[];
    };
  }) => Promise<void>;
};

type DeleteRoleRuleMutationLike = {
  mutateAsync: (ruleId: string) => Promise<void>;
};

export function AttributeRuleBuilderRuleList({
  rules,
  patchMutation,
  deleteMutation,
  onRefetch,
}: {
  rules: RoleRuleRow[];
  patchMutation: PatchRoleRuleMutationLike;
  deleteMutation: DeleteRoleRuleMutationLike;
  onRefetch: () => void;
}) {
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Kayıtlı kurallar</h2>
      <ul className="space-y-3">
        {rules.map((r) => (
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
                    onRefetch();
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
                toast.success('Kural güncellendi');
                onRefetch();
              }}
            />
            <PermissionGate permission={Permission.ROLE_RULE_MANAGE}>
              <button
                type="button"
                className="mt-2 text-xs text-[var(--color-error-700)] underline"
                onClick={() => setDeleteRuleId(r.id)}
              >
                Kuralı sil
              </button>
            </PermissionGate>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={deleteRuleId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteRuleId(null);
        }}
        title="Kuralı sil"
        description="Bu kural kalıcı olarak kaldırılır. Attribute ile eşleşen kullanıcılar bu rolden düşebilir."
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        destructive
        onConfirm={async () => {
          if (!deleteRuleId) return;
          try {
            await deleteMutation.mutateAsync(deleteRuleId);
            toast.success('Kural silindi');
            onRefetch();
          } catch (e: unknown) {
            const err = e as { response?: { data?: { error?: { message?: string } } } };
            toast.error(err.response?.data?.error?.message ?? 'Silinemedi.');
            throw e;
          }
        }}
      />
    </section>
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
            <div key={ci} className="mb-2 flex flex-wrap items-end gap-2">
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
                              j === ci
                                ? { ...cond, attributeKey: e.target.value, value: '' }
                                : cond,
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
                              j === ci ? { ...cond, operator: e.target.value, value: '' } : cond,
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
              <RoleRuleValueInput
                attributeKey={c.attributeKey}
                operator={c.operator}
                value={c.value}
                onChange={(v) => {
                  setLocal((prev) =>
                    prev.map((s, i) =>
                      i === si
                        ? {
                            ...s,
                            conditions: s.conditions.map((cond, j) =>
                              j === ci ? { ...cond, value: v } : cond,
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
