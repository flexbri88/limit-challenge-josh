import { expect, randomVin, test, uid } from './fixtures';

test.describe('Vehicles', () => {
  test('search filters live in the URL and survive a reload', async ({ page, api }) => {
    const office = await api.office();
    const make = `Make${uid()}`;
    const active = await api.vehicle(office.id, { make });
    const retired = await api.vehicle(office.id, { make, is_active: false });

    await page.goto('/vehicles');
    await page.getByLabel('Make').fill(make.toLowerCase());
    await expect(page).toHaveURL(new RegExp(`make=${make.toLowerCase()}`));
    await expect(page.getByText('2 vehicles match your filters')).toBeVisible();

    await page.getByRole('combobox', { name: /Status/ }).click();
    await page.getByRole('option', { name: 'Inactive' }).click();
    await expect(page).toHaveURL(/is_active=false/);
    await expect(
      page.getByRole('cell', { name: retired.license_plate, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: active.license_plate, exact: true })).toHaveCount(
      0,
    );

    await page.reload();
    await expect(page.getByLabel('Make')).toHaveValue(make.toLowerCase());
    await expect(page.getByText('1 vehicle matches your filters')).toBeVisible();

    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page).toHaveURL(/\/vehicles$/);
    await expect(page.getByLabel('Make')).toHaveValue('');
  });

  test('create shows duplicate warnings, client checks and API validation', async ({
    page,
    api,
  }) => {
    const office = await api.office();
    const existing = await api.vehicle(office.id);

    await page.goto('/vehicles');
    await page.getByRole('button', { name: 'Add vehicle' }).first().click();
    const dialog = page.getByRole('dialog');

    // Duplicate check runs when the plate field loses focus.
    await dialog.getByLabel('License plate').fill(existing.license_plate.toLowerCase());
    await dialog.getByLabel('Make').click();
    await expect(dialog.getByText('An active vehicle already has this plate.')).toBeVisible();

    const plate = `E2E-${uid()}`;
    await dialog.getByLabel('VIN').fill('NOT-A-VIN');
    await dialog.getByLabel('License plate').fill(plate);
    await dialog.getByLabel('Make').fill('Ford');
    await dialog.getByLabel('Model').fill('Transit');
    await dialog.getByRole('button', { name: 'Add vehicle' }).click();
    await expect(dialog.getByText('Select an office.')).toBeVisible();

    await dialog.getByRole('combobox', { name: /Office/ }).click();
    await page.getByRole('option', { name: new RegExp(office.name) }).click();
    await dialog.getByRole('button', { name: 'Add vehicle' }).click();
    await expect(dialog.getByText(/VIN must be 17 characters/)).toBeVisible();

    await dialog.getByLabel('VIN').fill(randomVin());
    await dialog.getByRole('button', { name: 'Add vehicle' }).click();
    await expect(page.getByText(`Vehicle ${plate} created.`)).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test('edit and delete from the list', async ({ page, api }) => {
    const office = await api.office();
    const vehicle = await api.vehicle(office.id);

    await page.goto(`/vehicles?search=${vehicle.license_plate}`);
    await page.getByRole('button', { name: `Edit ${vehicle.license_plate}` }).click();
    await page.getByRole('dialog').getByLabel('Model').fill('Transit Connect');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(`Vehicle ${vehicle.license_plate} updated.`)).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Ford Transit Connect' })).toBeVisible();

    await page.getByRole('button', { name: `Delete ${vehicle.license_plate}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(`Vehicle ${vehicle.license_plate} deleted.`)).toBeVisible();
    await expect(page.getByText('No vehicles match these filters')).toBeVisible();
  });
});
