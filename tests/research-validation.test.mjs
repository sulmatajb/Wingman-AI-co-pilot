import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeResearchPath, workflow } from './research-harness.mjs';
import { privateMarker, researchFixtures, research, response } from './research-fixtures.mjs';

for (const fixture of researchFixtures) {
  test(`research: ${fixture.name}`, () => {
    const result = executeResearchPath(fixture.input, { providerError: fixture.providerError });
    assert.equal(result.processed.success, fixture.accepted);
    assert.deepEqual(result.path, ['Perplexity Research API', 'Process Research & Prepare Claude', 'Research OK?',
      fixture.accepted ? 'Claude Coaching API' : 'Research Error Response']);
    if (fixture.accepted) {
      assert.equal(result.request_executed, false);
      assert.equal(result.response, undefined);
      assert.equal(result.prepared_request.method, 'POST');
      assert.equal(result.prepared_request.url, 'https://api.anthropic.com/v1/messages');
      assert.deepEqual(result.prepared_request.body, result.processed.claude_request);
      const prompt = result.prepared_request.body.messages[0].content;
      assert.ok(prompt.includes(`RESEARCH DATA:\n${fixture.research}\n\n---`));
      assert.equal(result.prepared_request.body.model, 'claude-sonnet-4-20250514');
      assert.equal(result.prepared_request.body.max_tokens, 1500);
    } else {
      assert.equal(result.prepared_request, undefined);
      assert.ok(!Object.hasOwn(result.processed, 'claude_request'));
      assert.equal(result.response.status, 503);
      assert.equal(result.response.headers['Content-Type'], 'application/json');
      assert.equal(result.response.headers['X-CareerCalm-Status'], 'research-failed');
      assert.equal(result.response.body.error, 'Research phase failed');
      assert.equal(result.response.body.intention, 'Practicing a project introduction.');
      assert.equal(typeof result.response.body.details, 'string');
      assert(result.response.body.details.length > 0);
      assert(result.response.body.suggestion.length > 0);
      assert(!JSON.stringify(result).includes(privateMarker));
    }
  });
}

test('research: missing prior context preserves a valid fallback intention', () => {
  const intention = '  Synthetic user intention.  ';
  const result = executeResearchPath({ ...response(research), intention }, { previousAvailable: false });
  assert.equal(result.processed.intention, intention);
  assert.ok(result.prepared_request.body.messages[0].content.startsWith(`Context: "${intention}"`));
});

test('research: null input with missing prior context still reaches controlled 503', () => {
  const result = executeResearchPath(null, { previousAvailable: false, providerError: true });
  assert.equal(result.response.status, 503);
  assert.equal(result.response.body.intention, 'Professional Context');
  assert.ok(!Object.hasOwn(result.processed, 'claude_request'));
});

test('research: malformed fallback context is not exposed in errors', () => {
  const result = executeResearchPath({ intention: { details: privateMarker } }, { previousAvailable: false });
  assert.equal(result.response.status, 503);
  assert.equal(result.response.body.intention, 'Professional Context');
  assert.ok(!JSON.stringify(result).includes(privateMarker));
});

test('research: both stored provider branches and existing 503 response configuration remain present', () => {
  const provider = workflow.nodes.find(node => node.name === 'Perplexity Research API');
  assert.equal(provider.onError, 'continueErrorOutput');
  assert.equal(workflow.connections[provider.name].main.length, 2);
  assert(workflow.connections[provider.name].main.every(branch => branch[0].node === 'Process Research & Prepare Claude'));
  const error = workflow.nodes.find(node => node.name === 'Research Error Response');
  assert.equal(error.parameters.options.responseCode, 503);
});
