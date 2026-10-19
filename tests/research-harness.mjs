// Narrow offline evaluator of the stored research Code -> If -> request/response path.
// Provider HTTP nodes are never executed; this is not an n8n runtime.
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

export function executeResearchPath(providerResponse, {
  providerError = false, intention = 'Practicing a project introduction.', previousAvailable = true,
} = {}) {
  const path = ['Perplexity Research API'];
  let name = nextNode(path[0], providerError ? 1 : 0), json = providerResponse, processed;
  for (let step = 0; step < 5; step++) {
    const node = nodes.get(name);
    assert.ok(node, `Missing node: ${name}`);
    path.push(name);
    if (node.type === 'n8n-nodes-base.code') {
      assert.equal(name, 'Process Research & Prepare Claude');
      const context = {
        $input: { first: () => ({ json }) },
        $: requested => {
          assert.equal(requested, 'Prepare Perplexity Request');
          if (!previousAvailable) throw new Error('Previous node unavailable in fixture');
          return { first: () => ({ json: { intention } }) };
        },
      };
      json = plain(runInNewContext(`(function () {\n${node.parameters.jsCode}\n})()`, context, { timeout: 1000 }));
      processed = json;
      name = nextNode(name);
    } else if (node.type === 'n8n-nodes-base.if') {
      const { conditions, options, combinator } = node.parameters.conditions;
      assert.equal(options.typeValidation, 'strict');
      assert.equal(combinator, 'and');
      assert.equal(conditions.length, 1);
      const condition = conditions[0];
      assert.equal(condition.operator.type, 'boolean');
      assert.equal(condition.operator.operation, 'equals');
      const left = expression(condition.leftValue, json);
      assert.equal(typeof left, 'boolean');
      name = nextNode(name, left === condition.rightValue ? 0 : 1);
    } else if (node.type === 'n8n-nodes-base.respondToWebhook') {
      assert.equal(node.parameters.respondWith, 'json');
      const body = expression(node.parameters.responseBody, json);
      return { path, processed, response: {
        status: node.parameters.options.responseCode,
        headers: Object.fromEntries(node.parameters.options.responseHeaders.entries.map(({name,value}) => [name,value])),
        body: typeof body === 'string' ? JSON.parse(body) : plain(body),
      } };
    } else if (node.type === 'n8n-nodes-base.httpRequest') {
      assert.equal(name, 'Claude Coaching API');
      const body = expression(node.parameters.jsonBody, json);
      return { path, processed, prepared_request: {
        node: name, method: node.parameters.method, url: node.parameters.url,
        body: typeof body === 'string' ? JSON.parse(body) : plain(body),
      }, request_executed: false };
    } else throw new Error(`Unsupported node type ${node.type}`);
  }
  throw new Error('Research path did not terminate within five nodes');
}
