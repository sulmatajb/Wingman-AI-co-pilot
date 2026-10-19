# Wingman

Describe a conversation you’re preparing for. Wingman generates three ways to approach it, each with an opening, a follow-up, an exit and a short grounding reminder.

**[Use Wingman](https://ai-wingman.vercel.app)** · [Setup](SETUP.md) · [MIT License](LICENSE)

No account or API key is needed to use the public app. Enter a scenario and choose **Make my cards**. The three options are generated for that request, not selected from a saved set.

## What to expect

- Three different approaches to the same conversation.
- Scenarios from 10 to 2,000 characters.
- Loading and retry states; a failed request keeps the previous cards visible.
- Responsive cards on phones and desktops.
- Optional local JSON import and a clearly labelled synthetic example under “Try an example or open saved cards.”

Generation uses Google Gemini 2.5 Flash through Vercel AI Gateway. It uses only the scenario you provide, without browsing the web. Treat the result as wording to adapt, not verified facts about people or organizations.

Your scenario goes to Vercel and the model provider. Leave out sensitive information. The application does not persist scenarios, cards or a browser history, and its code does not log prompts or model responses. Hosting and model providers have their own processing and retention policies. Imported JSON stays in your browser.

## Run locally

Use Node.js 22 and npm:

```sh
git clone https://github.com/sulmatajb/Wingman-AI-co-pilot.git
cd Wingman-AI-co-pilot
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. Local generation needs Vercel AI Gateway credentials; see [setup](SETUP.md). The sample and saved-card import work without credentials. A missing credential produces an error; it never silently substitutes an example for generated cards.

## Checks

```sh
npm test
npm run build
```

Tests cover server input/output validation, error handling, timeouts, cancellation and rate limits; browser parsing and request races; and the legacy workflow’s offline contracts. No model calls run during tests or CI. The build copies only six browser assets to `dist/`; server code and credentials are not public assets.

## Deployment and limits

The app is a static frontend plus one Node.js Vercel Function at `POST /api/generate`. Vercel supplies server-side OIDC credentials, so no provider key is embedded in browser code. Each request has a 35-second generation deadline, a 2,000-token output ceiling and no automatic retries.

The public deployment has a **$1 monthly AI Gateway project budget** against existing credits. Generation becomes unavailable if that limit or the account’s available credits are exhausted. No automatic credit purchase was enabled for this deployment. Other hosting charges are outside that AI budget.

The server also allows five generation attempts per minute per IP and four concurrent generations **per function instance**. These are best-effort guards, not a distributed quota; cold starts and multiple instances can reset or multiply them. The Gateway project budget provides the separate spend limit, subject to in-flight requests crossing its threshold.

## API

```http
POST /api/generate
Content-Type: application/json

{"scenario":"I’m meeting a new teammate and want to ask about their work."}
```

Success returns `{ "cards": [ { "hook", "anchor", "exit", "mantra" }, ... ] }` with exactly three complete cards. Errors return `{ "error": "..." }` with an appropriate non-200 status. Responses are not cached. Browser calls are same-origin; the endpoint does not accept a caller-selected model, provider or URL.

## Optional n8n workflow

[`Wingman-workflow.json`](Wingman-workflow.json) is an older, separate research-and-coaching workflow using Perplexity and Anthropic. It is not used by the public app. Its live provider compatibility remains unverified; offline tests do not establish service compatibility. See [n8n setup and limitations](N8N-SETUP.md) before using it.

## License

[MIT](LICENSE) — Copyright (c) 2026 Besnik Sulmataj.
