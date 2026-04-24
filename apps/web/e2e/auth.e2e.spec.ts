import { test, expect } from '@playwright/test';

const SUPERADMIN_EMAIL = 'superadmin@leanmgmt.local';
const SUPERADMIN_PASSWORD = 'AdminPass123!@#';
const NEW_PASSWORD = 'NewAdminPass456!@#';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('başarılı giriş sonrası panel görünür', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(SUPERADMIN_EMAIL);
  await page.getByLabel('Şifre', { exact: true }).fill(SUPERADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Ana sayfa' })).toBeVisible();
  await expect(page.getByText(/Hoş geldiniz/)).toBeVisible();
});

const CONSENT_PENDING_EMAIL = 'consentpending@leanmgmt.local';
const CONSENT_PENDING_PASSWORD = 'PendingPass123!@#';

test('KVKK rıza: onay sonrası ana sayfa', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(CONSENT_PENDING_EMAIL);
  await page.getByLabel('Şifre', { exact: true }).fill(CONSENT_PENDING_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('alertdialog', { name: 'Aydınlatma ve Açık Rıza' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Rıza metnini okudum/ }).check();
  await page.getByRole('button', { name: 'Onaylıyorum' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Aydınlatma ve Açık Rıza' })).toBeHidden({
    timeout: 20_000,
  });
  await expect(page.getByRole('heading', { name: 'Ana sayfa' })).toBeVisible();
});

test('hatalı şifre ile giriş uyarısı', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(SUPERADMIN_EMAIL);
  await page.getByLabel('Şifre', { exact: true }).fill('YanlisSifre123!@#');
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.locator('.ls-alert.ls-alert--danger')).toContainText(
    /hatalı|Email veya şifre/i,
  );
});

test('şifre sıfırlama: talep ve yeni şifre ile onay', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByLabel('E-posta').fill(SUPERADMIN_EMAIL);
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes('/api/v1/auth/password-reset-request') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Bağlantı gönder' }).click(),
  ]);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as {
    success: boolean;
    data: { resetToken?: string; message: string };
  };
  expect(body.success).toBe(true);
  expect(body.data.resetToken).toBeTruthy();
  const token = body.data.resetToken as string;

  await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
  await page.getByLabel('Yeni şifre').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Şifreyi güncelle' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('E-posta').fill(SUPERADMIN_EMAIL);
  await page.getByLabel('Şifre', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
