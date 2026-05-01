'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';

import { Permission } from '@leanmgmt/shared-types';

import { ConsentBlockingDialog } from '@/components/auth/consent-blocking-dialog';
import { AppBreadcrumbs } from '@/components/layout/AppBreadcrumbs';
import { PageRouteCardMotion } from '@/components/layout/PageRouteCardMotion';
import { SidebarProfileNavLink } from '@/components/layout/SidebarProfileNavLink';
import { PasswordExpiryBanner } from '@/components/layout/PasswordExpiryBanner';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { logoutRequest } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

function navLinkClass(active: boolean): string {
  if (active) {
    return [
      'ls-sidebar-nav-link ls-sidebar-nav-link--active',
      'flex items-center gap-[var(--space-4)] rounded-[var(--radius-md)] px-[var(--space-6)] py-[var(--space-5)] text-[var(--text-sm)] font-medium',
      'transition-all duration-[var(--dur-medium)]',
    ].join(' ');
  }
  return [
    'ls-sidebar-nav-link',
    'flex items-center gap-[var(--space-4)] rounded-[var(--radius-md)] px-[var(--space-6)] py-[var(--space-5)] text-[var(--text-sm)] font-medium text-[var(--color-sidebar-nav-idle)]',
    'transition-all duration-[var(--dur-medium)] hover:bg-[var(--color-hover)]',
  ].join(' ');
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.currentUser);
  const needConsent = Boolean(user?.activeConsentVersionId && !user.consentAccepted);
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavTitleId = useId();

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileNav();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen, closeMobileNav]);

  const showAppChrome = Boolean(user && !needConsent);

  const activeNavStyle = {
    background: 'var(--gradient-primary)',
    boxShadow: 'var(--shadow-cta)',
    color: 'var(--color-fg-inverse)',
  };

  const sidebarNav = showAppChrome ? (
    <nav
      aria-label="Ana menü"
      className="flex flex-col gap-[var(--space-2)] px-[var(--space-5)] pb-[var(--space-6)]"
    >
      <Link
        href="/dashboard"
        className={navLinkClass(isNavActive(pathname, '/dashboard'))}
        style={isNavActive(pathname, '/dashboard') ? activeNavStyle : undefined}
        onClick={closeMobileNav}
      >
        Ana Sayfa
      </Link>
      <Link
        href="/processes"
        className={navLinkClass(isNavActive(pathname, '/processes'))}
        style={isNavActive(pathname, '/processes') ? activeNavStyle : undefined}
        onClick={closeMobileNav}
      >
        Süreçler
      </Link>
      <Link
        href="/tasks"
        className={navLinkClass(isNavActive(pathname, '/tasks'))}
        style={isNavActive(pathname, '/tasks') ? activeNavStyle : undefined}
        onClick={closeMobileNav}
      >
        Görevlerim
      </Link>
      <PermissionGate permission={Permission.USER_LIST_VIEW}>
        <Link
          href="/users"
          className={navLinkClass(isNavActive(pathname, '/users'))}
          style={isNavActive(pathname, '/users') ? activeNavStyle : undefined}
          onClick={closeMobileNav}
        >
          Kullanıcılar
        </Link>
      </PermissionGate>
      <PermissionGate anyOf={[Permission.MASTER_DATA_VIEW, Permission.MASTER_DATA_MANAGE]}>
        <Link
          href="/master-data"
          className={navLinkClass(isNavActive(pathname, '/master-data'))}
          style={isNavActive(pathname, '/master-data') ? activeNavStyle : undefined}
          onClick={closeMobileNav}
        >
          Master Data
        </Link>
      </PermissionGate>
      <PermissionGate permission={Permission.ROLE_VIEW}>
        <Link
          href="/roles"
          className={navLinkClass(isNavActive(pathname, '/roles'))}
          style={isNavActive(pathname, '/roles') ? activeNavStyle : undefined}
          onClick={closeMobileNav}
        >
          Roller
        </Link>
      </PermissionGate>
      <PermissionGate permission={Permission.NOTIFICATION_READ}>
        <Link
          href="/settings/notifications"
          className={navLinkClass(isNavActive(pathname, '/settings/notifications'))}
          style={isNavActive(pathname, '/settings/notifications') ? activeNavStyle : undefined}
          onClick={closeMobileNav}
        >
          Bildirim ayarları
        </Link>
      </PermissionGate>
      <PermissionGate
        anyOf={[
          Permission.AUDIT_LOG_VIEW,
          Permission.SYSTEM_SETTINGS_VIEW,
          Permission.SYSTEM_SETTINGS_EDIT,
          Permission.CONSENT_VERSION_VIEW,
          Permission.CONSENT_VERSION_EDIT,
          Permission.CONSENT_VERSION_PUBLISH,
          Permission.EMAIL_TEMPLATE_VIEW,
        ]}
      >
        <Link
          href="/admin"
          className={navLinkClass(isNavActive(pathname, '/admin'))}
          style={isNavActive(pathname, '/admin') ? activeNavStyle : undefined}
          onClick={closeMobileNav}
        >
          Yönetim
        </Link>
      </PermissionGate>
    </nav>
  ) : null;

  return (
    <div
      className={
        showAppChrome
          ? 'flex h-screen max-h-screen flex-col overflow-hidden'
          : 'flex min-h-screen flex-col'
      }
      style={{ background: 'var(--gradient-page-bg)' }}
    >
      {user && !needConsent ? <PasswordExpiryBanner expiresAt={user.passwordExpiresAt} /> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {mobileNavOpen && showAppChrome ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              className="absolute inset-0"
              style={{ background: 'rgba(26, 43, 60, 0.38)', backdropFilter: 'blur(6px)' }}
              aria-label="Menüyü kapat"
              onClick={closeMobileNav}
            />
            <aside
              id="app-sidebar-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={mobileNavTitleId}
              className="absolute left-0 top-0 flex h-full w-[min(18rem,85vw)] flex-col"
              style={{
                background:
                  'linear-gradient(180deg, var(--color-primary-50) 0%, var(--color-surface-0) 100%)',
                boxShadow: 'var(--shadow-4)',
              }}
            >
              <div className="px-[var(--space-6)] py-[var(--space-5)]">
                <p
                  id={mobileNavTitleId}
                  className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-bold text-[var(--color-primary-700)]"
                >
                  Menü
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{sidebarNav}</div>
              <div className="px-[var(--space-5)] py-[var(--space-5)] text-[var(--text-sm)] text-[var(--color-sidebar-nav-idle)]">
                {user ? (
                  <div className="mb-[var(--space-4)]">
                    <SidebarProfileNavLink onNavigate={closeMobileNav} compact />
                  </div>
                ) : null}
                <div className="flex flex-col gap-[var(--space-3)]">
                  <button
                    type="button"
                    className="ls-btn ls-btn--neutral ls-btn--sm w-full"
                    onClick={() =>
                      void logoutRequest().then(() => {
                        window.location.href = '/login';
                      })
                    }
                  >
                    Çıkış
                  </button>
                  <Link
                    href="/profile/change-password"
                    className="text-center text-[var(--text-sm)] font-medium text-[var(--color-primary-600)]"
                    onClick={closeMobileNav}
                  >
                    Şifre değiştir
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {/* Masaüstü: sol panel — viewport ile sabit yükseklik; nav kendi içinde kayar */}
        {showAppChrome ? (
          <aside
            className="hidden h-full min-h-0 shrink-0 flex-col md:flex"
            style={{ width: 'var(--sidebar-width)', background: 'transparent' }}
            aria-label="Uygulama menüsü"
          >
            <div className="px-[var(--space-6)] py-[var(--space-7)]">
              <Link
                href="/dashboard"
                className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-bold tracking-[var(--tracking-lg)] text-[var(--color-primary-700)]"
              >
                Lean Management
              </Link>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{sidebarNav}</div>
            <div className="shrink-0 px-[var(--space-5)] py-[var(--space-5)]">
              <SidebarProfileNavLink />
            </div>
          </aside>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobil: üst çubuk + breadcrumb — ana içerikten ayrı; yalnızca main kayar */}
          {showAppChrome ? (
            <div
              className="flex shrink-0 items-center justify-between gap-[var(--space-3)] px-[var(--space-5)] py-[var(--space-4)] md:hidden"
              style={{ background: 'transparent' }}
            >
              <Link
                href="/dashboard"
                className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-bold text-[var(--color-primary-700)]"
              >
                Lean Management
              </Link>
              <div className="flex items-center gap-2">
                <PermissionGate permission={Permission.NOTIFICATION_READ}>
                  <NotificationBell />
                </PermissionGate>
                <button
                  type="button"
                  className="ls-btn ls-btn--neutral ls-btn--sm"
                  aria-expanded={mobileNavOpen}
                  aria-controls="app-sidebar-panel"
                  onClick={() => setMobileNavOpen((o) => !o)}
                >
                  Menü
                </button>
              </div>
            </div>
          ) : null}

          {showAppChrome ? (
            <div className="shrink-0 px-[var(--space-5)] py-[var(--space-2)] md:hidden">
              <AppBreadcrumbs />
            </div>
          ) : null}

          <header
            className={`shrink-0 px-[var(--space-8)] py-[var(--space-5)] ${showAppChrome ? 'hidden md:block' : ''}`}
            style={{ background: 'transparent' }}
          >
            <div
              className="mx-auto flex w-full items-center justify-between gap-[var(--space-4)]"
              style={{ maxWidth: 'var(--content-maxw)' }}
            >
              {user ? (
                <div className="min-w-0 flex-1 pr-[var(--space-4)]">
                  <AppBreadcrumbs />
                </div>
              ) : (
                <div className="min-w-0 flex-1" />
              )}
              {showAppChrome && user ? (
                <div className="flex shrink-0 items-center gap-[var(--space-5)]">
                  <PermissionGate permission={Permission.NOTIFICATION_READ}>
                    <NotificationBell />
                  </PermissionGate>
                  <span className="hidden text-[var(--text-sm)] font-medium text-[var(--color-fg-soft)] sm:inline">
                    {user.firstName} {user.lastName}
                  </span>
                  <button
                    type="button"
                    className="ls-btn ls-btn--neutral ls-btn--sm"
                    onClick={() =>
                      void logoutRequest().then(() => {
                        window.location.href = '/login';
                      })
                    }
                  >
                    Çıkış
                  </button>
                </div>
              ) : null}
              {user && needConsent ? (
                <div className="flex items-center gap-[var(--space-4)]">
                  <span className="text-[var(--text-sm)] font-medium text-[var(--color-fg-soft)]">
                    {user.firstName} {user.lastName}
                  </span>
                  <button
                    type="button"
                    className="ls-btn ls-btn--neutral ls-btn--sm"
                    onClick={() =>
                      void logoutRequest().then(() => {
                        window.location.href = '/login';
                      })
                    }
                  >
                    Çıkış
                  </button>
                </div>
              ) : null}
            </div>
          </header>
          <main
            className={`mx-auto min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-[var(--space-8)] py-[var(--space-7)] ${needConsent ? 'pointer-events-none select-none opacity-30' : ''}`}
            style={{ maxWidth: 'var(--content-maxw)' }}
            id="main-content"
            aria-hidden={needConsent}
          >
            <PageRouteCardMotion>{children}</PageRouteCardMotion>
          </main>
        </div>
      </div>
      {user && needConsent ? <ConsentBlockingDialog user={user} open={needConsent} /> : null}
    </div>
  );
}
