import { expect, test, type Page } from '@playwright/test';

const node = (page: Page, name: string) => page.locator('.react-flow__node', { hasText: name });

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  (page as Page & { consoleErrors?: string[] }).consoleErrors = errors;
  await page.goto('/');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { consoleErrors?: string[] }).consoleErrors ?? []).toEqual([]);
});

test('Simulation starten, Rechner anpingen, Kabel leuchten, Switch-Tabelle füllt sich', async ({ page }) => {
  await page.getByRole('button', { name: 'Simulation' }).click();
  await expect(page.locator('[data-device-type="pc"]')).toBeDisabled();
  await page.getByTestId('sim-speed').selectOption('fast');

  await node(page, 'Rechner1').click();
  const input = page.getByTestId('terminal-input');
  await input.fill('ping 192.168.0.11');
  await input.press('Enter');
  // Während der Übertragung leuchtet mindestens ein Kabel grün (Original: Farbe 0,255,64).
  await expect(page.locator('.react-flow__edge-path[style*="--color-cable-active"]').first()).toBeVisible();
  await page.screenshot({ path: 'shots/simulation.png' });
  await expect(page.getByTestId('terminal-output')).toContainText(
    '4 Paket(e) gesendet, 4 Paket(e) empfangen, 0% Paketverlust',
    { timeout: 15_000 },
  );
  await expect(page.getByTestId('terminal-output')).toContainText('icmp_seq=1 ttl=64');

  await node(page, 'Switch1').click();
  await expect(page.getByTestId('mac-table').locator('tbody tr')).toHaveCount(2);

  // Zurück in den Entwurf: Bearbeiten wieder möglich.
  await page.getByRole('button', { name: 'Entwurf' }).click();
  await expect(page.locator('[data-device-type="pc"]')).toBeEnabled();
  await expect(page.getByTestId('device-properties')).toBeVisible();
});

test('ipconfig und unbekannter Befehl in der Befehlszeile', async ({ page }) => {
  await page.keyboard.press('Control+r');
  await node(page, 'Rechner2').click();
  const input = page.getByTestId('terminal-input');
  await input.fill('ipconfig');
  await input.press('Enter');
  await expect(page.getByTestId('terminal-output')).toContainText('IP Adresse . . . : 192.168.0.11');
  await input.fill('xyz');
  await input.press('Enter');
  await expect(page.getByTestId('terminal-output')).toContainText('Unbekannter Befehl!');
});
