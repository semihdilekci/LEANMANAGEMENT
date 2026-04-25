import { test, expect } from '@playwright/test';

const SUPERADMIN_EMAIL = 'superadmin@leanmgmt.local';
const SUPERADMIN_PASSWORD = 'AdminPass123!@#';

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('giriş sonrası süreçler sayfası yüklenir', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(SUPERADMIN_EMAIL);
  await page.getByLabel('Şifre', { exact: true }).fill(SUPERADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/processes');
  await expect(page.getByRole('heading', { name: 'Süreçler' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Başlattığım Süreçler' })).toBeVisible();
});
