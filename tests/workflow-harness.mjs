// Minimal offline evaluator for this workflow's final Code -> If -> Respond path.
// It is intentionally not an n8n runtime or a general workflow interpreter.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";

const workflowPath = new URL("../Wingman-workflow.json", import.meta.url);
const workflowBytes = readFileSync(workflowPath);
export const workflow = JSON.parse(workflowBytes);
export const workflowSha256 = createHash("sha256").update(workflowBytes).digest("hex");
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const plain = (value) => JSON.parse(JSON.stringify(value));

function expression(value, json) {
  const match = value.match(/^=\{\{([\s\S]*)\}\}$/);
  assert.ok(match, `Unsupported expression: ${value}`);
  return runInNewContext(`(${match[1]})`, { $json: json }, { timeout: 1000 });
}

function nextNode(name, branch = 0) {
  const edges = workflow.connections[name]?.main?.[branch];
  assert.equal(edges?.length, 1, `${name} branch ${branch} must have exactly one target`);
  assert.equal(edges[0].type, "main");
  assert.equal(edges[0].index, 0);
  return edges[0].node;
}

export function executeResponsePath(providerResponse, { providerError = false, intention = "Practicing a project introduction.", previousAvailable = true, researchResult } = {}) {
  const path = ["Claude Coaching API"];
  // Inject synthetic provider output; the HTTP Request node itself is never executed.
  let name = nextNode(path[0], providerError ? 1 : 0);
  let json = providerResponse;
  let parsed;
  for (let step = 0; step < 10; step++) {
    const node = nodes.get(name);
    assert.ok(node, `Missing node: ${name}`);
    path.push(name);
    if (node.type === "n8n-nodes-base.code") {
      const context = {
        $input: { first: () => ({ json }) },
        $: (requested) => {
          assert.equal(requested, "Process Research & Prepare Claude");
          if (!previousAvailable) throw new Error("Previous node unavailable in this fixture");
          return { first: () => ({ json: researchResult === undefined ? { intention } : researchResult }) };
        },
      };
      json = plain(runInNewContext(`(function () {\n${node.parameters.jsCode}\n})()`, context, { timeout: 1000 }));
      parsed = json;
      name = nextNode(name);
    } else if (node.type === "n8n-nodes-base.if") {
      const { conditions, options, combinator } = node.parameters.conditions;
      assert.equal(options.typeValidation, "strict");
      assert.equal(combinator, "and");
      assert.equal(conditions.length, 1);
      const condition = conditions[0];
      assert.equal(condition.operator.type, "boolean");
      assert.equal(condition.operator.operation, "equals");
      const left = expression(condition.leftValue, json);
      assert.equal(typeof left, "boolean", "The parser must return a boolean success flag");
      name = nextNode(name, left === condition.rightValue ? 0 : 1);
    } else if (node.type === "n8n-nodes-base.respondToWebhook") {
      assert.equal(node.parameters.respondWith, "json");
      const value = expression(node.parameters.responseBody, json);
      return {
        path,
        parsed,
        response: {
          status: node.parameters.options.responseCode,
          headers: Object.fromEntries(node.parameters.options.responseHeaders.entries.map(({ name, value }) => [name, value])),
          body: typeof value === "string" ? JSON.parse(value) : plain(value),
        },
      };
    } else {
      throw new Error(`Harness does not implement node type ${node.type}`);
    }
  }
  throw new Error("Response path did not terminate in ten nodes");
}
