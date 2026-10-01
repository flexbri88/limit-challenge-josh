import { expect, test, uid } from './fixtures';

test.describe('Offices', () => {
  test('create validates required fields', async ({ page }) => {
    const name = `E2E Office ${uid()}`;

    await page.goto('/offices');
    await page.getByRole('button', { name: 'Add office' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Add office' }).click();
    await expect(dialog.getByText('This field may not be blank.')).toHaveCount(2);

    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('City').fill('Testville');
    await dialog.getByRole('button', { name: 'Add office' }).click();
    await expect(page.getByText(`Office ${name} created.`)).toBeVisible();
  });

  test('an office that still has vehicles cannot be deleted', async ({ page, api }) => {
    const office = await api.office();
    await api.vehicle(office.id);

    await page.goto('/offices?page_size=50');
    await page.getByRole('button', { name: `Delete ${office.name}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(
      page.getByText('Cannot delete this item because it is still referenced by 1 vehicle.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: office.name })).toBeVisible();
  });
});

test.describe('Mechanics', () => {
  test('certification numbers must be unique', async ({ page, api }) => {
    const existing = await api.mechanic();

    await page.goto('/mechanics');
    await page.getByRole('button', { name: 'Add mechanic' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Duplicate Person');
    await dialog.getByLabel('Certification number').fill(existing.certification_number);
    await dialog.getByRole('button', { name: 'Add mechanic' }).click();

    await expect(
      dialog.getByText('A mechanic with this certification number already exists.'),
    ).toBeVisible();
  });

  test('status filter is kept in the URL', async ({ page, api }) => {
    await api.mechanic({ is_active: false });

    await page.goto('/mechanics');
    await page.getByRole('button', { name: 'Inactive', exact: true }).click();

    await expect(page).toHaveURL(/is_active=false/);
    const table = page.getByRole('table', { name: 'Mechanics' });
    await expect(table.getByText('Inactive').first()).toBeVisible();
    await expect(table.getByText('Active', { exact: true })).toHaveCount(0);
  });
});
