import { expect, type Page } from '@playwright/test';

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signInAndWaitForDashboard(page: Page, email: string, password: string): Promise<void> {
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  // The sidebar is replaced by a drawer on small screens; the account menu is visible at every size.
  await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible();
}

/** True when the page body is wider than the viewport (unintended horizontal scrolling). */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}
