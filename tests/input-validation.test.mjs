import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeInputPath, executePreparation, workflow } from './input-harness.mjs';
import { invalidInputs, validInputs } from './input-fixtures.mjs';

for (const fixture of invalidInputs) {
  test(`input: ${fixture.name} returns 400 before preparing research`, () => {
    const result = executeInputPath(fixture.input);
    assert.deepEqual(result.path, ['Webhook Trigger', 'Validate Input', 'Validation Error']);
    assert.equal(result.response.status, 400);
    assert.equal(result.response.headers['Content-Type'], 'application/json');
    assert.equal(result.response.body.error, 'Invalid request');
    assert.match(result.response.body.message, /intention.*nonempty text string.*request body/);
    assert.equal(typeof result.response.body.example.intention, 'string');
    assert.equal(result.prepared, undefined);
    assert.equal(result.prepared_request, undefined);
    assert.equal(result.request_executed, false);
  });
}

for (const fixture of validInputs) {
  test(`input: ${fixture.name} preserves its request text`, () => {
    const result = executeInputPath(fixture.input);
    assert.deepEqual(result.path, ['Webhook Trigger', 'Validate Input', 'Prepare Perplexity Request', 'Perplexity Research API']);
    assert.equal(result.response, undefined);
    assert.equal(result.request_executed, false);
    assert.equal(result.prepared.intention, fixture.intention);
    assert.equal(result.prepared_request.method, 'POST');
    assert.equal(result.prepared_request.url, 'https://api.perplexity.ai/chat/completions');
    assert.deepEqual(result.prepared_request.body, result.prepared.perplexity_request);
    assert.equal(result.prepared_request.body.model, 'sonar-pro');
    assert.ok(result.prepared_request.body.messages[1].content.includes(`"${fixture.intention}"`));
  });
}

test('input: preparation defensively rejects unusable values if run directly', () => {
  for (const fixture of invalidInputs.filter(f => !f.name.includes('fallback') && !f.name.includes('only cannot'))) {
    assert.throws(() => executePreparation(fixture.input), /Intention must be a nonempty text string/);
  }
  assert.throws(() => executePreparation(undefined), /Intention must be a nonempty text string/);
});

test('input: a valid body wins over legacy query/top-level fallbacks without trimming', () => {
  const intention = '  Valid synthetic body.  ';
  const result = executeInputPath({ body: { intention }, query: { intention: 'Query' }, intention: 'Top-level' });
  assert.equal(result.prepared.intention, intention);
});

test('input: undefined input and no first item cannot throw an unsafe property access', () => {
  assert.equal(executeInputPath(undefined).response.status, 400);
  assert.throws(() => executePreparation(undefined), /Intention must be a nonempty text string/);
  assert.throws(() => executePreparation(undefined, { missingFirst: true }), /Intention must be a nonempty text string/);
});

test('input: existing gate/response configuration is retained', () => {
  const gate = workflow.nodes.find(n => n.name === 'Validate Input');
  assert.equal(gate.type, 'n8n-nodes-base.if');
  assert.equal(gate.parameters.conditions.options.typeValidation, 'strict');
  assert.equal(gate.parameters.conditions.conditions[0].operator.operation, 'notEmpty');
  const error = workflow.nodes.find(n => n.name === 'Validation Error');
  assert.equal(error.parameters.options.responseCode, 400);
});
