'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  NotificationPreferencesPutSchema,
  type NotificationPreferencesPutInput,
} from '@leanmgmt/shared-schemas';

import { notificationEventLabel } from '@/lib/notification-ui';
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from '@/lib/queries/notifications';

export function NotificationPreferencesForm() {
  const { data, isLoading, isError, refetch } = useNotificationPreferencesQuery();
  const update = useUpdateNotificationPreferencesMutation();

  const form = useForm<NotificationPreferencesPutInput>({
    resolver: zodResolver(NotificationPreferencesPutSchema),
    defaultValues: { preferences: [] },
  });

  useEffect(() => {
    if (data && data.length > 0) {
      form.reset({
        preferences: data as NotificationPreferencesPutInput['preferences'],
      });
    }
  }, [data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast.success('Bildirim tercihleri kaydedildi');
    } catch {
      toast.error('Kaydedilemedi, tekrar deneyin');
    }
  });

  if (isLoading) {
    return (
      <div className="ls-card p-[var(--space-8)] shadow-[var(--shadow-md)]" role="status">
        <p className="text-[var(--color-neutral-600)]">Tercihler yükleniyor…</p>
      </div>
    );
  }

  if (isError || !data?.length) {
    return (
      <div className="ls-card p-[var(--space-8)] shadow-[var(--shadow-md)]">
        <p className="text-[var(--color-danger-600)]">Tercihler yüklenemedi.</p>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm mt-3"
          onClick={() => refetch()}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  const prefs = form.watch('preferences');

  return (
    <form onSubmit={onSubmit} className="ls-card overflow-hidden shadow-[var(--shadow-md)]">
      <div className="border-b border-[var(--color-neutral-200)] p-[var(--space-4)]">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-neutral-900)]">
          Bildirim tercihleri
        </h1>
        <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
          Olay bazında in-app, e-posta ve günlük özet kanallarını açıp kapatabilirsiniz.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
              <th className="px-[var(--space-3)] py-[var(--space-3)] font-medium text-[var(--color-neutral-800)]">
                Olay
              </th>
              <th className="px-[var(--space-3)] py-[var(--space-3)] font-medium text-[var(--color-neutral-800)]">
                Uygulama içi
              </th>
              <th className="px-[var(--space-3)] py-[var(--space-3)] font-medium text-[var(--color-neutral-800)]">
                E-posta
              </th>
              <th className="px-[var(--space-3)] py-[var(--space-3)] font-medium text-[var(--color-neutral-800)]">
                Günlük özet
              </th>
            </tr>
          </thead>
          <tbody>
            {prefs.map((_, index) => {
              const row = prefs[index];
              if (!row) return null;
              return (
                <tr key={row.eventType} className="border-b border-[var(--color-neutral-100)]">
                  <td className="px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-neutral-800)]">
                    <span className="font-medium">{notificationEventLabel(row.eventType)}</span>
                    <span className="mt-0.5 block text-xs text-[var(--color-neutral-500)]">
                      {row.eventType}
                    </span>
                  </td>
                  {(['inAppEnabled', 'emailEnabled', 'digestEnabled'] as const).map((field) => (
                    <td key={field} className="px-[var(--space-3)] py-[var(--space-2)]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--color-neutral-300)]"
                        checked={row[field]}
                        onChange={(e) =>
                          form.setValue(`preferences.${index}.${field}`, e.target.checked, {
                            shouldDirty: true,
                          })
                        }
                        aria-label={`${row.eventType} ${field}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-[var(--space-2)] border-t border-[var(--color-neutral-100)] p-[var(--space-4)]">
        <button
          type="submit"
          className="ls-btn ls-btn--primary ls-btn--sm"
          disabled={update.isPending || !form.formState.isDirty}
        >
          {update.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}
