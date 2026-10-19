# Run and deploy Wingman

## Local development

Install Node.js 22 and run `npm ci`. `npm run dev` serves the frontend and `/api/generate` together at `http://127.0.0.1:3000`. The local server binds only to loopback and serves a fixed list of browser files.

For generation, use a Vercel account with access to an AI Gateway model and available credits. Link this checkout to **your own** project, then pull its development environment:

```sh
vercel link
vercel env pull .env.local
npm run dev
```

The development environment includes a short-lived `VERCEL_OIDC_TOKEN`. Refresh it with `vercel env pull .env.local` when it expires. `.env.local` and `.vercel/` are ignored by Git. Never commit either, and never put credentials in browser code.

Outside Vercel, the SDK can use an `AI_GATEWAY_API_KEY` stored only in your server environment. A project budget is tied to project OIDC identity; an API key needs its own applicable budget. Do not assume the public deployment’s project budget protects a different deployment or API key.

The checked-in model is `google/gemini-2.5-flash`. Its eligibility for the account’s existing free credits was verified during deployment. Availability and pricing can change. A provider failure returns a controlled error and does not fall back to another provider or a synthetic card.

## Deploy to Vercel

```sh
npm ci
npm test
npm run build
vercel deploy
```

Review the preview, then `vercel deploy --prod` to publish your own project. `vercel.json` selects the frameworkless Node runtime, copies only `viewer/` assets into the public output, and configures a 45-second function ceiling. Server generation uses a shorter 35-second deadline. Request cancellation is enabled and its signal propagates to the model request; cancellation does not undo already incurred usage.

The public Wingman project is `ai-wingman`. Its app URL is https://ai-wingman.vercel.app. Its deployed source is this repository, not the older `sulmatajb/ai-wingman` frontend.

Before exposing your own deployment, configure an AI Gateway budget for that project and check its account’s credit settings. The current public app uses a $1 monthly project budget and existing credits. The in-memory request guards are per instance, not globally coordinated. For higher-volume use, add a distributed quota or platform rate-limit rule; do not increase credits without considering abuse and legitimate traffic.

## HTTP contract

Send `POST /api/generate` with JSON `{ "scenario": "..." }`. The trimmed scenario must contain 10–2,000 JavaScript string characters; total body size is capped at 16 KiB even without a Content-Length header. Only same-origin browser requests are accepted.

- `200`: exactly three cards, each with nonblank plain-text `hook`, `anchor`, `exit`, `mantra` fields.
- `400`, `413`, `415`: unusable JSON/scenario, oversized body, or wrong content type.
- `403`, `405`: disallowed browser origin or method.
- `429`: request/provider capacity limit; wait according to `Retry-After`.
- `502`, `503`, `504`: unusable model response, unavailable credentials/credits/service, or timeout.

Errors contain controlled text only. Raw provider bodies and credentials are not returned. Valid existing cards remain visible after a failed request.

## Saved cards and legacy workflow

The secondary import reads `{ "card1": {...}, "card2": {...}, "card3": {...} }` from a local JSON file up to 1 MiB. Imported text is displayed literally, and only validated HTTP(S) research references are linked. Nothing is uploaded. [Example file](viewer/example.json).

The optional n8n workflow has a different input/output contract and is not connected to the live app. See [N8N-SETUP.md](N8N-SETUP.md) and [export instructions](WORKFLOW-EXPORT-INSTRUCTIONS.md).
