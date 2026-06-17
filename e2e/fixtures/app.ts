import { Page, expect } from '@playwright/test';

/** The four one-click demo roles on the sign-in screen (English labels). */
export const ROLE_LABEL = {
  headmaster: 'Head Master',
  teacher: 'Teacher',
  parent: 'Parent',
  student: 'Student',
} as const;

export type DemoRole = keyof typeof ROLE_LABEL;

/** Sign in via the one-click demo button and land on the dashboard. */
export async function loginAs(page: Page, role: DemoRole) {
  await page.goto('/');
  const btn = page.getByRole('button', { name: ROLE_LABEL[role] }).first();
  await btn.waitFor({ state: 'visible' });
  await btn.click();
  await page.waitForURL('**/dashboard');
  await expect(page.locator('app-shell')).toBeVisible();
}

/** Click a sidebar nav link by its route and wait for the page to settle. */
export async function gotoPage(page: Page, href: string) {
  await page.locator(`aside a[href="${href}"]`).first().click();
  await page.waitForURL(`**${href}`);
}

/** Collect uncaught JS errors so a test can assert the page didn't crash. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
