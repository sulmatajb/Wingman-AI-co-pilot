import assert from "node:assert/strict";
import { fixtures } from "./response-fixtures.mjs";
import { executeResponsePath, workflowSha256 } from "./workflow-harness.mjs";

const results = fixtures.map((fixture) => {
  const result = executeResponsePath(fixture.input, { providerError: fixture.providerError });
  assert.equal(result.response.status, fixture.expected, fixture.name);
  return { fixture: fixture.name, expected_status: fixture.expected, path: result.path, response: result.response };
});
console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  node_version: process.version,
  workflow_sha256: workflowSha256,
  scope: "Synthetic offline execution of exported Code-node JavaScript and a narrowly supported subset of the configured IF/response graph. No n8n service, provider API, or webhook was called.",
  summary: { fixtures: results.length, accepted: results.filter((result) => result.response.status === 200).length,
    rejected: results.filter((result) => result.response.status === 500).length },
  results,
}, null, 2));
