import { expect, test } from '@playwright/test';
import { gotoPage, loginAs } from '../fixtures/app';

test.describe('Attendance', () => {
  test('Head Master can mark a class all-present and save', async ({ page }) => {
    await loginAs(page, 'headmaster');
    await gotoPage(page, '/attendance');

    // pick a class that has seeded students
    await page.locator('select').first().selectOption('8A');
    await expect(page.getByText(/Total:/i)).toBeVisible();

    await page.getByRole('button', { name: /All Present/i }).click();
    await page.getByRole('button', { name: /Save Attendance/i }).click();

    await expect(page.getByText(/Attendance Saved/i)).toBeVisible();
    // everyone present → absent count is zero
    await expect(page.getByText(/Absent:\s*0/i)).toBeVisible();
  });
});
