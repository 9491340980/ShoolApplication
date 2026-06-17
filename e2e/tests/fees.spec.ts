import { expect, test } from '@playwright/test';
import { gotoPage, loginAs } from '../fixtures/app';

test.describe('Fees — installments', () => {
  test('set a total, collect an installment, balance is correct', async ({ page }) => {
    await loginAs(page, 'headmaster');
    await gotoPage(page, '/fees');

    await page.locator('select').first().selectOption('8A');

    // first student row that has a total-fee input
    const row = page
      .locator('div.divide-y > div')
      .filter({ has: page.locator('input[type="number"]') })
      .first();

    // set total = 5000 (commits on blur)
    const total = row.locator('input[type="number"]').first();
    await total.fill('5000');
    await total.blur();

    // collect a 2000 installment
    const collect = row.locator('input[type="number"]').nth(1);
    await collect.fill('2000');
    await row.getByRole('button', { name: /Collect/i }).click();

    // paid 2000, balance 3000
    await expect(row).toContainText('2000');
    await expect(row).toContainText('3000');
  });
});
