import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { executeResearchPath } from "./research-harness.mjs";
import { executeResponsePath } from "./workflow-harness.mjs";
import { cards } from "./response-fixtures.mjs";
import { providerResearch, coachingResponse, researchText, sourceCases } from "./source-fixtures.mjs";

function through(citations, extra = {}) {
  const research = executeResearchPath(providerResearch(citations));
  const response = executeResponsePath(coachingResponse(extra), { researchResult: research.processed });
  return { research, response };
}

for (const fixture of sourceCases) {
  test(fixture.name, () => {
    const { research, response } = through(fixture.citations);
    assert.equal(research.request_executed, false);
    assert.equal(response.response.status, 200);
    assert.deepEqual(response.response.body, { ...cards, ...(fixture.expected.length ? { research_sources: fixture.expected } : {}) });
    assert.deepEqual(research.processed.research_sources ?? [], fixture.expected);
    assert.equal(response.path.at(-1), "Success Response");
  });
}

test("malformed citation containers are optional, never coerced", () => {
  for (const citations of [null, false, 7, "https://example.com", { 0: "https://example.com", length: 1 }, []]) {
    assert.deepEqual(through(citations).response.response.body, cards);
  }
});

test("unsafe or unsupported URL shapes are omitted without renumbering", () => {
  const invalid = ["", " https://example.com", "https://example.com\n", "https://example.com/a b", "https://example.com\\path", "data:text/html,test", "ftp://example.com", "//example.com", "https://user@example.com", "https://example.com:0", "https://example.com:65536", "https://example.com:abc", "https://-bad.example", "https://example..com", "https://example.com./", "https://256.1.2.3/", "https://01.2.3.4/", "https://127.1/", "https://[::1]/", "https://éxample.com/", "https://example.com/é", "https://example.com/<tag>", 'https://example.com/"x', "https://example.com/%oops", "https://" + "a".repeat(64) + ".com"];
  const url = "https://example.com/valid";
  const { response } = through([...invalid, url]);
  assert.deepEqual(response.response.body.research_sources, [{ citation_index: invalid.length + 1, url }]);
});

test("supported ASCII references preserve exact provider strings", () => {
  const urls = ["HTTPS://Example.COM/a%20b?q=1&z=2#part", "http://192.0.2.1:8080/path", "https://xn--bcher-kva.example/test", "https://example.com:65535/"];
  assert.deepEqual(through(urls).response.response.body.research_sources, urls.map((url, i) => ({ citation_index: i + 1, url })));
});

test("duplicate policy keeps the first exact string only", () => {
  const urls = ["https://example.com/A", "https://example.com/A", "https://example.com/a"];
  assert.deepEqual(through(urls).response.response.body.research_sources, [{ citation_index: 1, url: urls[0] }, { citation_index: 3, url: urls[2] }]);
});

test("inspection stops at 100 entries, preserving original index 100", () => {
  const citations = [...Array(99).fill(null), "https://example.com/100", "https://example.com/101"];
  assert.deepEqual(through(citations).response.response.body.research_sources, [{ citation_index: 100, url: citations[99] }]);
});

test("all accepted metadata stays bounded to 100 entries", () => {
  const citations = Array.from({ length: 120 }, (_, i) => `https://example.com/${i}`);
  const sources = through(citations).response.response.body.research_sources;
  assert.equal(sources.length, 100);
  assert.equal(sources.at(-1).citation_index, 100);
});

test("URL limit accepts 2048 characters and omits 2049", () => {
  const base = "https://example.com/";
  const exact = base + "a".repeat(2048 - base.length);
  assert.deepEqual(through([exact + "a", exact]).response.response.body.research_sources, [{ citation_index: 2, url: exact }]);
});

test("citation metadata does not alter prompts, request configuration or cards", () => {
  const absent = through(undefined);
  const present = through(["https://example.com/provenance"]);
  assert.deepEqual(present.research.processed.claude_request, absent.research.processed.claude_request);
  assert.ok(present.research.processed.claude_request.messages[0].content.includes(researchText));
  for (const name of ["card1", "card2", "card3"]) assert.deepEqual(present.response.response.body[name], cards[name]);
});

test("model-authored top-level sources cannot replace or create provenance", () => {
  const forged = [{ citation_index: 1, url: "https://example.com/model-invented" }];
  assert.deepEqual(through(undefined, { research_sources: forged }).response.response.body, cards);
  const trusted = "https://example.org/provider";
  assert.deepEqual(through([trusted], { research_sources: forged }).response.response.body.research_sources, [{ citation_index: 1, url: trusted }]);
  const result = executeResponsePath({ ...coachingResponse(), research_sources: forged });
  assert.deepEqual(result.response.body, cards);
});

test("missing previous result remains a valid cards-only response", () => {
  const result = executeResponsePath(coachingResponse({ research_sources: ["https://example.com"] }), { previousAvailable: false });
  assert.deepEqual(result.response.body, cards);
});

test("research provider errors still stop before coaching and return 503", () => {
  const result = executeResearchPath({ ...providerResearch(["https://example.com"]), error: { message: "synthetic error" } }, { providerError: true });
  assert.equal(result.response.status, 503);
  assert.equal(result.path.includes("Claude Coaching API"), false);
  assert.equal(Object.hasOwn(result.processed, "research_sources"), false);
});

test("invalid coaching output never returns sources as successful cards", () => {
  const research = executeResearchPath(providerResearch(["https://example.com"]));
  for (const input of [{ type: "error", error: {} }, { content: [{ text: "{}" }] }]) {
    const response = executeResponsePath(input, { researchResult: research.processed });
    assert.equal(response.response.status, 500);
    assert.equal(Object.hasOwn(response.response.body, "research_sources"), false);
  }
});

test("exported code works without URL or require injected into the Code sandbox", () => {
  assert.equal(runInNewContext("typeof URL"), "undefined");
  assert.equal(runInNewContext("typeof require"), "undefined");
  assert.equal(through(["https://example.com"]).response.response.status, 200);
});
