import { expect, test, type Page } from '@playwright/test';

const nodes = (page: Page) => page.locator('.react-flow__node');
const edges = (page: Page) => page.locator('.react-flow__edge');

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  (page as Page & { consoleErrors?: string[] }).consoleErrors = errors;
  await page.goto('/');
  await expect(nodes(page)).toHaveCount(3);
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { consoleErrors?: string[] }).consoleErrors ?? []).toEqual([]);
});

test('zeigt das Beispielnetz und die Statusleiste', async ({ page }) => {
  await expect(edges(page)).toHaveCount(2);
  await expect(page.getByText('3 Geräte')).toBeVisible();
  await expect(page.getByText(/Simulation bereit/)).toBeVisible();
  await page.screenshot({ path: 'shots/now.png' });
});

test('Gerät per Tastatur hinzufügen, umbenennen, rückgängig machen', async ({ page }) => {
  await page.locator('[data-device-type="router"]').focus();
  await page.keyboard.press('Enter');
  await expect(nodes(page)).toHaveCount(4);
  const name = page.getByTestId('device-name');
  await expect(name).toHaveValue('Router1');
  await name.fill('Kernrouter');
  await name.press('Enter');
  await expect(page.locator('.react-flow__node', { hasText: 'Kernrouter' })).toBeVisible();

  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('.react-flow__node', { hasText: 'Router1' })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(nodes(page)).toHaveCount(3);
  await page.keyboard.press('Control+y');
  await expect(nodes(page)).toHaveCount(4);
});

test('Gerät per Drag & Drop ablegen und mit dem Kabel-Werkzeug verbinden', async ({ page }) => {
  await page.locator('[data-device-type="pc"]').dragTo(page.locator('.react-flow__pane'), {
    targetPosition: { x: 300, y: 120 },
  });
  await expect(nodes(page)).toHaveCount(4);
  await page.keyboard.press('k');
  await page.locator('.react-flow__node', { hasText: 'PC3' }).click();
  await page.locator('.react-flow__node', { hasText: 'Switch1' }).click();
  await expect(edges(page)).toHaveCount(3);
  await page.keyboard.press('Escape');
});

test('ungültige IP-Adresse wird abgelehnt', async ({ page }) => {
  await page.locator('.react-flow__node', { hasText: 'PC1' }).click();
  const ip = page.getByTestId('ip-eth0');
  await ip.fill('192.168.0.300');
  await ip.press('Enter');
  await expect(page.getByRole('alert').first()).toContainText('Keine gültige IPv4-Adresse');
  await ip.fill('10.0.10.5');
  await ip.press('Enter');
  await expect(page.locator('.react-flow__node', { hasText: '10.0.10.5/24' })).toBeVisible();
  await page.screenshot({ path: 'shots/panel.png' });
});

test('Dunkelmodus und englische Oberfläche', async ({ page }) => {
  await page.getByTitle('Hell/Dunkel umschalten').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByLabel('Sprache').selectOption('en');
  await expect(page.getByText('3 devices')).toBeVisible();
  await page.screenshot({ path: 'shots/dark.png' });
});

test('Autosave stellt den letzten Stand nach dem Neuladen wieder her', async ({ page }) => {
  await page.locator('[data-device-type="server"]').focus();
  await page.keyboard.press('Enter');
  await expect(nodes(page)).toHaveCount(4);
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(nodes(page)).toHaveCount(4);
  await expect(page.getByText('Letzter Stand wiederhergestellt.')).toBeVisible();
});

test('Gerät löschen entfernt seine Kabel', async ({ page }) => {
  await page.locator('.react-flow__node', { hasText: 'Switch1' }).click();
  await page.keyboard.press('Delete');
  await expect(nodes(page)).toHaveCount(2);
  await expect(edges(page)).toHaveCount(0);
});
