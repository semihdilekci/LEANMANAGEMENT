'use client';

import Link from 'next/link';
import { useState } from 'react';

import { WEATHER_AVATAR_KEYS } from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';
import { calendarDaysUntilPasswordExpiry } from '@leanmgmt/shared-utils/password-expiry-calendar';
import { toast } from 'sonner';

import { UserAvatar } from '@/components/profile/UserAvatar';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { useAuthMeQuery, useUpdateAvatarMutation } from '@/lib/queries/profile';

const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  WHITE_COLLAR: 'Beyaz Yaka',
  BLUE_COLLAR: 'Mavi Yaka',
  INTERN: 'Stajyer',
};

type ProfileTab = 'info' | 'data' | 'security';

function PasswordExpiryHint({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) {
    return (
      <p className="text-sm text-[var(--color-neutral-600)]">
        Şifre süresi bilgisi yok (OIDC hesapları).
      </p>
    );
  }
  const days = calendarDaysUntilPasswordExpiry(expiresAt, new Date());
  const urgent = days <= 3;
  const warn = days <= 14;
  const tone = urgent
    ? 'text-[var(--color-danger)]'
    : warn
      ? 'text-[var(--color-primary-800)]'
      : 'text-[var(--color-neutral-700)]';
  const msg =
    days < 0
      ? 'Şifre süreniz doldu.'
      : days === 0
        ? 'Şifrenizin süresi bugün doluyor.'
        : `Şifrenizin süresi ${days} gün içinde dolacak.`;

  return <p className={`text-sm font-medium ${tone}`}>{msg}</p>;
}

export function ProfilePage() {
  const [tab, setTab] = useState<ProfileTab>('info');
  const { data: me, isError, refetch } = useAuthMeQuery();
  const updateAvatar = useUpdateAvatarMutation();

  if (isError) {
    return (
      <div className="ls-card p-[var(--space-6)]">
        <p className="text-[var(--color-neutral-700)]">Profil yüklenemedi.</p>
        <button
          type="button"
          className="ls-btn ls-btn--primary ls-btn--sm mt-[var(--space-4)]"
          onClick={() => void refetch()}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="space-y-[var(--space-6)]" aria-busy="true">
        <div className="h-24 animate-pulse rounded-lg bg-[var(--color-neutral-200)]" />
        <div className="h-10 w-64 animate-pulse rounded-md bg-[var(--color-neutral-200)]" />
        <div className="h-64 animate-pulse rounded-lg bg-[var(--color-neutral-200)]" />
      </div>
    );
  }

  const tabBtn = (id: ProfileTab, label: string) => {
    const active = tab === id;
    return (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={active}
        className={
          'whitespace-nowrap border-b-2 px-[var(--space-3)] py-[var(--space-2)] text-sm font-medium transition-colors ' +
          (active
            ? 'border-[var(--color-primary-600)] text-[var(--color-primary-800)]'
            : 'border-transparent text-[var(--color-neutral-600)] hover:text-[var(--color-neutral-900)]')
        }
        onClick={() => setTab(id)}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-center">
        <UserAvatar avatarKey={me.avatarKey} size={64} />
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-neutral-900)]">
            {me.firstName} {me.lastName}
          </h1>
          <p className="text-sm text-[var(--color-neutral-600)]">
            Sicil {me.sicil} · {me.email}
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Profil sekmeleri"
        className="flex gap-[var(--space-2)] overflow-x-auto border-b border-[var(--color-neutral-200)]"
      >
        {tabBtn('info', 'Bilgilerim')}
        {tabBtn('data', 'Verilerim')}
        {tabBtn('security', 'Güvenlik')}
      </div>

      {tab === 'info' ? (
        <div className="space-y-[var(--space-6)]">
          <div className="rounded-md border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-[var(--space-4)] py-[var(--space-3)] text-sm text-[var(--color-primary-900)]">
            Kişisel bilgilerinizi buradan düzenleyemezsiniz. Değişiklik için sistem yöneticinize
            başvurun.
          </div>

          <section>
            <h2 className="mb-[var(--space-3)] text-sm font-semibold text-[var(--color-neutral-800)]">
              Profil görseli
            </h2>
            <p className="mb-[var(--space-3)] text-sm text-[var(--color-neutral-600)]">
              Aşağıdan bir görsel seçerek avatarınızı değiştirebilirsiniz.
            </p>
            <div className="grid grid-cols-4 gap-[var(--space-3)] sm:grid-cols-6 md:grid-cols-8">
              {WEATHER_AVATAR_KEYS.map((key) => {
                const selected = me.avatarKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={
                      'rounded-lg p-1 transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-600)] ' +
                      (selected
                        ? 'ring-2 ring-[var(--color-primary-600)]'
                        : 'hover:ring-1 hover:ring-[var(--color-neutral-300)]')
                    }
                    aria-label={`Avatar ${key}`}
                    aria-pressed={selected}
                    disabled={updateAvatar.isPending}
                    onClick={() => {
                      if (key === me.avatarKey) return;
                      updateAvatar.mutate(key, {
                        onSuccess: () => toast.success('Profil görseliniz güncellendi.'),
                        onError: () => toast.error('Görsel güncellenemedi. Tekrar deneyin.'),
                      });
                    }}
                  >
                    <UserAvatar avatarKey={key} size={48} />
                  </button>
                );
              })}
            </div>
          </section>

          <div className="ls-card p-[var(--space-5)] shadow-[var(--shadow-sm)]">
            <h2 className="mb-[var(--space-4)] text-sm font-semibold text-[var(--color-neutral-800)]">
              Kimlik
            </h2>
            <dl className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Sicil</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.sicil}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Ad</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.firstName}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Soyad</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.lastName}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">E-posta</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Telefon</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Çalışan tipi</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">
                  {EMPLOYEE_TYPE_LABELS[me.employeeType] ?? me.employeeType}
                </dd>
              </div>
            </dl>
          </div>

          <div className="ls-card p-[var(--space-5)] shadow-[var(--shadow-sm)]">
            <h2 className="mb-[var(--space-4)] text-sm font-semibold text-[var(--color-neutral-800)]">
              Organizasyon
            </h2>
            <dl className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Şirket</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.company.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Lokasyon</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.location.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Departman</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.department.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Pozisyon</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.position.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Kademe</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.level.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Ekip</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.team?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Çalışma alanı</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">{me.workArea.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-neutral-500)]">Çalışma alt alanı</dt>
                <dd className="text-sm text-[var(--color-neutral-900)]">
                  {me.workSubArea?.name ?? '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="ls-card p-[var(--space-5)] shadow-[var(--shadow-sm)]">
            <h2 className="mb-[var(--space-4)] text-sm font-semibold text-[var(--color-neutral-800)]">
              Yönetim
            </h2>
            <p className="text-sm text-[var(--color-neutral-800)]">
              {me.manager
                ? `${me.manager.firstName} ${me.manager.lastName}`
                : 'Atanmış yönetici yok'}
            </p>
          </div>
        </div>
      ) : null}

      {tab === 'data' ? (
        <div className="ls-card space-y-[var(--space-4)] p-[var(--space-5)] shadow-[var(--shadow-sm)]">
          <p className="text-sm text-[var(--color-neutral-700)]">
            &quot;Verilerim&quot; özeti (roller, süreçler, görevler, oturum ve rıza geçmişi) için
            backend verisi bağlandığında bu sekme doldurulacaktır. MVP kapsamında veri indirme
            sunulmaz.
          </p>
          <p className="text-sm text-[var(--color-neutral-600)]">
            Kapsamlı KVKK taleplerinizi kvkk@holding.com adresine iletebilirsiniz.
          </p>
        </div>
      ) : null}

      {tab === 'security' ? (
        <div className="space-y-[var(--space-5)]">
          <div className="ls-card p-[var(--space-5)] shadow-[var(--shadow-sm)]">
            <h2 className="mb-[var(--space-3)] text-sm font-semibold text-[var(--color-neutral-800)]">
              Şifre
            </h2>
            <PasswordExpiryHint expiresAt={me.passwordExpiresAt} />
            <Link
              href="/profile/change-password"
              className="mt-[var(--space-4)] inline-flex text-sm font-medium text-[var(--color-primary-700)] underline underline-offset-2"
            >
              Şifre değiştir
            </Link>
          </div>

          <div className="ls-card p-[var(--space-5)] shadow-[var(--shadow-sm)]">
            <h2 className="mb-[var(--space-3)] text-sm font-semibold text-[var(--color-neutral-800)]">
              Aktif oturumlarım
            </h2>
            <p className="text-sm text-[var(--color-neutral-600)]">
              Oturum listesi ve uzaktan kapatma için API entegrasyonu tamamlandığında burada
              gösterilecektir.
            </p>
          </div>

          <PermissionGate permission={Permission.AUDIT_LOG_VIEW}>
            <div className="ls-card p-[var(--space-5)] shadow-[var(--shadow-sm)]">
              <h2 className="mb-[var(--space-3)] text-sm font-semibold text-[var(--color-neutral-800)]">
                Denetim kayıtları
              </h2>
              <Link
                href={`/admin/audit-logs?userId=${me.id}`}
                className="text-sm font-medium text-[var(--color-primary-700)] underline underline-offset-2"
              >
                Benim için oluşturulan denetim kayıtları
              </Link>
            </div>
          </PermissionGate>
        </div>
      ) : null}
    </div>
  );
}
