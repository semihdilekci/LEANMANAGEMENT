'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { SYSTEM_SETTING_KEYS, type SystemSettingKey } from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import { useHasPermission } from '@/hooks/usePermissions';

import {
  type SystemSettingRow,
  useSystemSettingsQuery,
  useUpdateSystemSettingMutation,
} from '@/lib/queries/admin-system-settings';

const NUMERIC_KEYS = new Set<SystemSettingKey>([
  'LOGIN_ATTEMPT_THRESHOLD',
  'LOGIN_ATTEMPT_WINDOW_MINUTES',
  'LOCKOUT_THRESHOLD',
  'LOCKOUT_DURATION_MINUTES',
  'PASSWORD_EXPIRY_DAYS',
]);

function formatValueForInput(key: SystemSettingKey, value: unknown): string {
  if (NUMERIC_KEYS.has(key)) return String(value ?? '');
  if (key === 'SUPERADMIN_IP_WHITELIST') {
    return JSON.stringify(value ?? [], null, 2);
  }
  if (key === 'ACTIVE_CONSENT_VERSION_ID') {
    if (value === null || value === undefined) return '—';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return JSON.stringify(value ?? null);
}

function parseDraftValue(key: SystemSettingKey, draft: string): unknown {
  if (NUMERIC_KEYS.has(key)) {
    const n = Number(draft);
    if (!Number.isFinite(n)) throw new Error('Sayı geçersiz');
    return n;
  }
  if (key === 'SUPERADMIN_IP_WHITELIST') {
    try {
      return JSON.parse(draft) as unknown;
    } catch {
      throw new Error('IP listesi geçerli JSON olmalıdır');
    }
  }
  throw new Error('Desteklenmeyen ayar');
}

function SystemSettingRowEditor({ row }: { row: SystemSettingRow }) {
  const key = row.key as SystemSettingKey;
  const update = useUpdateSystemSettingMutation();
  const canEdit = useHasPermission(Permission.SYSTEM_SETTINGS_EDIT);
  const [draft, setDraft] = useState(() => formatValueForInput(key, row.value));

  useEffect(() => {
    setDraft(formatValueForInput(key, row.value));
  }, [key, row.value]);

  const readOnly = key === 'ACTIVE_CONSENT_VERSION_ID';

  if (!readOnly && !canEdit) {
    return (
      <tr className="border-b border-[var(--color-neutral-100)] align-top">
        <td className="px-3 py-3 font-mono text-xs text-[var(--color-neutral-800)]">{row.key}</td>
        <td className="px-3 py-3 text-sm text-[var(--color-neutral-600)]">
          {row.description ?? '—'}
        </td>
        <td className="px-3 py-3">
          <span className="font-mono text-xs text-[var(--color-neutral-800)]">
            {formatValueForInput(key, row.value)}
          </span>
        </td>
        <td className="px-3 py-3 text-xs text-[var(--color-neutral-500)]">
          {new Date(row.updatedAt).toLocaleString('tr-TR')}
        </td>
        <td className="px-3 py-3 text-xs text-[var(--color-neutral-500)]">Salt görüntüleme</td>
      </tr>
    );
  }

  async function onSave(): Promise<void> {
    if (readOnly) return;
    try {
      const value = parseDraftValue(key, draft);
      await update.mutateAsync({ key, value });
      toast.success('Ayar kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    }
  }

  return (
    <tr className="border-b border-[var(--color-neutral-100)] align-top">
      <td className="px-3 py-3 font-mono text-xs text-[var(--color-neutral-800)]">{row.key}</td>
      <td className="px-3 py-3 text-sm text-[var(--color-neutral-600)]">
        {row.description ?? '—'}
      </td>
      <td className="px-3 py-3">
        {readOnly ? (
          <span className="text-sm text-[var(--color-neutral-800)]">{draft}</span>
        ) : key === 'SUPERADMIN_IP_WHITELIST' ? (
          <textarea
            className="ls-input min-h-[6rem] w-full max-w-xl font-mono text-xs"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <input
            type="number"
            className="ls-input w-40"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        )}
      </td>
      <td className="px-3 py-3 text-xs text-[var(--color-neutral-500)]">
        {new Date(row.updatedAt).toLocaleString('tr-TR')}
      </td>
      <td className="px-3 py-3">
        {readOnly ? (
          <span className="text-xs text-[var(--color-neutral-500)]">Salt okunur</span>
        ) : (
          <button
            type="button"
            className="ls-btn ls-btn--primary ls-btn--sm"
            disabled={update.isPending}
            onClick={() => void onSave()}
          >
            {update.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        )}
      </td>
    </tr>
  );
}

export function SystemSettingsPageClient() {
  const q = useSystemSettingsQuery(true);
  const ordered = useMemo(() => {
    const rows = q.data ?? [];
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return SYSTEM_SETTING_KEYS.map((k) => byKey.get(k)).filter(Boolean) as SystemSettingRow[];
  }, [q.data]);

  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-neutral-900)]">Sistem ayarları</h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
            Aktif rıza sürümü yalnızca rıza yayın akışı ile güncellenir.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-[var(--color-primary-600)] underline underline-offset-2"
        >
          Yönetim özeti
        </Link>
      </div>

      {q.isPending ? (
        <p className="text-sm text-[var(--color-neutral-600)]">Yükleniyor…</p>
      ) : q.error ? (
        <p className="text-sm text-[var(--color-error-700)]">Ayarlar yüklenemedi.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
              <tr>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Anahtar</th>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Açıklama</th>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Değer</th>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">
                  Güncellendi
                </th>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => (
                <SystemSettingRowEditor key={row.key} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
