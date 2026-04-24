'use client';

import { toast } from 'sonner';

import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import {
  useRevokeAllSessionsMutation,
  useRevokeSessionMutation,
  useUserSessionsQuery,
} from '@/lib/queries/users';

interface UserSessionsProps {
  userId: string;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  EXPIRED: 'Süresi dolmuş',
  REVOKED: 'İptal edildi',
};

export function UserSessions({ userId }: UserSessionsProps) {
  const { data: sessions, isLoading, error, refetch } = useUserSessionsQuery(userId);
  const revokeMutation = useRevokeSessionMutation();
  const revokeAllMutation = useRevokeAllSessionsMutation();

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy className="space-y-[var(--space-3)]">
        <span className="sr-only">Oturumlar yükleniyor...</span>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        <p>Oturumlar yüklenemedi.</p>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm mt-[var(--space-2)]"
          onClick={() => void refetch()}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  const activeSessions = sessions?.filter((s) => s.status === 'ACTIVE') ?? [];

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-neutral-500)]">
          {sessions?.length ?? 0} oturum, {activeSessions.length} aktif
        </p>
        {activeSessions.length > 0 && (
          <PermissionGate permission={Permission.USER_SESSION_REVOKE}>
            <button
              type="button"
              className="ls-btn ls-btn--danger ls-btn--sm"
              disabled={revokeAllMutation.isPending}
              onClick={() => {
                if (!confirm('Tüm aktif oturumları iptal etmek istediğinizden emin misiniz?'))
                  return;
                revokeAllMutation.mutate(userId, {
                  onSuccess: () => toast.success('Tüm oturumlar iptal edildi'),
                  onError: () => toast.error('İşlem başarısız'),
                });
              }}
            >
              Tümünü iptal et
            </button>
          </PermissionGate>
        )}
      </div>

      {!sessions?.length ? (
        <div className="py-[var(--space-8)] text-center text-[var(--color-neutral-500)]">
          <p>Oturum bulunamadı</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)]">
          <table className="w-full text-sm" aria-label="Kullanıcı oturumları">
            <thead className="bg-[var(--color-neutral-50)]">
              <tr>
                <th
                  scope="col"
                  className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
                >
                  Durum
                </th>
                <th
                  scope="col"
                  className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
                >
                  Tarayıcı
                </th>
                <th
                  scope="col"
                  className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
                >
                  Oluşturulma
                </th>
                <th
                  scope="col"
                  className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
                >
                  Son Aktivite
                </th>
                <th scope="col" className="sr-only">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-neutral-200)] bg-[var(--color-neutral-0)]">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-[var(--color-neutral-50)]">
                  <td className="px-[var(--space-4)] py-[var(--space-3)]">
                    <span
                      className={`inline-flex items-center gap-[var(--space-1)] rounded-full px-[var(--space-2)] py-0.5 text-xs font-medium ${
                        session.status === 'ACTIVE'
                          ? 'bg-[var(--color-success-100)] text-[var(--color-success-700)]'
                          : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
                      }`}
                    >
                      {STATUS_LABELS[session.status] ?? session.status}
                    </span>
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-neutral-600)]">
                    <span
                      className="truncate block max-w-[200px]"
                      title={session.userAgent ?? undefined}
                    >
                      {session.userAgent ? session.userAgent.slice(0, 40) + '...' : '—'}
                    </span>
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-neutral-600)]">
                    {new Date(session.createdAt).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-neutral-600)]">
                    {new Date(session.lastActiveAt).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-right">
                    {session.status === 'ACTIVE' && (
                      <PermissionGate permission={Permission.USER_SESSION_REVOKE}>
                        <button
                          type="button"
                          className="ls-btn ls-btn--danger ls-btn--xs"
                          disabled={revokeMutation.isPending}
                          onClick={() => {
                            revokeMutation.mutate(
                              { userId, sessionId: session.id },
                              {
                                onSuccess: () => toast.success('Oturum iptal edildi'),
                                onError: () => toast.error('İşlem başarısız'),
                              },
                            );
                          }}
                        >
                          İptal et
                        </button>
                      </PermissionGate>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
