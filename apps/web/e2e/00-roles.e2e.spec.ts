import { test, expect } from '@playwright/test';

/**
 * Dosya adı `auth.e2e.spec.ts` önünde çalışsın diye `00-` öneki var:
 * `auth` içindeki şifre sıfırlama testi superadmin şifresini değiştirir; bu test
 * ondan önce koşmalı (varsayılan dosya sırası alfabetik).
 */
const SUPERADMIN_EMAIL = 'superadmin@leanmgmt.local';
const SUPERADMIN_PASSWORD = 'AdminPass123!@#';

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('superadmin roller sayfasına gider', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(SUPERADMIN_EMAIL);
  await page.getByLabel('Şifre', { exact: true }).fill(SUPERADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole('link', { name: 'Roller' }).click();
  await expect(page).toHaveURL(/\/roles$/);
  await expect(page.getByRole('heading', { name: 'Roller' })).toBeVisible();
});
