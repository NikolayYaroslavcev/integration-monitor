import { expect, test, type Page } from '@playwright/test';

const rows = (page: Page) => page.locator('.list .row:not(.row--skeleton)');
const statValue = (page: Page, key: 'all' | 'success' | 'error') => page.locator(`.stat--${key} .stat__value`);

async function open(page: Page, path = '/') {
  await page.goto(path);
  await expect(rows(page).first()).toBeVisible();
  await expect(statValue(page, 'all')).toHaveText(/^\d+$/);
}

test('stats match the events returned by the API', async ({ page, request }) => {
  await open(page);
  const events: { status: string }[] = await (await request.get('/api/events')).json();
  expect(events.length).toBeGreaterThanOrEqual(8);
  await expect(statValue(page, 'all')).toHaveText(String(events.length));
  await expect(statValue(page, 'success')).toHaveText(String(events.filter((e) => e.status === 'success').length));
  await expect(statValue(page, 'error')).toHaveText(String(events.filter((e) => e.status === 'error').length));
  const shown = await rows(page).count();
  expect(shown).toBe(Math.min(50, events.length));
});

test('status filter shows only matching events and is kept in the URL', async ({ page }) => {
  await open(page);
  const errors = Number(await statValue(page, 'error').innerText());

  await page.getByRole('group', { name: 'Фильтр по статусу' }).getByRole('button', { name: /Ошибка/ }).click();
  await expect(page).toHaveURL(/status=error/);
  await expect(rows(page)).toHaveCount(Math.min(50, errors));
  await expect(page.locator('.list .row--success')).toHaveCount(0);

  await page.reload();
  await expect(rows(page)).toHaveCount(Math.min(50, errors));

  await page.getByRole('group', { name: 'Фильтр по статусу' }).getByRole('button', { name: /Все/ }).click();
  await expect(rows(page)).toHaveCount(Math.min(50, Number(await statValue(page, 'all').innerText())));
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

  // Delivered over SSE: well under the 5 s polling fallback.
  await expect(page.locator('.sync')).toContainText('В реальном времени');
  await expect(page.locator(`#row-${id}`)).toBeVisible({ timeout: 2_000 });
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

test('long lists render in pages of 50 and load more on demand', async ({ page, request, isMobile }) => {
  test.skip(isMobile, 'same logic on every screen size');
  const total = (await (await request.get('/api/events')).json()).length;
  for (let i = total; i < 60; i++) {
    await request.post('/api/events', {
      data: { source: 'Tilda', type: 'form.submitted', status: 'success', message: `Пакетная заявка №${i}` },
    });
  }
  await open(page);
  await expect(rows(page)).toHaveCount(50);
  await expect(page.locator('.load-more')).toContainText('Показано 50 из');
  await page.locator('.load-more button').click();
  await expect(page.locator('.load-more')).toHaveCount(0);
  expect(await rows(page).count()).toBeGreaterThanOrEqual(60);
});
