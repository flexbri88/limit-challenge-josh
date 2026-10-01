import { expect, test } from './fixtures';

// How the app behaves when the API or the URL is not what it expects.
test.describe('Error handling', () => {
  test('a list recovers after the API was unreachable', async ({ page }) => {
    const vehiclesApi = /\/api\/vehicles\//;
    await page.route(vehiclesApi, (route) => route.abort('connectionrefused'));

    await page.goto('/vehicles');
    await expect(page.getByText('Cannot reach the API server.', { exact: false })).toBeVisible();

    await page.unroute(vehiclesApi);
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('button', { name: /^Edit / }).first()).toBeVisible();
  });

  test('a failing dashboard section does not blank the page', async ({ page }) => {
    let failing = true;
    await page.route(/\/api\/offices\/summary\//, (route) =>
      failing
        ? route.fulfill({ status: 500, contentType: 'text/html', body: '<h1>Traceback</h1>' })
        : route.continue(),
    );

    await page.goto('/');
    await expect(page.getByText('The server ran into a problem. Please try again.')).toBeVisible();
    await expect(page.getByText('Traceback')).toHaveCount(0);
    // Other sections still render.
    await expect(page.getByRole('heading', { name: 'Needs maintenance' })).toBeVisible();
    await expect(page.getByText(/\d+ jobs ·/).first()).toBeVisible();

    failing = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(
      page.getByRole('table', { name: 'Office summary' }).getByRole('link').first(),
    ).toBeVisible();
  });

  test('malformed filters in the URL are explained instead of crashing', async ({ page }) => {
    await page.goto('/vehicles?maintained_from=abc&is_active=maybe');

    await expect(page.getByRole('heading', { name: 'Vehicles' })).toBeVisible();
    await expect(page.getByText(/^Is active: /)).toBeVisible();
    await expect(page.getByText('Enter a valid date.')).toBeVisible();
    await expect(page.getByText('Status: maybe')).toBeVisible();

    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByRole('button', { name: /^Edit / }).first()).toBeVisible();
  });

  test('a page past the end offers a way back', async ({ page }) => {
    await page.goto('/vehicles?page=999');

    await expect(page.getByText('This page no longer exists')).toBeVisible();
    await page.getByRole('button', { name: 'Go to first page' }).click();
    await expect(page).toHaveURL(/\/vehicles$/);
    await expect(page.getByRole('button', { name: /^Edit / }).first()).toBeVisible();
  });

  test('unknown routes show the not-found page', async ({ page }) => {
    await page.goto('/no-such-page');

    await expect(page.getByText('Page not found')).toBeVisible();
    await page.getByRole('link', { name: 'Go to the dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
