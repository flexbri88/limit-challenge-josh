import { expect, test } from './fixtures';

test.describe('Vehicle detail', () => {
  test('moves a vehicle to another office', async ({ page, api }) => {
    const from = await api.office();
    const to = await api.office();
    const vehicle = await api.vehicle(from.id);

    await page.goto(`/vehicles/${vehicle.id}`);
    await expect(page.getByText(`${from.name} · Testville`)).toBeVisible();

    await page.getByRole('button', { name: 'Move office' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Move vehicle' }).click();
    await expect(dialog.getByText('Select an office.')).toBeVisible();

    await dialog.getByRole('combobox', { name: /New office/ }).click();
    await page.getByRole('option', { name: new RegExp(to.name) }).click();
    await dialog.getByRole('button', { name: 'Move vehicle' }).click();
    await expect(page.getByText(`${vehicle.license_plate} moved to ${to.name}.`)).toBeVisible();
    await expect(page.getByText(`${to.name} · Testville`)).toBeVisible();
  });

  test('logging maintenance clears the never-serviced warning', async ({ page, api }) => {
    const office = await api.office();
    const mechanic = await api.mechanic();
    const vehicle = await api.vehicle(office.id);

    await page.goto(`/vehicles/${vehicle.id}`);
    await expect(page.getByText('This vehicle has never been serviced.')).toBeVisible();

    await page.getByRole('button', { name: 'Log maintenance' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('combobox', { name: /Vehicle/ })).toBeDisabled();
    await dialog.getByRole('combobox', { name: /Mechanic/ }).click();
    await page.getByRole('option', { name: new RegExp(mechanic.name) }).click();
    await dialog.getByRole('combobox', { name: /Type/ }).click();
    await page.getByRole('option', { name: 'Brakes' }).click();
    await dialog.getByLabel('Cost').fill('250');
    await dialog.getByRole('button', { name: 'Log maintenance' }).click();

    await expect(page.getByText(`Maintenance for ${vehicle.license_plate} logged.`)).toBeVisible();
    await expect(page.getByText('This vehicle has never been serviced.')).toBeHidden();
    await expect(page.getByRole('table', { name: 'Maintenance history' })).toContainText(
      mechanic.name,
    );
  });

  test('deleting returns to the list', async ({ page, api }) => {
    const office = await api.office();
    const vehicle = await api.vehicle(office.id);

    await page.goto(`/vehicles/${vehicle.id}`);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).toHaveURL(/\/vehicles$/);
    await expect(page.getByText(`Vehicle ${vehicle.license_plate} deleted.`)).toBeVisible();
  });

  test('an unknown vehicle shows a not-found state', async ({ page }) => {
    await page.goto('/vehicles/999999');

    await expect(page.getByText('Vehicle not found')).toBeVisible();
    await page.getByRole('link', { name: 'Back to vehicles' }).click();
    await expect(page).toHaveURL(/\/vehicles$/);
  });
});
