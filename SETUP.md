# Wingman Setup Guide

Start with the [card viewer demo](https://sulmatajb.github.io/Wingman-AI-co-pilot/) for the synthetic example and saved JSON import, or use the [offline quick start](README.md#quick-start-offline) to inspect request handling. Neither path calls a provider. This repository supplies an n8n workflow, Node.js fixtures and a static saved-response viewer. The viewer needs no application package manifest or hosted service.

## Service prerequisites

Live execution requires an n8n instance that can import the included node versions, outbound access to the configured providers, and your own Perplexity and Anthropic API credentials with access to the configured models. Node.js is needed only for the repository's offline checks. No n8n version or live provider combination has been verified by those checks.

The export currently requests `sonar-pro` from `https://api.perplexity.ai/chat/completions` and `claude-sonnet-4-20250514` from `https://api.anthropic.com/v1/messages`. These are source settings, not a claim of current model availability. As checked on 2026-10-16, Perplexity says Sonar Chat Completions support ended on September 27, 2026, while synchronous and streaming requests continue through gradual reformulation. This workflow uses a synchronous request; that notice alone does not establish a failure. Review the [official migration guidance](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview) and confirm compatibility before a live test. A provider migration would require a separate implementation and validation.

## Import and configure

1. Import the included [`Wingman-workflow.json`](Wingman-workflow.json) into your n8n instance. No prior export is needed. See n8n's [import instructions](https://docs.n8n.io/build/manage-workflows/export-and-import.md) for your installation.
2. Configure credentials on **Perplexity Research API** and **Claude Coaching API**. Both are HTTP Request nodes configured for **Generic Credential Type → Header Auth** (`httpHeaderAuth`). Select your own credentials on both nodes. The public template contains no selected credential bindings or instance/workflow identifiers.
3. For API-key authentication, configure the following header credentials. Enter actual secrets only in your n8n credentials, not in this repository or a browser client. n8n Header Auth stores a header name and value; see its [credential documentation](https://docs.n8n.io/integrations/builtin/credentials/httprequest#using-header-auth).

   | Node | Header name | Header value |
   | --- | --- | --- |
   | Perplexity Research API | `Authorization` | `Bearer ` followed by your Perplexity API key |
   | Claude Coaching API | `x-api-key` | Your Anthropic API key |

   Header formats are documented by [Perplexity](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview) and [Anthropic](https://platform.claude.com/docs/en/api/overview). The Claude node already supplies `anthropic-version: 2023-06-01` and `content-type: application/json`.
4. Inspect **Webhook Trigger**. It is configured for `POST`, path `careercalm`, and responses from the downstream response nodes. Copy the appropriate URL shown by your instance instead of constructing it from this guide. Follow your n8n version's workflow-enablement requirements for the production URL. The public template is stored with `active: false`; enable it deliberately only after configuring credentials and reviewing its access controls. A stored flag is not evidence that your endpoint is reachable.

Importing or passing the offline tests does not establish successful n8n execution, credential validity, provider availability or HTTP serialization. The stored webhook has no explicit authentication configuration; any access controls for an exposed service belong to your deployment.

## Webhook request

Send `Content-Type: application/json` and a JSON body whose `intention` is a nonblank string:

```json
{
  "intention": "Presenting a synthetic project at a team meeting."
}
```

The webhook makes this available as `body.intention` to the workflow. Do **not** wrap the HTTP body in another `body` property. Missing, null, whitespace-only and non-string values follow **Validate Input → Validation Error** before research preparation. Query parameters and top-level n8n-item fields do not bypass this body-only gate. Valid strings are preserved exactly, including surrounding whitespace; there is no minimum prose length.

The following is an **optional live request**, not an offline check. Replace the illustrative URL with your own webhook URL. Running it against an enabled service can call both paid providers; add any authentication your deployment requires. This command was not executed for the offline verification.

```bash
curl --request POST 'https://your-n8n.example/webhook/careercalm' \
  --header 'Content-Type: application/json' \
  --data '{"intention":"Presenting a synthetic project at a team meeting."}'
```

## Configured response contract

All four response nodes specify JSON and `Content-Type: application/json`. The statuses and bodies below describe the stored response expressions, not an observed live HTTP exchange.

| Status | Response node | Body |
| --- | --- | --- |
| `200` | Success Response | `{ card1, card2, card3 }` plus optional `research_sources`; no outer `data` or `success` wrapper |
| `400` | Validation Error | `{ error, message, example }`; invalid `intention`, before research |
| `503` | Research Error Response | `{ error, details, intention, suggestion }`; research failed or lacked usable text, before a Claude request is prepared |
| `500` | Error Response | `{ error, details, intention, suggestion }`; coaching failed or did not produce complete cards |

`200`, `500` and `503` also set `X-CareerCalm-Status` to `success`, `error` and `research-failed`, respectively. The `200` path sets `Cache-Control: no-cache`. These legacy header names are part of the export.

A synthetic `200` body illustrating the required fields:

```json
{
  "card1": {
    "hook": "What would make this synthetic project useful to the team?",
    "anchor": "The demo covers one fictional meeting scenario.",
    "exit": "I can send the demo outline after the meeting.",
    "mantra": "I can begin with one clear question."
  },
  "card2": {
    "hook": "Which part of this fictional demo should we discuss first?",
    "anchor": "This example contains no real research claim.",
    "exit": "Let us arrange a short follow-up to compare notes.",
    "mantra": "I can listen before responding."
  },
  "card3": {
    "hook": "Could I walk you through a synthetic use case?",
    "anchor": "The use case is a sample for testing the response shape.",
    "exit": "I will share the sample so we can continue later.",
    "mantra": "A simple explanation is enough to start."
  }
}
```

Each card must be an object with nonblank string `hook`, `anchor`, `exit` and `mantra` fields. The parser preserves accepted card objects, so clients should tolerate additional fields. It accepts one raw JSON object or one enclosing generic/`json` Markdown fence; surrounding prose, arrays, missing fields, blank text and provider errors are rejected. Research text must also be a nonblank string. These checks validate shape, not facts, relevance or advice quality.

If the research provider supplies usable citations, the successful body also contains a top-level array. This metadata-only illustration merges with the three-card response:

```json
{
  "research_sources": [
    { "citation_index": 1, "url": "https://example.com/research" },
    { "citation_index": 3, "url": "https://example.org/context" }
  ]
}
```

`citation_index` is the original one-based position in the provider's `citations` string array. Exact duplicate URLs keep their first occurrence, so omitted entries leave gaps. Only the first 100 entries and URLs up to 2,048 characters are considered. The [documented conservative URL subset](README.md#inspect-research-references-offline) excludes credentials, IPv6 literals, unencoded Unicode and malformed values. If no usable entries remain, the property is absent. Only the preceding research node supplies this metadata; source lists in Claude's output are ignored. Other provider schemas are not inferred.

These are research references, not a card-to-source mapping or evidence that any particular claim is supported. Links are neither fetched nor verified for reachability, accuracy or safety. Prompts and card fields are unchanged, and invalid metadata does not reject otherwise valid cards.

## Offline saved-response viewer

From the repository root, run `python3 -m http.server 8000 --bind 127.0.0.1 --directory viewer` and open `http://127.0.0.1:8000`. This loopback HTTP route was browser-verified; stop it with Ctrl+C. The scripts and styles are local files, with no build step, package install or provider service configuration. Directly opening [`viewer/index.html`](viewer/index.html) is an optional route that was not browser-verified here; file-origin and Content Security Policy behavior can differ across browsers. The default content is explicitly synthetic. To inspect an existing successful response, save its HTTP body as JSON and select that one file. Do not supply the n8n workflow export, provider response, Markdown fences, or a `{ data: ... }` wrapper.

The import limit is 1 MiB, checked both against file size and UTF-8 text bytes. All three complete cards are required before the view is replaced. Existing visible cards and their source label remain on failure; errors do not echo the raw payload. Optional malformed references are omitted with a notice. The viewer displays only the four documented fields, preserves their text, and renders it without interpreting Markdown or HTML.

Research metadata is read from the saved file and cannot be authenticated by the viewer. Source links retain their original indices, accept only absolute HTTP(S) URLs without credentials, and use `noopener noreferrer` with no referrer. First occurrences of duplicate URLs or citation indices are retained; at most 100 entries, indices 1–100, and URLs up to 2,048 characters are considered. No references are fetched automatically, and link validity or claim support is not verified.

Clear removes the current cards from the page; Use example restores the synthetic sample. No content is written to storage or uploaded. Reloading resets to the example. A file read finishing after a newer selection, reset or clear cannot replace that later choice. This viewer has no webhook connection or generation controls; paid service setup is separate.

## Optional frontend integration

A live-service frontend is external to this repository. An independently built client should send the JSON body above, render the three cards on `200`, and display the error body on `400`, `500` or `503`. It may render optional `research_sources` as external research references, retaining their citation indices without presenting them as verified support for individual cards. Do not display a failed response as usable cards. Browser access, CORS, loading states, deployment authentication and connection-error handling must be implemented and tested by that client/deployment. There is no `frontend/src/config.js`, frontend npm command or settings screen supplied here.

## Diagnose without provider calls

From this repository root:

```bash
node tests/input-demo.mjs
node tests/research-demo.mjs
node tests/validation-demo.mjs
node tests/source-demo.mjs
node --test tests/*-validation.test.mjs
```

The demos print fresh synthetic observations to stdout and do not overwrite historical `tests/evidence/` files. They execute exported JavaScript and model the stored routes without executing HTTP nodes. Use [input checks](README.md#check-scenario-input-offline) for `400`, [research checks](README.md#check-research-validation-offline) for `503`, and [response checks](README.md#check-response-validation-offline) for `500` or complete-card validation. They do not prove a live service is available. No fixed completion time or per-request cost is established by these checks.
