import { expect, test } from '@playwright/test';
import { DemoRole, ROLE_LABEL, loginAs, trackPageErrors } from '../fixtures/app';

/**
 * Smoke: for every role, visit every sidebar page and assert it renders without
 * a crash. Auto-covers each role's whole menu, so new pages are tested for free.
 */
for (const role of Object.keys(ROLE_LABEL) as DemoRole[]) {
  test(`smoke — ${role}: every sidebar page loads`, async ({ page }) => {
    const errors = trackPageErrors(page);
    await loginAs(page, role);

    const hrefs = await page
      .locator('aside a[href]')
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute('href')).filter((h): h is string => !!h && h.startsWith('/')),
      );
    const routes = [...new Set(hrefs)];
    expect(routes.length, 'sidebar should have nav links').toBeGreaterThan(0);

    for (const href of routes) {
      await page.locator(`aside a[href="${href}"]`).first().click();
      await page.waitForURL(`**${href}`);
      // shell + a page heading are present → the route rendered
      await expect(page.locator('app-shell')).toBeVisible();
      await expect(page.locator('header h1')).toBeVisible();
    }

    expect(errors, `uncaught errors:\n${errors.join('\n')}`).toHaveLength(0);
  });
}
