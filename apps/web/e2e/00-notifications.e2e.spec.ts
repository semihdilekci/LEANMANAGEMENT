import { test, expect } from '@playwright/test';

/**
 * `00-` öneki: `auth.e2e.spec.ts` içindeki şifre sıfırlama superadmin şifresini değiştirir;
 * bu smoke testleri varsayılan şifre ile o dosyadan önce çalışmalı (alfabetik sıra).
 */
const SUPERADMIN_EMAIL = 'superadmin@leanmgmt.local';
const SUPERADMIN_PASSWORD = 'AdminPass123!@#';

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('bildirim merkezi sayfası açılır', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(SUPERADMIN_EMAIL);
  await page.getByLabel('Şifre', { exact: true }).fill(SUPERADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Bildirimler' })).toBeVisible();
});

test('süperadmin e-posta şablonları listesine erişir', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(SUPERADMIN_EMAIL);
  await page.getByLabel('Şifre', { exact: true }).fill(SUPERADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/admin/email-templates');
  await expect(page.getByRole('heading', { name: 'E-posta şablonları' })).toBeVisible();
});
