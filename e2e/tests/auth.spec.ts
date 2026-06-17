import { expect, test } from '@playwright/test';
import { DemoRole, ROLE_LABEL, loginAs } from '../fixtures/app';

test.describe('Authentication', () => {
  for (const role of Object.keys(ROLE_LABEL) as DemoRole[]) {
    test(`one-click demo login: ${role}`, async ({ page }) => {
      await loginAs(page, role);
      await expect(page).toHaveURL(/\/dashboard/);
      // the role badge shows in the sidebar
      await expect(page.locator('aside')).toContainText(ROLE_LABEL[role]);
    });
  }

  test('email + password login works for a demo account', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('demo-hm@vidyasetu.app').fill('demo-hm@vidyasetu.app');
    await page.locator('input[type="password"]').fill('demo1234');
    await page.getByRole('button', { name: /Login/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('wrong password shows an error and stays on login', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('demo-hm@vidyasetu.app').fill('demo-hm@vidyasetu.app');
    await page.locator('input[type="password"]').fill('definitely-wrong');
    await page.getByRole('button', { name: /Login/i }).click();
    await expect(page.getByText(/invalid/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
