import assert from "node:assert/strict";
import { test } from "node:test";
import { executeResponsePath, workflow } from "./workflow-harness.mjs";
import { fixtures, cards, privateMarker } from "./response-fixtures.mjs";

for (const fixture of fixtures) {
  test(fixture.name, () => {
    const result = executeResponsePath(fixture.input, { providerError: fixture.providerError });
    assert.equal(result.response.status, fixture.expected);
    assert.equal(result.response.headers["Content-Type"], "application/json");
    assert.deepEqual(result.path, ["Claude Coaching API", "Parse & Validate Response", "Parse OK?",
      fixture.expected === 200 ? "Success Response" : "Error Response"]);
    assert.equal(result.parsed.success, fixture.expected === 200);
    if (fixture.expected === 200) {
      assert.deepEqual(result.response.body, fixture.expectedBody || cards);
      assert.equal(result.response.headers["X-CareerCalm-Status"], "success");
    } else {
      assert.equal(result.response.headers["X-CareerCalm-Status"], "error");
      assert.equal(typeof result.response.body.error, "string");
      assert.equal(typeof result.response.body.details, "string");
      assert.equal(result.response.body.intention, "Practicing a project introduction.");
      assert.ok(result.response.body.suggestion.length > 0);
      assert.ok(!("data" in result.parsed));
      assert.ok(!("raw_response" in result.parsed));
      assert.ok(!JSON.stringify(result).includes(privateMarker));
      if (fixture.detail) assert.ok(result.response.body.details.includes(fixture.detail));
    }
  });
}

test("missing previous-node context preserves a valid response and uses Unknown intention", () => {
  const result = executeResponsePath({ content: [{ type: "text", text: JSON.stringify(cards) }] }, { previousAvailable: false });
  assert.equal(result.response.status, 200);
  assert.equal(result.parsed.intention, "Unknown");
});

test("export retains both provider branches and respond-to-webhook mode", () => {
  const provider = workflow.nodes.find((node) => node.name === "Claude Coaching API");
  assert.equal(provider.onError, "continueErrorOutput");
  assert.equal(workflow.connections[provider.name].main.length, 2);
  const webhook = workflow.nodes.find((node) => node.name === "Webhook Trigger");
  assert.equal(webhook.parameters.responseMode, "responseNode");
});
