import { expect, test, type Page } from '@playwright/test';

const rows = (page: Page) => page.locator('.list .row:not(.row--skeleton)');
const statValue = (page: Page, key: 'all' | 'success' | 'error') => page.locator(`.stat--${key} .stat__value`);

async function open(page: Page, path = '/') {
  await page.goto(path);
  await expect(rows(page).first()).toBeVisible();
  await expect(statValue(page, 'all')).toHaveText(/^\d+$/);
}

test('stats match the events in the list', async ({ page }) => {
  await open(page);
  const total = await rows(page).count();
  const ok = await page.locator('.list .row--success').count();
  const failed = await page.locator('.list .row--error').count();
  expect(total).toBeGreaterThanOrEqual(8);
  await expect(statValue(page, 'all')).toHaveText(String(total));
  await expect(statValue(page, 'success')).toHaveText(String(ok));
  await expect(statValue(page, 'error')).toHaveText(String(failed));
});

test('status filter shows only matching events and is kept in the URL', async ({ page }) => {
  await open(page);
  const errors = Number(await statValue(page, 'error').innerText());

  await page.getByRole('group', { name: 'Фильтр по статусу' }).getByRole('button', { name: /Ошибка/ }).click();
  await expect(page).toHaveURL(/status=error/);
  await expect(rows(page)).toHaveCount(errors);
  await expect(page.locator('.list .row--success')).toHaveCount(0);

  await page.reload();
  await expect(rows(page)).toHaveCount(errors);

  await page.getByRole('group', { name: 'Фильтр по статусу' }).getByRole('button', { name: /Все/ }).click();
  await expect(rows(page)).toHaveCount(Number(await statValue(page, 'all').innerText()));
});

test('opening an event shows its details, Esc closes them', async ({ page }) => {
  await open(page);
  const row = page.locator('.list .row--error').first();
  const message = await row.locator('.row__message').innerText();
  await row.click();

  const detail = page.locator('aside.detail--error');
  await expect(detail).toBeVisible();
  await expect(detail.locator('.detail__message')).toHaveText(message);
  await expect(detail.getByText('Событие не обработано')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/event=/);
});

test('event POSTed to the API appears in the list without reload', async ({ page, request }) => {
  await open(page);
  const before = Number(await statValue(page, 'all').innerText());

  const res = await request.post('/api/events', {
    data: { source: 'amoCRM', type: 'lead.created', status: 'success', message: 'E2E: заявка передана' },
  });
  expect(res.status()).toBe(201);
  const { id } = await res.json();

  await expect(page.locator(`#row-${id}`)).toBeVisible({ timeout: 10_000 });
  await expect(statValue(page, 'all')).toHaveText(String(before + 1));
});

test('API rejects an event with missing required fields', async ({ request }) => {
  const before = (await (await request.get('/api/events')).json()).length;
  const res = await request.post('/api/events', { data: { source: 'amoCRM' } });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('validation_error');
  expect(body.fields.map((f: { field: string }) => f.field).sort()).toEqual(['message', 'status', 'type']);
  expect((await (await request.get('/api/events')).json()).length).toBe(before);
});

test('test-event form shows validation errors, then adds a valid event', async ({ page }) => {
  await open(page);
  const before = Number(await statValue(page, 'all').innerText());

  await page.getByRole('button', { name: 'Добавить тестовое событие' }).click();
  const dialog = page.getByRole('dialog', { name: 'Тестовое событие' });
  await dialog.getByRole('button', { name: 'Невалидное', exact: true }).click();
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click();

  await expect(dialog.getByRole('alert')).toContainText('400');
  await expect(dialog.getByText('Поле «type» обязательно')).toBeVisible();
  await expect(statValue(page, 'all')).toHaveText(String(before));

  await dialog.getByRole('button', { name: 'С ошибкой', exact: true }).click();
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click();

  await expect(dialog).toBeHidden();
  await expect(statValue(page, 'all')).toHaveText(String(before + 1));
  await expect(page.locator('aside.detail--error .detail__message')).toContainText('429');
});

test('layout has no horizontal scroll', async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('mobile: details open full screen and the Back button returns to the list', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only behaviour');
  await open(page);
  await page.locator('.list .row').first().click();
  const detail = page.locator('aside.detail:not(.detail--placeholder)');
  await expect(detail).toBeVisible();
  const box = await detail.boundingBox();
  expect(box?.width).toBeCloseTo(page.viewportSize()!.width, 0);

  await page.goBack();
  await expect(detail).toBeHidden();
  await expect(rows(page).first()).toBeVisible();
});

test('switching the filter closes details of an event it hides', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on phones details cover the filters');
  await open(page, '/?event=evt-1011');
  await expect(page.locator('aside.detail--error')).toBeVisible();
  await page.locator('.stat--success').click();
  await expect(page).toHaveURL(/status=success/);
  await expect(page).not.toHaveURL(/event=/);
});

test('theme toggle cycles system → light → dark and survives a reload', async ({ page }) => {
  await open(page);
  const toggle = page.locator('.theme-toggle');
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? 'system');
  expect(await theme()).toBe('system');
  await toggle.click();
  expect(await theme()).toBe('light');
  await toggle.click();
  expect(await theme()).toBe('dark');
  await page.reload();
  expect(await theme()).toBe('dark');
  await toggle.click();
  expect(await theme()).toBe('system');
});
