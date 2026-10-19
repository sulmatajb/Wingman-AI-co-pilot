# Wingman

Three conversation-card options to read before a meeting: a hook, an anchor, an exit and a grounding mantra.

[Open the demo](https://sulmatajb.github.io/Wingman-AI-co-pilot/) · [Run locally](#read-saved-cards-offline) · [Workflow setup](SETUP.md) · [MIT License](LICENSE)

The demo is a browser-only **saved-response viewer** with a clearly labelled synthetic example. Import a saved Wingman response JSON to read your own cards. No account, API key, upload or live generation is involved.

The repository also includes an optional n8n generation workflow and dependency-free offline tests. Live workflow compatibility remains unverified; it needs your own provider credentials and a separate integration check before use.

---

## What It Does

Read three variations in the viewer, or configure the optional workflow to request them from a scenario. Each card contains:
- **The Hook** - How to start the conversation
- **The Anchor** - A fact to reference if it flows
- **The Exit** - How to leave gracefully
- **The Mantra** - A grounding phrase for confidence

---

## Optional generation workflow

The n8n export is configured to request research from Perplexity and coaching from Anthropic. It is separate from the static demo and can incur provider charges. The checked-in model settings and known compatibility limits are described below and in [SETUP.md](SETUP.md).

---

## Read saved cards offline

Clone the repository, then serve only the viewer on loopback with Python 3:

```bash
git clone https://github.com/sulmatajb/Wingman-AI-co-pilot.git
cd Wingman-AI-co-pilot
python3 -m http.server 8000 --bind 127.0.0.1 --directory viewer
```

Open `http://127.0.0.1:8000` in your browser. Stop the local server with Ctrl+C when finished. No package install, account or API keys are needed. The browser verification used this local HTTP approach. The classic scripts also support trying [`viewer/index.html`](viewer/index.html) directly from disk, but direct-file browser behavior was not verified in this environment. The initial three cards are a **synthetic example**, not live research. Choose a saved successful webhook response JSON to view your own cards; the filename and “Saved response” label identify an import. [Example JSON](viewer/example.json) shows the expected shape.

The viewer accepts one raw JSON file up to **1 MiB (1,048,576 bytes)**. All three cards need nonblank `hook`, `anchor`, `exit` and `mantra` strings. Additional card fields are ignored; accepted text is displayed literally, including whitespace and HTML-like content. Error, partial, malformed and oversized responses leave the previously displayed cards and filename intact. **Clear** removes the current view; **Use example** restores the labelled synthetic sample. Later selections, clear and reset take precedence over an earlier file read.

Optional research references keep their recorded citation numbers. Only HTTP(S) links without credentials are displayed; invalid/duplicate metadata is omitted with a notice, without rejecting valid cards. At most 100 source entries and 2,048 characters per URL are considered. These references are unverified research-level context, not support for individual cards. Importing a file cannot establish who generated its text or metadata. Links open in a new tab only when clicked, without a referrer.

Apart from loading its local files, the viewer makes no automatic network requests. It stores no history and does not generate cards or connect to n8n. Reloading returns to the sample. Its browser URL checks are a display filter, not source verification or a complete URL safety check. See [the viewer contract](SETUP.md#offline-saved-response-viewer).

```bash
node --test tests/viewer-validation.test.mjs
```

These focused checks exercise the parser, the actual app with a small DOM/file-read model, and a synthetic successful response through the exported workflow code. They do not run n8n or either provider.

## Quick Start: Offline

From the repository root, using Node.js 22 (verified with 22.14.0):

```bash
node tests/input-demo.mjs
node --test tests/*-validation.test.mjs
```

These commands need no API keys, n8n instance, package install or frontend. The demo prints synthetic accepted/rejected request paths and prepared research requests; it does not send them. The tests exercise the exported JavaScript and a limited model of its stored routes, not a running n8n service.

For service setup, import the included [`Wingman-workflow.json`](Wingman-workflow.json), configure both provider credentials, and use the URL from **Webhook Trigger**. Its stored method/path are `POST` / `careercalm`. See [SETUP.md](SETUP.md) for prerequisites, the JSON contract and an optional manual request that can incur provider charges. Live compatibility and frontend integration are separate checks.

---

## Check scenario input offline

The webhook expects a JSON request body with `intention` as a nonblank string, for example `{ "intention": "Presenting a synthetic project at a team meeting." }`. Missing, null, whitespace-only and non-string scenarios return the existing HTTP 400 error before research preparation. A query parameter or top-level fallback does not bypass the body-only entry gate. No minimum prose length is imposed; valid strings, including their surrounding whitespace, reach the existing prompts unchanged.

```bash
node --test tests/input-validation.test.mjs tests/research-validation.test.mjs tests/response-validation.test.mjs
node tests/input-demo.mjs
```

These standard-library checks execute the exported input expression, preparation code, stored connections and 400 response expression with synthetic fixtures. The harness models the stored strict string `notEmpty` operator; it stops at the HTTP node without sending a request. This is not an n8n runtime, and import compatibility, webhook serialization and live execution remain unverified. The preparation node also rejects unusable values defensively if executed directly; normal webhook rejection happens at the input gate. Historical evidence files are not regenerated by these commands.

## Check response validation offline

With Node.js 22, run:

```bash
node --test tests/response-validation.test.mjs
node tests/validation-demo.mjs
```

These commands use only Node's standard library. They execute the actual `Parse & Validate Response` JavaScript from the exported workflow with synthetic provider responses and follow its stored IF/response connections. No API keys, package installation, model calls, or webhook requests are needed. [Saved example output](tests/evidence/validation-results.json) includes the workflow hash and each fixture's response.

The parser accepts a complete JSON object, optionally enclosed in a `json` or generic Markdown code fence, from text content blocks. All three cards must be objects containing nonblank string `hook`, `anchor`, `exit`, and `mantra` fields. Valid strings are preserved. Arrays, surrounding prose, partial JSON, missing fields, unsupported content blocks, and provider errors are rejected. Complete cards return HTTP 200 with `{ card1, card2, card3 }` and optional provider-derived `research_sources`, described below. Invalid output uses the existing HTTP 500 error path with a field-level explanation where available; raw provider payloads are not included in that error response.

Passing these checks establishes the response shape and required text fields; it does not verify research facts or the quality of the conversation advice.

The harness covers this workflow's Code node, strict Boolean IF condition, response expressions, status codes, and headers. It is not an n8n runtime: import compatibility, credentials, live HTTP serialization/transport, and frontend integration still require a separate integration check. Import the updated export to apply this validation to an existing n8n workflow.

## Check research validation offline

```bash
node --test tests/response-validation.test.mjs tests/research-validation.test.mjs
node tests/research-demo.mjs
```

The research step requires `choices[0].message.content` to be a nonblank string. It rejects missing, null, blank, array and object content, malformed response shapes, and explicit provider error markers—even when an error payload also contains text. Rejected research returns `success: false` without preparing a Claude request, following the existing `Research OK?` → `Research Error Response` path configured for HTTP 503. Error details are controlled messages rather than raw provider payloads. Valid research strings, including whitespace and citation markers, are inserted unchanged into the existing prompt.

These dependency-free synthetic checks execute the exported research code, follow both stored Perplexity output branches, evaluate the strict Boolean IF condition and existing 503 response expression, and inspect the prepared request on the valid branch. They stop before the Claude HTTP node: no provider, model, webhook or network request is made. Nonblank text is only a shape check; it does not establish factual accuracy, relevance, source quality or useful advice. Live n8n import/execution, HTTP serialization and frontend behavior remain unverified. Earlier `tests/evidence/` files remain historical final-card validation snapshots.

---

## Inspect research references offline

```bash
node tests/source-demo.mjs
node --test tests/source-validation.test.mjs
```

Successful responses optionally include `research_sources: [{ citation_index: 1, url: "https://example.com/research" }]` beside the three cards. These come only from the research provider's `citations` string array, as shown in the [Sonar response schema](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview). They are research-level references, not verified support for any individual card or claim. Claude-generated source metadata is ignored; prompts, provider requests and card fields are unchanged.

Only the first 100 citations are inspected, with a 2,048-character limit per URL. Accepted URLs preserve their exact text and original one-based index. Exact duplicate URLs keep their first occurrence; rejected values and duplicates leave index gaps. The conservative HTTP(S) check accepts ASCII DNS names or canonical dotted IPv4, with optional ports 1–65535. It omits credentials, IPv6 literals, unencoded Unicode, whitespace/control characters, backslashes, quote/angle/backtick characters and malformed percent escapes. Encoded Unicode and ASCII punycode hosts can pass. This uses standard JavaScript without a `URL` global or external module and is not a complete URL validity, safety or reachability check. No sources are fetched.

Missing, malformed or entirely unusable citation metadata leaves the original cards-only response intact. Other metadata such as `search_results` is not inferred or migrated. The demo executes both exported Code stages and the stored response expression with synthetic payloads; live n8n serialization and provider compatibility remain unverified. See [the response contract](SETUP.md#configured-response-contract) before consuming this additive field.

## Tech Stack

- **Automation:** n8n
- **Research:** Perplexity HTTP request, configured as `sonar-pro`
- **Coaching:** Anthropic Messages request, configured as `claude-sonnet-4-20250514`
- **Offline checks:** Node.js standard library
- **Service host:** Your n8n instance; a live-service frontend is a separate integration

These model IDs describe the checked-in inactive template, not verified current availability. As of 2026-10-16, Perplexity's [migration notice](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview) says Sonar Chat Completions support ended on September 27, 2026, while synchronous and streaming requests continue through gradual reformulation. This workflow's synchronous request has not been tested live; review compatibility before service use. No provider migration is included here.

---

## Example Scenarios

✅ "Cold calling the Director of Operations at a restaurant chain to pitch AI automation"  
✅ "Networking at a fintech conference in NYC where I only know the host"  
✅ "Presenting my automation roadmap to the executive team"  
✅ "Coffee meeting with a potential co-founder I met on Twitter"

Adding a role, industry and purpose can make a scenario more useful. Brief strings such as "Meeting someone" are still accepted by input validation; it checks type and blankness, not scenario quality.

---

## Cost

The viewer and offline commands make no provider calls. Running a valid scenario through an enabled n8n workflow can incur Perplexity and Anthropic usage charges. Cost and latency depend on provider behavior and usage; this repository does not establish a fixed price or response time.

---

## Contributing

PRs welcome. Ideas for improvement:
- [ ] Voice input for mobile
- [ ] Save scenarios for later
- [ ] Calendar integration (auto-prep before meetings)
- [ ] Industry-specific templates

---

## License

[MIT](LICENSE) — Copyright (c) 2026 Besnik Sulmataj.

---

**Built by Besnik**


⭐ Star this repo if it helped you nail that conversation.
