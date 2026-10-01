import type { Page } from '@playwright/test';
import type { AuthTokens } from '../lib/types';
import { API_URL, DEMO_USER, TOKEN_STORAGE_KEY, expect, obtainTokens, test } from './fixtures';

// These tests start signed out and manage the session themselves.
test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(page: Page, user = DEMO_USER) {
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function storedTokens(page: Page): Promise<AuthTokens | null> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), TOKEN_STORAGE_KEY);
}

/** Stores a session in the browser, as if the user had signed in earlier. */
async function storeTokens(page: Page, tokens: AuthTokens) {
  await page.goto('/login');
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [TOKEN_STORAGE_KEY, JSON.stringify(tokens)],
  );
}

test.describe('Authentication', () => {
  test('a signed-out visit asks to sign in, then returns to the same page', async ({ page }) => {
    await page.goto('/vehicles?make=ford&is_active=true');

    await expect(page).toHaveURL(/\/login\?next=%2Fvehicles%3Fmake%3Dford%26is_active%3Dtrue$/);
    await expect(page.getByText('Sign in to continue.')).toBeVisible();
    await expect(page.getByLabel('Main navigation')).toHaveCount(0);

    await signIn(page);

    await expect(page).toHaveURL(/\/vehicles\?make=ford&is_active=true$/);
    await expect(page.getByLabel('Make')).toHaveValue('ford');
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('missing and wrong credentials are explained', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter your username.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();

    await signIn(page, { username: DEMO_USER.username, password: 'wrong-password' });
    await expect(page.getByText('Incorrect username or password.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(await storedTokens(page)).toBeNull();
  });

  test('signing out revokes the session', async ({ page, request }) => {
    await page.goto('/login');
    await signIn(page);
    await expect(page.getByText('Vehicles needing maintenance', { exact: true })).toBeVisible();
    const tokens = await storedTokens(page);

    await page.getByRole('button', { name: 'Sign out' }).click();

    // A deliberate sign-out does not offer to return to the previous page.
    await expect(page).toHaveURL(/\/login$/);
    expect(await storedTokens(page)).toBeNull();
    await expect
      .poll(async () => {
        const refresh = await request.post(`${API_URL}/auth/token/refresh/`, {
          data: { refresh: tokens!.refresh },
        });
        return refresh.status();
      })
      .toBe(401);

    await page.goto('/offices');
    await expect(page).toHaveURL(/\/login\?next=%2Foffices$/);
  });

  test('an expired access token is renewed without interrupting the user', async ({
    page,
    request,
  }) => {
    const { refresh } = await obtainTokens(request);
    await storeTokens(page, { access: 'expired-access-token', refresh });

    await page.goto('/mechanics');

    await expect(page.getByRole('button', { name: /^Edit / }).first()).toBeVisible();
    const renewed = await storedTokens(page);
    expect(renewed?.access).not.toBe('expired-access-token');
    expect(renewed?.refresh).not.toBe(refresh);
  });

  test('a session that can no longer be renewed asks to sign in again', async ({ page }) => {
    await storeTokens(page, { access: 'expired-access-token', refresh: 'revoked-refresh-token' });

    await page.goto('/mechanics');

    await expect(page).toHaveURL(/\/login\?next=%2Fmechanics$/);
    await expect(page.getByText('Sign in to continue.')).toBeVisible();
    await signIn(page);
    await expect(page).toHaveURL(/\/mechanics$/);
  });

  test('the login page sends a signed-in user to the dashboard', async ({ page, request }) => {
    await storeTokens(page, await obtainTokens(request));

    await page.goto('/login');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Vehicles needing maintenance', { exact: true })).toBeVisible();
  });
});
