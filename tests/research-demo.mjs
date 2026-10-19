import assert from 'node:assert/strict';
import { executeResearchPath, workflowSha256 } from './research-harness.mjs';
import { researchFixtures } from './research-fixtures.mjs';
const results = researchFixtures.map(fixture => {
  const result = executeResearchPath(fixture.input, { providerError: fixture.providerError });
  assert.equal(result.processed.success, fixture.accepted, fixture.name);
  return { name: fixture.name, expected: fixture.accepted ? 'request_prepared' : '503', ...result };
});
console.log(JSON.stringify({
  generated_at: new Date().toISOString(), node_version: process.version, workflow_sha256: workflowSha256,
  scope: 'Synthetic execution of exported research Code-node JavaScript and the stored IF/request/error-response routes. HTTP nodes are never executed; this is not a live n8n check.',
  summary: { fixtures: results.length, request_prepared: results.filter(r => r.prepared_request).length,
    rejected_503: results.filter(r => r.response?.status === 503).length, network_requests: 0 }, results,
}, null, 2));
