// npm run demo — needs a running server (BASE_URL, default http://localhost:3001).

const BASE = process.env.BASE_URL ?? 'http://localhost:3001';

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const color = (code) => (code < 300 ? `\x1b[32m${code}\x1b[0m` : `\x1b[31m${code}\x1b[0m`);

async function call(title, method, path, body) {
  console.log(`\n${bold(title)}`);
  console.log(dim(`${method} ${path}${body !== undefined ? `\n${JSON.stringify(body, null, 2)}` : ''}`));
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  console.log(`→ ${color(res.status)}`);
  return { status: res.status, json };
}

try {
  const before = await call('1. Текущий список', 'GET', '/api/events');
  console.log(`   событий: ${before.json.length}`);

  const ok = await call('2. Успешный POST', 'POST', '/api/events', {
    source: 'amoCRM',
    type: 'lead.created',
    status: 'success',
    message: 'Заявка успешно передана',
  });
  console.log(JSON.stringify(ok.json, null, 2));

  const bad = await call('3. POST без обязательных полей → ошибка валидации', 'POST', '/api/events', {
    source: 'Bitrix24',
    status: 'pending',
  });
  console.log(JSON.stringify(bad.json, null, 2));

  const typo = await call('4. POST с опечаткой в имени поля', 'POST', '/api/events', {
    source: 'Tilda',
    type: 'form.submitted',
    staus: 'success',
    message: 'Заявка с формы',
  });
  console.log(JSON.stringify(typo.json, null, 2));

  const after = await call('5. Список после запросов', 'GET', '/api/events');
  const first = after.json[0];
  console.log(`   событий: ${after.json.length} (было ${before.json.length}); первое: ${first.id} ${first.source} ${first.type}`);

  const passed = ok.status === 201 && bad.status === 400 && typo.status === 400 && after.json.length === before.json.length + 1;
  console.log(`\n${passed ? '\x1b[32m✔ Демо прошло: добавлено 1 событие, 2 невалидных отклонены' : '\x1b[31m✘ Результат отличается от ожидаемого'}\x1b[0m`);
  process.exit(passed ? 0 : 1);
} catch (e) {
  console.error(`\nНе удалось подключиться к ${BASE}. Запустите сервер: npm run dev\n`, e.message);
  process.exit(1);
}
