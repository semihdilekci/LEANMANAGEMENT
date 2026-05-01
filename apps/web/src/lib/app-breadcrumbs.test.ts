import { describe, expect, it } from 'vitest';

import { getAppBreadcrumbs } from './app-breadcrumbs';

describe('getAppBreadcrumbs', () => {
  it('dashboard ve kök için tek öğe', () => {
    expect(getAppBreadcrumbs('/dashboard')).toEqual([{ href: '/dashboard', label: 'Ana Sayfa' }]);
    expect(getAppBreadcrumbs('/')).toEqual([{ href: '/dashboard', label: 'Ana Sayfa' }]);
  });

  it('süreç listesi', () => {
    expect(getAppBreadcrumbs('/processes')).toEqual([
      { href: '/dashboard', label: 'Ana Sayfa' },
      { href: '/processes', label: 'Süreçler' },
    ]);
  });

  it('yeni kti üçlemesi tek başlıkta birleşir', () => {
    expect(getAppBreadcrumbs('/processes/kti/start')).toEqual([
      { href: '/dashboard', label: 'Ana Sayfa' },
      { href: '/processes', label: 'Süreçler' },
      { href: '/processes/kti/start', label: 'Yeni KTİ' },
    ]);
  });

  it('bildirim ayarları birleşik etiket', () => {
    expect(getAppBreadcrumbs('/settings/notifications')).toEqual([
      { href: '/dashboard', label: 'Ana Sayfa' },
      { href: '/settings/notifications', label: 'Bildirim ayarları' },
    ]);
  });

  it('profil kökü', () => {
    expect(getAppBreadcrumbs('/profile')).toEqual([
      { href: '/dashboard', label: 'Ana Sayfa' },
      { href: '/profile', label: 'Profilim' },
    ]);
  });

  it('şifre değiştir', () => {
    expect(getAppBreadcrumbs('/profile/change-password')).toEqual([
      { href: '/dashboard', label: 'Ana Sayfa' },
      { href: '/profile/change-password', label: 'Şifre değiştir' },
    ]);
  });

  it('display id süreç detayı', () => {
    expect(getAppBreadcrumbs('/processes/KTI-000042')).toEqual([
      { href: '/dashboard', label: 'Ana Sayfa' },
      { href: '/processes', label: 'Süreçler' },
      { href: '/processes/KTI-000042', label: 'KTI-000042' },
    ]);
  });
});
