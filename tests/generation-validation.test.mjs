import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, createLimiter, MAX_BODY_BYTES } from '../server/handler.mjs';
import { validateCards } from '../server/cards.mjs';

const scenario = 'Meeting a new teammate to discuss an accessibility improvement.';
const card = { hook: 'Hello!', anchor: 'What would help?', exit: 'Thanks for your time.', mantra: 'Stay curious.' };
const good = { cards: [card, card, card] };
const request = (body = { scenario }, extra = {}) => new Request('https://wingman.example/api/generate', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...extra,
});
const stub = options => createHandler({ generate: async () => good, limit: () => 0, ...options });

test('validated scenario reaches generation and response strips unknown provider fields', async () => {
  let received;
  const response = await stub({ generate: async (value, signal) => {
    received = value;
    assert.ok(signal instanceof AbortSignal);
    return { cards: good.cards.map(value => ({ ...value, debug: 'private' })), debug: 'private' };
  } })(request({ scenario: `  ${scenario}  ` }));
  assert.equal(received, scenario);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), good);
});

test('GET rejects without invoking generation', async () => {
  const handler = stub({ generate: () => assert.fail('must not call') });
  const response = await handler(new Request('https://wingman.example/api/generate'));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
});

test('cross-origin and wrong media type reject before generation', async () => {
  const handler = stub({ generate: () => assert.fail('must not call') });
  assert.equal((await handler(request(undefined, { headers: { origin: 'https://other.example', 'content-type': 'application/json' } }))).status, 403);
  assert.equal((await handler(request(undefined, { headers: { 'content-type': 'text/plain' } }))).status, 415);
  assert.equal((await stub()(request(undefined, { headers: { origin: 'https://wingman.example', 'content-type': 'application/json; charset=utf-8' } }))).status, 200);
});

test('invalid scenarios and malformed JSON never invoke generation', async () => {
  const handler = stub({ generate: () => assert.fail('must not call') });
  for (const body of [null, [], {}, { scenario: 42 }, { scenario: '' }, { scenario: ' '.repeat(50) }, { scenario: 'short' }, { scenario: 'x'.repeat(2001) }]) {
    assert.equal((await handler(request(body))).status, 400);
  }
  assert.equal((await handler(request(undefined, { body: '{' }))).status, 400);
});

test('length boundaries accept and produce bounded output', async () => {
  for (const length of [10, 2000]) assert.equal((await stub()(request({ scenario: 'x'.repeat(length) }))).status, 200);
});

test('declared and streamed request sizes cannot bypass byte limit', async () => {
  const handler = stub({ generate: () => assert.fail('must not call') });
  assert.equal((await handler(request(undefined, { headers: { 'content-type': 'application/json', 'content-length': String(MAX_BODY_BYTES + 1) } }))).status, 413);
  assert.equal((await handler(request({ scenario, extra: 'x'.repeat(MAX_BODY_BYTES) }))).status, 413);
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(MAX_BODY_BYTES)); }, cancel() { cancelled = true; } });
  assert.equal((await handler(request(undefined, { body: stream, duplex: 'half' }))).status, 413);
  assert.equal(cancelled, true);
});

test('invalid, missing, blank, excessive and oversized card text never enters success path', async () => {
  const bad = [null, {}, { cards: [] }, { cards: [card, card] }, { cards: [...good.cards, card] },
    { cards: [card, card, { ...card, hook: ' ' }] }, { cards: [card, card, { ...card, mantra: 'x'.repeat(601) }] },
    { cards: [card, card, []] }];
  for (const value of bad) {
    assert.throws(() => validateCards(value));
    assert.equal((await stub({ generate: async () => value })(request())).status, 502);
  }
});

test('provider failures use controlled errors without leaking payloads', async () => {
  for (const [statusCode, expected] of [[401, 503], [402, 503], [403, 503], [429, 429], [500, 502]]) {
    const response = await stub({ generate: async () => { throw Object.assign(new Error('private provider response'), { statusCode }); } })(request());
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /private|provider/);
    if (expected === 429) assert.equal(response.headers.get('retry-after'), '60');
  }
});

test('per-instance limiter allows five attempts and resets without mixing clients', () => {
  let time = 0;
  const limit = createLimiter({ now: () => time });
  for (let i = 0; i < 5; i++) assert.equal(limit('a'), 0);
  assert.equal(limit('a'), 60);
  assert.equal(limit('b'), 0);
  time = 59_999;
  assert.equal(limit('a'), 1);
  time = 60_000;
  assert.equal(limit('a'), 0);
});

test('rate-limited request never invokes provider', async () => {
  const response = await stub({ limit: () => 12, generate: () => assert.fail('must not call') })(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '12');
});

test('four in-flight requests bound per-instance concurrency and release after errors', async () => {
  const pending = [];
  const handler = stub({ generate: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) });
  const requests = Array.from({ length: 4 }, () => handler(request()));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await handler(request())).status, 429);
  pending[0].reject(new Error('test failure'));
  pending.slice(1).forEach(p => p.resolve(good));
  assert.deepEqual((await Promise.all(requests)).map(r => r.status), [502, 200, 200, 200]);
  const next = handler(request());
  await new Promise(resolve => setImmediate(resolve));
  pending[4].resolve(good);
  assert.equal((await next).status, 200);
});

test('client cancellation propagates to the generator', async () => {
  const controller = new AbortController();
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  const handler = stub({ generate: (_, signal) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    notifyStarted();
  }) });
  const pending = handler(request(undefined, { signal: controller.signal }));
  await started;
  controller.abort();
  assert.equal((await pending).status, 504);
});

test('server deadline stops a hanging provider request', async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const response = await stub({ timeoutMs: 5, generate: (_, signal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }) })(request());
    assert.equal(response.status, 504);
  } finally { clearTimeout(keepAlive); }
});
