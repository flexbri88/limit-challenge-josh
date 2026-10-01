import { expect, isoDate, test } from './fixtures';

test.describe('Maintenance', () => {
  test('logging validates in the form and in the API', async ({ page, api }) => {
    const office = await api.office();
    const mechanic = await api.mechanic();
    const vehicle = await api.vehicle(office.id);

    await page.goto('/maintenance');
    await page.getByRole('button', { name: 'Log maintenance' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Log maintenance' }).click();
    await expect(dialog.getByText('Select a vehicle.')).toBeVisible();

    await dialog.getByRole('combobox', { name: /Vehicle/ }).fill(vehicle.license_plate);
    await page.getByRole('option', { name: new RegExp(vehicle.license_plate) }).click();
    await dialog.getByRole('combobox', { name: /Mechanic/ }).click();
    await page.getByRole('option', { name: new RegExp(mechanic.name) }).click();
    await dialog.getByRole('combobox', { name: /Type/ }).click();
    await page.getByRole('option', { name: 'Oil change' }).click();
    await dialog.getByLabel('Cost').fill('89.90');
    await dialog.getByLabel('Date').fill(isoDate(3));
    await dialog.getByRole('button', { name: 'Log maintenance' }).click();
    await expect(dialog.getByText('Maintenance date cannot be in the future.')).toBeVisible();

    await dialog.getByLabel('Date').fill(isoDate(0));
    await dialog.getByRole('button', { name: 'Log maintenance' }).click();
    await expect(page.getByText(`Maintenance for ${vehicle.license_plate} logged.`)).toBeVisible();
  });

  test('deleting the last row of a page steps back a page', async ({ page, api }) => {
    const office = await api.office();
    const mechanic = await api.mechanic();
    const vehicle = await api.vehicle(office.id);
    for (let day = 1; day <= 11; day += 1) {
      await api.record(vehicle.id, mechanic.id, { date: isoDate(-day) });
    }

    await page.goto(`/maintenance?vehicle=${vehicle.id}&page=2`);
    const editButtons = page.getByRole('button', { name: /^Edit record/ });
    await expect(editButtons).toHaveCount(1);

    await page.getByRole('button', { name: /^Delete record/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Maintenance record deleted.')).toBeVisible();
    await expect(page).not.toHaveURL(/page=2/);
    await expect(editButtons).toHaveCount(10);
    await expect(page.getByRole('alert').filter({ hasText: /Invalid page|problem/ })).toHaveCount(
      0,
    );
  });

  test('type filter is kept in the URL', async ({ page, api }) => {
    const office = await api.office();
    const mechanic = await api.mechanic();
    const vehicle = await api.vehicle(office.id);
    await api.record(vehicle.id, mechanic.id, { maintenance_type: 'inspection' });

    await page.goto(`/maintenance?vehicle=${vehicle.id}`);
    await page.getByRole('combobox', { name: /Type/ }).click();
    await page.getByRole('option', { name: 'Brakes' }).click();

    await expect(page).toHaveURL(/maintenance_type=brakes/);
    await expect(page.getByText('No records match these filters')).toBeVisible();
  });
});
