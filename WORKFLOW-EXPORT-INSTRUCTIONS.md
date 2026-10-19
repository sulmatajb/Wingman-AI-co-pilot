# Maintaining Wingman-workflow.json

[`Wingman-workflow.json`](Wingman-workflow.json) is already included. New users can import it directly using [N8N-SETUP.md](N8N-SETUP.md); exporting a workflow first is not a setup requirement. Preserve the capital `W` in the filename because the offline harness reads that exact path.

If you change a workflow in your own n8n instance, export its JSON and review the diff before replacing this file. Use n8n's [export/import documentation](https://docs.n8n.io/build/manage-workflows/export-and-import.md) for the available export controls in your version.

## Review an export before sharing

Do not assume export automatically removes secrets. n8n documents that exported JSON includes credential names and IDs, and HTTP Request nodes can contain authentication headers copied from cURL. Inspect credentials, literal headers, code, URLs, pinned/example data and instance metadata; remove secrets and personal data before sharing. See the [official credential-sharing note](https://docs.n8n.io/build/manage-workflows/export-and-import.md).

The public template omits credential bindings, instance metadata, workflow/version IDs and webhook IDs, and is stored inactive. Each installation must select its own credentials and enable the workflow deliberately. Node IDs, logic, prompts, provider request settings and connections are retained. Historical `tests/evidence/` snapshots keep their original workflow hashes; run the current offline checks for the current template.

## Current workflow structure

The included export contains these 13 nodes:

| Node | Purpose |
| --- | --- |
| Webhook Trigger | Receives `POST` on the configured `careercalm` path |
| Validate Input | Requires a nonblank string at `body.intention` |
| Validation Error | Returns the configured `400` body |
| Prepare Perplexity Request | Prepares the research request |
| Perplexity Research API | Calls the configured research service |
| Process Research & Prepare Claude | Validates research text and prepares coaching only on success |
| Research OK? | Routes usable research to coaching, failures to `503` |
| Claude Coaching API | Calls the configured coaching service |
| Parse & Validate Response | Requires all three cards and their text fields |
| Parse OK? | Routes complete cards to success, failures to `500` |
| Success Response | Returns the three cards with `200` |
| Error Response | Returns the configured coaching/validation error with `500` |
| Research Error Response | Returns the configured research error with `503` |

Both provider nodes route their normal and error outputs through the respective validation code. Keep those connections when updating the export.

## Check a changed export locally

From the repository root with Node.js 22:

```bash
node --test --test-concurrency=1 tests/*-validation.test.mjs
node tests/input-demo.mjs
```

These checks execute the exported code and a limited synthetic interpretation of the connections. They make no provider calls and leave historical evidence unchanged. They do not verify n8n import compatibility, live credentials, HTTP serialization, model availability or factual research quality. A deliberate live integration check is separate and can incur provider charges.
