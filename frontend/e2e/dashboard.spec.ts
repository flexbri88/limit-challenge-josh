import { expect, test } from './fixtures';

test('the dashboard summarises the fleet and links into the vehicle search', async ({ page }) => {
  await page.goto('/');

  for (const tile of ['Maintenance cost, last 12 months', 'Vehicles needing maintenance']) {
    await expect(page.getByText(tile, { exact: true })).toBeVisible();
  }
  // The seed guarantees never-serviced vehicles.
  await expect(page.getByText('Never serviced').first()).toBeVisible();

  const officeLink = page.getByRole('table', { name: 'Office summary' }).getByRole('link').first();
  await officeLink.click();
  await expect(page).toHaveURL(/\/vehicles\?office=\d+&is_active=true/);
  await expect(page.getByText(/vehicles? match(es)? your filters/)).toBeVisible();
});
