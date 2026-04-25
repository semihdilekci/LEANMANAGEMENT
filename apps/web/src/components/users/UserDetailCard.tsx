'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import {
  useAnonymizeUserMutation,
  useDeactivateUserMutation,
  useReactivateUserMutation,
  type UserDetail,
} from '@/lib/queries/users';

interface UserDetailCardProps {
  user: UserDetail;
}

const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  WHITE_COLLAR: 'Beyaz Yaka',
  BLUE_COLLAR: 'Mavi Yaka',
  INTERN: 'Stajyer',
};

export function UserDetailCard({ user }: UserDetailCardProps) {
  const router = useRouter();
  const deactivateMutation = useDeactivateUserMutation();
  const reactivateMutation = useReactivateUserMutation();
  const anonymizeMutation = useAnonymizeUserMutation();

  const isAnonymized = !!user.anonymizedAt;

  return (
    <div className="space-y-[var(--space-6)]">
      {/* Header */}
      <div className="flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
            {isAnonymized ? 'Anonimleştirilmiş Kullanıcı' : `${user.firstName} ${user.lastName}`}
          </h1>
          {!isAnonymized && (
            <p className="mt-[var(--space-1)] font-mono text-sm text-[var(--color-neutral-500)]">
              Sicil: {user.sicil ?? '—'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-[var(--space-2)]">
          {!isAnonymized && (
            <>
              <PermissionGate permission={Permission.USER_UPDATE_ATTRIBUTE}>
                <button
                  type="button"
                  className="ls-btn ls-btn--neutral ls-btn--sm"
                  onClick={() => router.push(`/users/${user.id}/edit`)}
                >
                  Düzenle
                </button>
              </PermissionGate>

              <PermissionGate permission={Permission.USER_SESSION_VIEW}>
                <Link
                  href={`/users/${user.id}/sessions`}
                  className="ls-btn ls-btn--neutral ls-btn--sm"
                >
                  Oturumlar
                </Link>
              </PermissionGate>

              <PermissionGate permission={Permission.USER_LIST_VIEW}>
                <Link
                  href={`/users/${user.id}/roles`}
                  className="ls-btn ls-btn--neutral ls-btn--sm"
                >
                  Roller
                </Link>
              </PermissionGate>
            </>
          )}

          {user.isActive && !isAnonymized && (
            <PermissionGate permission={Permission.USER_DEACTIVATE}>
              <button
                type="button"
                className="ls-btn ls-btn--danger ls-btn--sm"
                disabled={deactivateMutation.isPending}
                onClick={() => {
                  if (!confirm('Bu kullanıcıyı pasif yapmak istediğinizden emin misiniz?')) return;
                  deactivateMutation.mutate(
                    { id: user.id, reason: 'Admin tarafından deaktive edildi' },
                    {
                      onSuccess: () => toast.success('Kullanıcı pasif yapıldı'),
                      onError: () => toast.error('İşlem başarısız'),
                    },
                  );
                }}
              >
                Pasif yap
              </button>
            </PermissionGate>
          )}

          {!user.isActive && !isAnonymized && (
            <PermissionGate permission={Permission.USER_REACTIVATE}>
              <button
                type="button"
                className="ls-btn ls-btn--primary ls-btn--sm"
                disabled={reactivateMutation.isPending}
                onClick={() => {
                  if (!confirm('Bu kullanıcıyı aktif yapmak istediğinizden emin misiniz?')) return;
                  reactivateMutation.mutate(
                    { id: user.id, reason: 'Admin tarafından aktive edildi' },
                    {
                      onSuccess: () => toast.success('Kullanıcı aktif yapıldı'),
                      onError: () => toast.error('İşlem başarısız'),
                    },
                  );
                }}
              >
                Aktif yap
              </button>
            </PermissionGate>
          )}

          {!isAnonymized && (
            <PermissionGate permission={Permission.USER_ANONYMIZE}>
              <button
                type="button"
                className="ls-btn ls-btn--danger ls-btn--sm"
                disabled={anonymizeMutation.isPending}
                onClick={() => {
                  if (
                    !confirm(
                      'Bu kullanıcının verileri KVKK kapsamında kalıcı olarak anonimleştirilecek. Bu işlem geri alınamaz. Devam etmek istediğinizden emin misiniz?',
                    )
                  )
                    return;
                  anonymizeMutation.mutate(
                    { id: user.id, reason: 'KVKK gereği anonimleştirme talebi' },
                    {
                      onSuccess: () => toast.success('Kullanıcı anonimleştirildi'),
                      onError: () => toast.error('İşlem başarısız'),
                    },
                  );
                }}
              >
                Anonimleştir
              </button>
            </PermissionGate>
          )}
        </div>
      </div>

      {isAnonymized && (
        <div role="alert" className="ls-alert ls-alert--warning">
          Bu kullanıcı KVKK kapsamında anonimleştirilmiştir.{' '}
          {user.anonymizedAt && (
            <span>Tarih: {new Date(user.anonymizedAt).toLocaleDateString('tr-TR')}</span>
          )}
          {user.anonymizationReason ? (
            <p className="mt-[var(--space-2)] text-sm">Gerekçe: {user.anonymizationReason}</p>
          ) : null}
        </div>
      )}

      {/* Status badge */}
      <div className="flex items-center gap-[var(--space-2)]">
        <span
          className={`inline-flex items-center gap-[var(--space-1)] rounded-full px-[var(--space-3)] py-1 text-sm font-medium ${
            user.isActive
              ? 'bg-[var(--color-success-100)] text-[var(--color-success-700)]'
              : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${user.isActive ? 'bg-[var(--color-success-500)]' : 'bg-[var(--color-neutral-400)]'}`}
            aria-hidden
          />
          {user.isActive ? 'Aktif' : 'Pasif'}
        </span>
        {user.employeeType && (
          <span className="rounded-full bg-[var(--color-neutral-100)] px-[var(--space-3)] py-1 text-sm text-[var(--color-neutral-600)]">
            {EMPLOYEE_TYPE_LABELS[user.employeeType] ?? user.employeeType}
          </span>
        )}
      </div>

      {/* Detail grid */}
      {!isAnonymized && (
        <>
          <section
            aria-labelledby="user-detail-identity-heading"
            className="space-y-[var(--space-3)]"
          >
            <h2
              id="user-detail-identity-heading"
              className="text-base font-semibold text-[var(--color-neutral-800)]"
            >
              Kimlik ve iletişim
            </h2>
            <div className="ls-card grid gap-[var(--space-4)] p-[var(--space-6)] sm:grid-cols-2">
              <DetailField label="Kayıt kimliği" value={user.id} mono />
              <DetailField label="Sicil" value={user.sicil ?? undefined} mono />
              <DetailField label="E-posta" value={user.email} />
              <DetailField label="Telefon" value={user.phone ?? undefined} />
            </div>
          </section>

          <section aria-labelledby="user-detail-org-heading" className="space-y-[var(--space-3)]">
            <h2
              id="user-detail-org-heading"
              className="text-base font-semibold text-[var(--color-neutral-800)]"
            >
              Organizasyon
            </h2>
            <div className="ls-card grid gap-[var(--space-4)] p-[var(--space-6)] sm:grid-cols-2">
              <DetailField label="Şirket" value={user.company?.name} />
              <DetailField label="Lokasyon" value={user.location?.name} />
              <DetailField label="Departman" value={user.department?.name} />
              <DetailField label="Pozisyon" value={user.position?.name} />
              <DetailField label="Seviye" value={user.level?.name} />
              <DetailField label="Takım" value={user.team?.name} />
              <DetailField label="Çalışma alanı" value={user.workArea?.name} />
              <DetailField label="Çalışma alt alanı" value={user.workSubArea?.name} />
              <DetailField
                label="İşe giriş tarihi"
                value={
                  user.hireDate ? new Date(user.hireDate).toLocaleDateString('tr-TR') : undefined
                }
              />
            </div>
          </section>

          <section
            aria-labelledby="user-detail-manager-heading"
            className="space-y-[var(--space-3)]"
          >
            <h2
              id="user-detail-manager-heading"
              className="text-base font-semibold text-[var(--color-neutral-800)]"
            >
              Yönetici
            </h2>
            <div className="ls-card grid gap-[var(--space-4)] p-[var(--space-6)] sm:grid-cols-2">
              <DetailField
                label="Yönetici (kullanıcı)"
                value={
                  user.manager
                    ? `${user.manager.firstName} ${user.manager.lastName} (${user.manager.sicil})`
                    : undefined
                }
              />
              <DetailField
                label="Yönetici e-postası (SAP / harici)"
                value={user.managerEmail ?? undefined}
              />
            </div>
          </section>

          <section
            aria-labelledby="user-detail-security-heading"
            className="space-y-[var(--space-3)]"
          >
            <h2
              id="user-detail-security-heading"
              className="text-base font-semibold text-[var(--color-neutral-800)]"
            >
              Hesap ve güvenlik
            </h2>
            <div className="ls-card grid gap-[var(--space-4)] p-[var(--space-6)] sm:grid-cols-2">
              <DetailField label="Şifre" value={user.passwordIsSet ? 'Tanımlı' : 'Tanımlı değil'} />
              <DetailField
                label="Son şifre değişimi"
                value={
                  user.passwordChangedAt
                    ? new Date(user.passwordChangedAt).toLocaleString('tr-TR')
                    : undefined
                }
              />
              <DetailField label="Ardışık başarısız giriş" value={String(user.failedLoginCount)} />
              <DetailField
                label="Kilit bitişi"
                value={
                  user.lockedUntil ? new Date(user.lockedUntil).toLocaleString('tr-TR') : undefined
                }
              />
              <DetailField
                label="Son giriş"
                value={
                  user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('tr-TR') : undefined
                }
              />
            </div>
          </section>

          <section
            aria-labelledby="user-detail-system-heading"
            className="space-y-[var(--space-3)]"
          >
            <h2
              id="user-detail-system-heading"
              className="text-base font-semibold text-[var(--color-neutral-800)]"
            >
              Sistem
            </h2>
            <div className="ls-card grid gap-[var(--space-4)] p-[var(--space-6)] sm:grid-cols-2">
              <DetailField
                label="Oluşturulma"
                value={new Date(user.createdAt).toLocaleString('tr-TR')}
              />
              <DetailField
                label="Son güncelleme"
                value={
                  user.updatedAt ? new Date(user.updatedAt).toLocaleString('tr-TR') : undefined
                }
              />
              <DetailField
                label="Oluşturan"
                value={
                  user.createdBy
                    ? `${user.createdBy.firstName} ${user.createdBy.lastName}`
                    : undefined
                }
              />
              <DetailField
                label="Oluşturan kullanıcı kimliği"
                value={user.createdByUserId ?? undefined}
                mono
              />
            </div>
          </section>
        </>
      )}

      {/* Roles */}
      {user.roles && user.roles.length > 0 && (
        <div>
          <h2 className="mb-[var(--space-3)] text-base font-semibold text-[var(--color-neutral-800)]">
            Roller
          </h2>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            {user.roles.map((role) => (
              <span
                key={role.id}
                className="rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-[var(--space-3)] py-1 text-sm text-[var(--color-primary-700)]"
              >
                {role.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-neutral-500)]">
        {label}
      </dt>
      <dd
        className={`mt-[var(--space-1)] text-sm text-[var(--color-neutral-800)] ${mono ? 'font-mono text-xs break-all' : ''}`}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}
