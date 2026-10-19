// Print a new synthetic evidence snapshot to stdout. Existing snapshots are not rewritten.
import { executeInputPath, workflowSha256 } from './input-harness.mjs';
import { invalidInputs, validInputs } from './input-fixtures.mjs';
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  workflow_sha256: workflowSha256,
  mode: 'offline evaluation of exported expression, code and stored routes; no HTTP execution',
  limitations: 'Not a real n8n runtime. Import/execution and webhook serialization remain unverified.',
  invalid: invalidInputs.map(fixture => ({ name: fixture.name, result: executeInputPath(fixture.input) })),
  valid: validInputs.map(fixture => ({ name: fixture.name, result: executeInputPath(fixture.input) })),
}, null, 2));
