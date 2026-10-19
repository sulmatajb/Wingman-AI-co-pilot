// Narrow offline evaluator of the stored webhook -> input gate -> request/400 path.
// This is not an n8n runtime. HTTP nodes are inspected, never executed.
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { workflow, workflowSha256 } from './workflow-harness.mjs';
export { workflow, workflowSha256 };
const nodes = new Map(workflow.nodes.map(node => [node.name, node]));
const plain = value => JSON.parse(JSON.stringify(value));

function expression(value, json) {
  const match = value.match(/^=\{\{([\s\S]*)\}\}$/);
  assert.ok(match, `Unsupported expression: ${value}`);
  return runInNewContext(`(${match[1]})`, { $json: json }, { timeout: 1000 });
}

function nextNode(name, branch = 0) {
  const edges = workflow.connections[name]?.main?.[branch];
  assert.equal(edges?.length, 1, `${name} branch ${branch} must have one target`);
  assert.equal(edges[0].type, 'main');
  assert.equal(edges[0].index, 0);
  return edges[0].node;
}

export function executePreparation(input, { missingFirst = false } = {}) {
  const node = nodes.get('Prepare Perplexity Request');
  assert.equal(node.type, 'n8n-nodes-base.code');
  return plain(runInNewContext(`(function () {\n${node.parameters.jsCode}\n})()`, {
    $input: { first: () => missingFirst ? undefined : ({ json: input }) },
  }, { timeout: 1000 }));
}

export function executeInputPath(input) {
  const path = ['Webhook Trigger'];
  let name = nextNode(path[0]), json = input, prepared;
  for (let step = 0; step < 5; step++) {
    const node = nodes.get(name);
    assert.ok(node, `Missing node: ${name}`);
    path.push(name);
    if (node.type === 'n8n-nodes-base.if') {
      assert.equal(name, 'Validate Input');
      const { conditions, options, combinator } = node.parameters.conditions;
      assert.equal(options.typeValidation, 'strict');
      assert.equal(combinator, 'and');
      assert.equal(conditions.length, 1);
      const condition = conditions[0];
      assert.equal(condition.operator.type, 'string');
      assert.equal(condition.operator.operation, 'notEmpty');
      const left = expression(condition.leftValue, json);
      // A string notEmpty condition is represented by length > 0. We deliberately
      // do not claim how a real n8n version handles non-string values/type errors.
      assert.equal(typeof left, 'string', 'Offline gate supports string operands only; full n8n behavior for other types is unverified.');
      name = nextNode(name, left.length > 0 ? 0 : 1);
    } else if (node.type === 'n8n-nodes-base.code') {
      assert.equal(name, 'Prepare Perplexity Request');
      json = executePreparation(json);
      prepared = json;
      name = nextNode(name);
    } else if (node.type === 'n8n-nodes-base.respondToWebhook') {
      assert.equal(name, 'Validation Error');
      assert.equal(node.parameters.respondWith, 'json');
      const value = expression(node.parameters.responseBody, json);
      return { path, response: {
        status: node.parameters.options.responseCode,
        headers: Object.fromEntries(node.parameters.options.responseHeaders.entries.map(({ name, value }) => [name, value])),
        body: typeof value === 'string' ? JSON.parse(value) : plain(value),
      }, request_executed: false };
    } else if (node.type === 'n8n-nodes-base.httpRequest') {
      assert.equal(name, 'Perplexity Research API');
      const value = expression(node.parameters.jsonBody, json);
      return { path, prepared, prepared_request: {
        node: name, method: node.parameters.method, url: node.parameters.url,
        body: typeof value === 'string' ? JSON.parse(value) : plain(value),
      }, request_executed: false };
    } else throw new Error(`Unsupported node type ${node.type}`);
  }
  throw new Error('Input path did not terminate within five nodes');
}
