import { generateCards, validateCards } from './cards.mjs';

export const MAX_BODY_BYTES = 16_384;
export const MAX_SCENARIO_LENGTH = 2000;

function reply(status, body, headers = {}) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
  } });
}

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// A small per-instance guard. The deployed project also has a Gateway budget;
// this map is not a globally distributed quota and resets on cold starts.
export function createLimiter({ now = Date.now, limit = 5, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return key => {
    const time = now();
    for (const [id, bucket] of buckets) if (bucket.reset <= time) buckets.delete(id);
    const bucket = buckets.get(key) || { count: 0, reset: time + windowMs };
    if (!buckets.has(key) && buckets.size >= 10_000) return 60;
    buckets.set(key, bucket);
    if (bucket.count >= limit) return Math.max(1, Math.ceil((bucket.reset - time) / 1000));
    bucket.count++;
    return 0;
  };
}

export function createHandler({ generate = generateCards, limit = createLimiter(), timeoutMs = 35_000 } = {}) {
  let active = 0;
  return async request => {
    if (request.method !== 'POST') return reply(405, { error: 'Use POST to generate cards.' }, { Allow: 'POST' });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return reply(403, { error: 'Open Wingman to generate cards.' });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
      return reply(415, { error: 'Send the scenario as JSON.' });
    }
    let body;
    try { body = await readBody(request); }
    catch (error) {
      return error instanceof RangeError
        ? reply(413, { error: 'That request is too large. Keep your scenario under 2,000 characters.' })
        : reply(400, { error: 'The request could not be read. Please try again.' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.scenario !== 'string') {
      return reply(400, { error: 'Describe a scenario using 10–2,000 characters.' });
    }
    const scenario = body.scenario.trim();
    if (scenario.length < 10 || scenario.length > MAX_SCENARIO_LENGTH) {
      return reply(400, { error: 'Describe a scenario using 10–2,000 characters.' });
    }
    const retryAfter = limit(request.headers.get('x-vercel-forwarded-for') || 'local');
    if (retryAfter || active >= 4) {
      return reply(429, { error: 'A few too many requests. Please wait a minute and try again.' }, { 'Retry-After': String(retryAfter || 60) });
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]);
    active++;
    try {
      const cards = validateCards(await generate(scenario, signal));
      return reply(200, cards);
    } catch (error) {
      // Never log prompts, provider bodies, credentials, or user scenarios.
      if (signal.aborted) return reply(504, { error: 'Generation took too long. Please try again.' });
      const status = error?.statusCode ?? error?.cause?.statusCode;
      if (status === 429) return reply(429, { error: 'Generation is busy. Please wait a minute and try again.' }, { 'Retry-After': '60' });
      if ([401, 402, 403].includes(status)) return reply(503, { error: 'Generation is temporarily unavailable. Please try again later.' });
      return reply(502, { error: 'We could not generate three complete cards. Please try again.' });
    } finally { active--; }
  };
}
