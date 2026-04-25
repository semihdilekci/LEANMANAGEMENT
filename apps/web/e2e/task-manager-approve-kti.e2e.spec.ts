import { test, expect } from '@playwright/test';

const MANAGER_EMAIL = 'seed.manager@leanmgmt.local';
const MANAGER_PASSWORD = 'ManagerPass123!@#';

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('yönetici bekleyen KTİ görevini onaylar', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(MANAGER_EMAIL);
  await page.getByLabel('Şifre', { exact: true }).fill(MANAGER_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/tasks');
  await expect(page.getByRole('heading', { name: 'Görevlerim' })).toBeVisible();

  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 60_000 });
  await firstRow.click();

  await expect(page.getByRole('button', { name: 'Kaydet ve Tamamla' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Kaydet ve Tamamla' }).click();

  await expect(page).toHaveURL(/\/processes\/KTI-/, { timeout: 30_000 });
});
