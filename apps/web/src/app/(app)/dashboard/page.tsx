'use client';

import { useAuthStore } from '@/stores/auth-store';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Günaydın';
  if (hour < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

const STAT_TILES = [
  {
    label: 'AKTİF SÜREÇ',
    value: '—',
    accent: 'var(--color-primary-a14)',
    accentBorder: 'var(--color-primary-a28)',
    iconColor: 'var(--color-primary-700)',
    icon: (
      <svg className="ls-ic" width="22" height="22" viewBox="0 0 24 24">
        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
      </svg>
    ),
  },
  {
    label: 'GÖREV BEKLEYEN',
    value: '—',
    accent: 'var(--color-secondary-a16)',
    accentBorder: 'var(--color-secondary-a26)',
    iconColor: 'var(--color-secondary-700)',
    icon: (
      <svg className="ls-ic" width="22" height="22" viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    label: 'TAMAMLANAN',
    value: '—',
    accent: 'var(--color-success-soft)',
    accentBorder: 'rgba(16, 185, 129, 0.28)',
    iconColor: 'var(--color-success)',
    icon: (
      <svg className="ls-ic" width="22" height="22" viewBox="0 0 24 24">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    label: 'SLA RİSK',
    value: '—',
    accent: 'var(--color-danger-soft)',
    accentBorder: 'var(--color-danger-border)',
    iconColor: 'var(--color-danger)',
    icon: (
      <svg className="ls-ic" width="22" height="22" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
] as const;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.currentUser);
  const greeting = getGreeting();

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      {/* Top bar greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-bold leading-[var(--lh-2xl)] tracking-[var(--tracking-2xl)] text-[var(--color-fg)]">
            {greeting}
            {user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className="mt-[var(--space-2)] text-[var(--text-sm)] text-[var(--color-fg-muted)]">
            Lean Management platformuna hoş geldiniz
          </p>
        </div>
      </div>

      {/* Stat tile grid — 4 columns */}
      <div className="grid grid-cols-1 gap-[var(--space-6)] sm:grid-cols-2 lg:grid-cols-4">
        {STAT_TILES.map((tile) => (
          <div
            key={tile.label}
            className="ls-card flex items-center gap-[var(--space-5)]"
            style={{ padding: 'var(--space-6) var(--space-7)' }}
          >
            <div
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full"
              style={{
                background: tile.accent,
                border: `1px solid ${tile.accentBorder}`,
                color: tile.iconColor,
              }}
            >
              {tile.icon}
            </div>
            <div className="min-w-0">
              <p
                className="text-[var(--text-2xs)] font-medium uppercase tracking-[0.08em] text-[var(--color-fg-muted)]"
                style={{ letterSpacing: '0.08em' }}
              >
                {tile.label}
              </p>
              <p className="font-[family-name:var(--font-display)] text-[28px] font-bold leading-none tracking-tight text-[var(--color-fg)]">
                {tile.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Hero pair — two summary cards */}
      <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-12">
        {/* Left: recent activity summary */}
        <div className="ls-card lg:col-span-7">
          <div className="ls-card__header">
            <h2 className="ls-card__title">Son Aktivite</h2>
          </div>
          <div className="flex flex-col gap-[var(--space-5)]">
            <div className="flex items-center gap-[var(--space-4)] rounded-[var(--radius-md)] p-[var(--space-4)] transition-colors hover:bg-[var(--color-hover)]">
              <div
                className="ls-chip-icon--secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
                style={{
                  background: 'var(--color-secondary-a10)',
                  border: '1px solid var(--color-secondary-a26)',
                  color: 'var(--color-secondary-700)',
                }}
              >
                <svg className="ls-ic" width="17" height="17" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[var(--text-sm)] font-medium text-[var(--color-fg)]">
                  Henüz aktivite bulunmuyor
                </p>
                <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                  Süreç ve görevleriniz burada görünecek
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: aggregate progress summary */}
        <div className="ls-card lg:col-span-5">
          <div className="ls-card__header">
            <h2 className="ls-card__title">Genel Durum</h2>
          </div>

          {/* Multi-segment progress bar */}
          <div className="mb-[var(--space-6)] flex h-[6px] overflow-hidden rounded-full">
            <div
              className="rounded-full"
              style={{ width: '0%', background: 'var(--color-success)', minWidth: '4px' }}
            />
            <div
              className="rounded-full"
              style={{ width: '100%', background: 'var(--color-primary-a10)' }}
            />
          </div>

          <div className="grid grid-cols-3 gap-[var(--space-4)]">
            <div>
              <p className="text-[var(--text-2xs)] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
                Tamamlanan
              </p>
              <p className="text-[var(--text-xl)] font-semibold text-[var(--color-fg)]">—</p>
            </div>
            <div>
              <p className="text-[var(--text-2xs)] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
                Devam eden
              </p>
              <p className="text-[var(--text-xl)] font-semibold text-[var(--color-fg)]">—</p>
            </div>
            <div>
              <p className="text-[var(--text-2xs)] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
                Bekleyen
              </p>
              <p className="text-[var(--text-xl)] font-semibold text-[var(--color-fg)]">—</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA card — primary gradient */}
      <div
        className="relative overflow-hidden rounded-[var(--radius-xl)]"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary-400) 0%, var(--color-primary-700) 100%)',
          boxShadow: '0 12px 32px -8px var(--color-primary-a40)',
        }}
      >
        <div className="relative z-10 flex flex-col gap-[var(--space-4)] p-[var(--space-8)] sm:max-w-[60%]">
          <p
            className="text-[var(--text-2xs)] font-semibold uppercase text-white/75"
            style={{ letterSpacing: '0.08em' }}
          >
            Kaizen İyileştirme
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-bold leading-tight text-white">
            Yeni bir iyileştirme süreci başlatın
          </h2>
          <p className="text-[var(--text-sm)] leading-relaxed text-white/80">
            Sürekli iyileştirme kültürünü desteklemek için KTİ süreçlerinizi buradan yönetin.
          </p>
        </div>
        {/* Decorative gradient orb */}
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full opacity-20 sm:h-56 sm:w-56"
          style={{
            background: 'radial-gradient(circle, var(--color-primary-200) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-12 right-20 h-32 w-32 rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, var(--color-secondary-300) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Info row */}
      {user?.email ? (
        <div
          className="ls-card flex items-center gap-[var(--space-5)]"
          style={{ padding: 'var(--space-5) var(--space-7)' }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--color-info-soft)', color: 'var(--color-info)' }}
          >
            <svg className="ls-ic" width="17" height="17" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <p className="text-[var(--text-sm)] text-[var(--color-fg-soft)]">
            <span className="font-medium text-[var(--color-fg)]">E-posta:</span> {user.email}
          </p>
        </div>
      ) : null}
    </div>
  );
}
