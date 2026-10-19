import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { executeResearchPath } from "./research-harness.mjs";
import { executeResponsePath } from "./workflow-harness.mjs";
import { providerResearch, coachingResponse } from "./source-fixtures.mjs";
const require = createRequire(import.meta.url);
const viewer = require("../viewer/cards.js");
const example = require("../viewer/example.js");
const copy = () => structuredClone(example);
const parse = value => viewer.parse(JSON.stringify(value));

test("all three cards and literal whitespace survive without extra properties", () => {
  const value = copy(); value.card1.hook = "  <img src=x onerror=alert(1)>\n  literal text  "; value.card1.unknown = "ignored";
  const result = parse(value);
  assert.equal(result.cards.length, 3);
  assert.equal(result.cards[0].hook, value.card1.hook);
  assert.equal(Object.hasOwn(result.cards[0], "unknown"), false);
  assert.equal(result.sources.length, 0);
});

test("downloadable synthetic example agrees with visible example", () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL("../viewer/example.json", import.meta.url))), example);
});

for (const [label, value] of [["array", []], ["null", null], ["error with cards", { ...copy(), error: "PRIVATE RAW ERROR" }], ["failed with cards", { ...copy(), success: false }], ["partial", { card1: copy().card1 }], ["wrapped", { data: copy() }]]) {
  test(`rejects ${label} without including raw evidence`, () => {
    assert.throws(() => parse(value), error => !error.message.includes("PRIVATE RAW ERROR"));
  });
}

test("each required card field must contain nonblank text", () => {
  for (const key of ["card1", "card2", "card3"]) for (const field of ["hook", "anchor", "exit", "mantra"]) for (const value of [null, 4, {}, [], "\n ", undefined]) {
    const cards = copy(); cards[key][field] = value;
    assert.throws(() => parse(cards), new RegExp(`${key}\\.${field}`));
  }
});

test("raw JSON only and UTF-8 byte limit includes multibyte content", () => {
  assert.throws(() => viewer.parse("```json\n{}\n```"), /not valid JSON/);
  assert.throws(() => viewer.parse("{PRIVATE"), error => !error.message.includes("PRIVATE"));
  const raw = JSON.stringify(copy());
  assert.equal(viewer.parse(raw + " ".repeat(viewer.MAX_BYTES - Buffer.byteLength(raw))).cards.length, 3);
  assert.throws(() => viewer.parse(raw + " ".repeat(viewer.MAX_BYTES - Buffer.byteLength(raw) + 1)), /1 MiB/);
  assert.throws(() => viewer.parse(JSON.stringify({ ...copy(), extra: "é".repeat(viewer.MAX_BYTES / 2) })), /1 MiB/);
});

test("source indices are retained, with no credentials or non-HTTP protocols", () => {
  const value = copy();
  value.research_sources = [
    { citation_index: 1, url: "https://example.com/one" },
    { citation_index: 2, url: "javascript:alert(1)" },
    { citation_index: 3, url: "https://user:password@example.com/secret" },
    { citation_index: 4, url: "https://example.com/one" },
    { citation_index: 6, url: "http://example.org/two?q=1&x=2" },
  ];
  const result = parse(value);
  assert.deepEqual(result.sources, [value.research_sources[0], value.research_sources[4]]);
  assert.equal(result.omittedSources, true);
});

test("optional malformed and excessive metadata never breaks valid cards", () => {
  for (const sources of [null, {}, "https://example.com", [null, false, {}, { citation_index: 1, url: 5 }]]) {
    assert.equal(parse({ ...copy(), research_sources: sources }).cards.length, 3);
    assert.equal(parse({ ...copy(), research_sources: sources }).omittedSources, true);
  }
  const sources = Array.from({ length: 101 }, (_, i) => ({ citation_index: i + 1, url: `https://example.com/${i}` }));
  assert.equal(parse({ ...copy(), research_sources: sources }).sources.length, 100);
  for (const url of ["//example.com", "file:///tmp/test", "https://example.com/\nx", "https://example.com\\x", 'https://example.com/"x', "https://example.com/" + "a".repeat(2048)]) {
    assert.equal(parse({ ...copy(), research_sources: [{ citation_index: 1, url }] }).sources.length, 0);
  }
});

test("actual exported Code paths and success response produce compatible saved cards", () => {
  const research = executeResearchPath(providerResearch(["https://example.com/research", null, "https://example.org/context"]));
  const result = executeResponsePath(coachingResponse(), { researchResult: research.processed });
  assert.equal(research.request_executed, false);
  assert.equal(result.response.status, 200);
  const parsed = parse(result.response.body);
  assert.equal(parsed.cards[0].hook, result.response.body.card1.hook);
  assert.deepEqual(parsed.sources, result.response.body.research_sources);
  const failed = executeResponsePath({ error: { message: "synthetic error" } });
  assert.throws(() => parse(failed.response.body));
});

class Node {
  constructor() { this.children = []; this.listeners = {}; this.attributes = {}; this.hidden = false; this.textContent = ""; }
  append(...nodes) { this.children.push(...nodes.flatMap(node => node.fragment ? node.children : [node])); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}
function app(fetch = async () => { throw new Error("Unexpected request"); }, clock = Date) {
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  const document = { getElementById: get, createElement: () => new Node(), createDocumentFragment: () => Object.assign(new Node(), { fragment: true }) };
  runInNewContext(readFileSync(new URL("../viewer/app.js", import.meta.url), "utf8"), { document, WingmanCards: viewer, WingmanExample: example, fetch, AbortController, Date: clock });
  return { get, choose: file => get("response-file").listeners.change({ target: { files: [file] } }), click: id => get(id).listeners.click(), submit: scenario => { get("scenario").value = scenario; return get("scenario-form").listeners.submit({ preventDefault() {} }); } };
}
const file = (value, name = "synthetic.json") => ({ name, size: Buffer.byteLength(JSON.stringify(value)), text: async () => JSON.stringify(value) });
function deferred() { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }

test("actual app keeps complete previous result on invalid, oversized and unreadable imports", async () => {
  const ui = app(); await ui.choose(file(copy(), "accepted.json"));
  const children = ui.get("cards").children;
  for (const bad of [file({ error: "PRIVATE" }), { size: viewer.MAX_BYTES + 1, text: () => { throw new Error("must not read"); } }, { size: 10, text: async () => { throw new Error("PRIVATE FILE ERROR"); } }]) {
    await ui.choose(bad);
    assert.equal(ui.get("cards").children, children);
    assert.match(ui.get("context").textContent, /accepted\.json/);
    assert.equal(ui.get("error").hidden, false);
    assert.doesNotMatch(ui.get("error").textContent, /PRIVATE/);
  }
});

test("clear wins over a delayed file read and removes all old content", async () => {
  const ui = app(); const read = deferred(); const pending = ui.choose({ size: 10, name: "late.json", text: () => read.promise });
  ui.click("clear-button"); read.resolve(JSON.stringify(copy())); await pending;
  assert.equal(ui.get("cards").children.length, 0);
  assert.equal(ui.get("sources").children.length, 0);
  assert.equal(ui.get("empty").hidden, false);
  assert.equal(ui.get("mode").textContent, "No response open");
});

test("newer selection and example reset win over earlier delayed imports", async () => {
  const ui = app(); const read = deferred(); const pending = ui.choose({ size: 10, name: "older.json", text: () => read.promise });
  await ui.choose(file(copy(), "newer.json")); read.resolve(JSON.stringify(copy())); await pending;
  assert.match(ui.get("context").textContent, /newer\.json/);
  const second = deferred(); const delayed = ui.choose({ size: 10, name: "older.json", text: () => second.promise });
  ui.click("example-button"); second.resolve("bad JSON"); await delayed;
  assert.equal(ui.get("mode").textContent, "Synthetic example");
  assert.equal(ui.get("error").hidden, true);
});

test("actual app creates inert text and explicit safe external references", async () => {
  const ui = app(); const value = copy(); value.card1.hook = '<img src=x onerror="alert(1)">';
  value.research_sources = [{ citation_index: 3, url: "https://example.com/source" }];
  await ui.choose(file(value));
  assert.equal(ui.get("cards").children[0].children[1].children[1].textContent, value.card1.hook);
  const source = ui.get("sources").children[0];
  assert.equal(source.value, 3); assert.equal(source.children[0].rel, "noopener noreferrer");
  assert.equal(source.children[0].referrerPolicy, "no-referrer"); assert.equal(source.children[0].target, "_blank");
});

const scenario = "I am meeting a new teammate about our project.";
const apiCards = () => ({ cards: [copy().card1, copy().card2, copy().card3] });
const response = (body, status = 200, retry = null) => ({ ok: status >= 200 && status < 300, status, headers: { get: name => name === "Retry-After" ? retry : null }, json: async () => body });

test("generation is primary and startup makes no request or synthetic claim", () => {
  let calls = 0; const ui = app(() => { calls++; });
  assert.equal(calls, 0);
  assert.equal(ui.get("cards").children.length, 0);
  assert.equal(ui.get("generate-button").disabled, false);
  const html = readFileSync(new URL("../viewer/index.html", import.meta.url), "utf8");
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /<form id="scenario-form"/);
  assert.match(html, /<details class="saved-options">/);
  assert.match(html, /sent to Google’s Gemini through Vercel AI Gateway/);
  assert.match(html, /No live web research/);
});

test("generation posts only trimmed scenario and renders exactly three validated inert cards", async () => {
  const calls = []; const data = apiCards(); data.cards[0].hook = '<img src=x onerror="alert(1)">';
  const ui = app(async (...args) => { calls.push(args); return response(data); });
  await ui.submit(`  ${scenario}  `);
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, "/api/generate"); assert.equal(options.method, "POST");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(options.body), { scenario });
  assert.equal(options.signal.aborted, false);
  assert.equal(ui.get("mode").textContent, "Generated cards");
  assert.equal(ui.get("cards").children.length, 3);
  assert.equal(ui.get("cards").children[0].children[1].children[1].textContent, data.cards[0].hook);
  assert.match(ui.get("source-note").textContent, /No live web research/);
  assert.equal(ui.get("generate-button").disabled, false);
});

test("scenario limits reject before requests and accept exact boundaries", async () => {
  let calls = 0; const ui = app(async () => { calls++; return response(apiCards()); });
  for (const value of ["", " ".repeat(20), "a".repeat(9), "a".repeat(2001)]) {
    await ui.submit(value); assert.equal(calls, 0); assert.match(ui.get("error").textContent, /10–2,000/);
  }
  await ui.submit("a".repeat(10)); await ui.submit("a".repeat(2000)); assert.equal(calls, 2);
});

test("pending state retains prior cards and disables duplicate submits until complete", async () => {
  const pending = deferred(); const ui = app(() => pending.promise);
  ui.click("example-button"); const cards = ui.get("cards").children;
  const request = ui.submit(scenario);
  assert.equal(ui.get("cards").children, cards);
  assert.equal(ui.get("generate-button").disabled, true);
  assert.equal(ui.get("scenario-form").attributes["aria-busy"], "true");
  assert.match(ui.get("status").textContent, /previous cards/);
  pending.resolve(response(apiCards())); await request;
  assert.equal(ui.get("generate-button").disabled, false);
  assert.equal(ui.get("scenario-form").attributes["aria-busy"], "false");
});

test("API errors, incomplete cards and malformed JSON preserve previous cards and context", async () => {
  for (const bad of [response({ error: "Please try again." }, 503), response({ cards: [] }), response({ cards: [copy().card1, {}, copy().card3] }), response({ ...apiCards(), error: "not success" }), { ok: true, json: async () => { throw new Error("PRIVATE RESPONSE"); } }]) {
    const ui = app(async () => bad); await ui.choose(file(copy(), "retained.json"));
    const cards = ui.get("cards").children; await ui.submit(scenario);
    assert.equal(ui.get("cards").children, cards);
    assert.match(ui.get("context").textContent, /retained.json/);
    assert.equal(ui.get("error").hidden, false);
    assert.doesNotMatch(ui.get("error").textContent, /PRIVATE/);
    assert.equal(ui.get("generate-button").disabled, false);
  }
});

test("network failures use friendly controlled errors, not raw exceptions", async () => {
  const ui = app(async () => { throw new Error("PRIVATE transport failure"); });
  await ui.submit(scenario);
  assert.match(ui.get("error").textContent, /Check your connection/);
  assert.doesNotMatch(ui.get("error").textContent, /PRIVATE/);
});

test("429 Retry-After is useful and bounded; API error text remains literal", async () => {
  for (const [retry, match] of [["15", /about 15 seconds/], ["90000", /wait a little/], ["<private>", /wait a little/], [null, /wait a little/]]) {
    const ui = app(async () => response({ error: "<b>Too many requests</b>" }, 429, retry));
    await ui.submit(scenario);
    assert.match(ui.get("error").textContent, match);
    assert.match(ui.get("error").textContent, /<b>Too many requests<\/b>/);
    assert.equal(ui.get("error").children.length, 0);
  }
});

for (const action of ["clear", "example", "import", "invalid import"]) {
  test(`${action} aborts generation and late response body cannot replace that choice`, async () => {
    const body = deferred(); let signal;
    const ui = app(async (_, options) => { signal = options.signal; return { ok: true, json: () => body.promise }; });
    ui.click("example-button");
    const pending = ui.submit(scenario); await Promise.resolve();
    if (action === "clear") ui.click("clear-button");
    else if (action === "example") ui.click("example-button");
    else await ui.choose(file(action === "import" ? copy() : { error: "bad" }, "chosen.json"));
    const cards = ui.get("cards").children; const mode = ui.get("mode").textContent;
    const error = ui.get("error").textContent;
    assert.equal(signal.aborted, true);
    body.resolve(apiCards()); await pending;
    assert.equal(ui.get("cards").children, cards);
    assert.equal(ui.get("mode").textContent, mode);
    assert.equal(ui.get("error").textContent, error);
    assert.equal(ui.get("generate-button").disabled, false);
  });
}

test("newer generation wins over older response without ending its pending state", async () => {
  const older = deferred(); const newer = deferred(); const signals = [];
  const ui = app((_, options) => { signals.push(options.signal); return signals.length === 1 ? older.promise : newer.promise; });
  const first = ui.submit(scenario); const second = ui.submit("A newer meeting with a different team.");
  assert.equal(signals[0].aborted, true);
  older.resolve(response(apiCards())); await first;
  assert.equal(ui.get("generate-button").disabled, true);
  assert.equal(ui.get("cards").children.length, 0);
  newer.resolve(response(apiCards())); await second;
  assert.match(ui.get("context").textContent, /newer meeting/);
  assert.equal(ui.get("generate-button").disabled, false);
});

test("generation wins over a previously started file read", async () => {
  const read = deferred(); const ui = app(async () => response(apiCards()));
  const pending = ui.choose({ size: 10, name: "older.json", text: () => read.promise });
  await ui.submit(scenario); read.resolve(JSON.stringify(copy())); await pending;
  assert.equal(ui.get("mode").textContent, "Generated cards");
});

test("late failed generation cannot show an error after clear", async () => {
  const late = deferred(); const ui = app(() => late.promise);
  const pending = ui.submit(scenario); ui.click("clear-button");
  late.reject(new Error("late failure")); await pending;
  assert.equal(ui.get("error").hidden, true);
  assert.equal(ui.get("status").textContent, "Cards cleared.");
});

test("HTTP-date Retry-After renders an approximate bounded wait", async () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  class FixedDate extends Date { static now() { return now; } }
  const retry = new Date(now + 30000).toUTCString();
  const ui = app(async () => response({ error: "Please pause." }, 429, retry), FixedDate);
  await ui.submit(scenario);
  assert.match(ui.get("error").textContent, /about 30 seconds/);
});
