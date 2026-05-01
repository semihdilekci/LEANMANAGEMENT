import { test, expect } from '@playwright/test';

const SUPERADMIN_EMAIL = 'superadmin@leanmgmt.local';
const SUPERADMIN_PASSWORD = 'AdminPass123!@#';

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('KTİ başlatma sayfası yüklenir ve form adımları görünür', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(SUPERADMIN_EMAIL);
  await page.getByLabel('Şifre', { exact: true }).fill(SUPERADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/processes/kti/start');
  await expect(page.getByRole('heading', { name: /Yeni KTİ/i })).toBeVisible();
  await expect(page.getByText('1. Bilgiler ve dosyalar')).toBeVisible();
  await expect(page.getByText('Öncesi fotoğraflar *')).toBeVisible();
  await expect(page.locator('label').filter({ hasText: 'Dosya seç' }).first()).toBeVisible();
});
