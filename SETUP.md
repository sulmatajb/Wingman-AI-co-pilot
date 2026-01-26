# Wingman Setup Guide

Get your Wingman instance running in under 10 minutes.

---

## Prerequisites

- n8n instance (cloud or self-hosted)
- Perplexity API key → [Get one here](https://www.perplexity.ai/settings/api)
- Anthropic API key → [Get one here](https://console.anthropic.com/)

---

## Step 1: Import the n8n Workflow

1. Download `wingman-workflow.json` from this repo
2. Open your n8n instance
3. Go to **Workflows** → **Import from File**
4. Select the downloaded JSON file
5. Click **Import**

---

## Step 2: Add Your API Keys

Once imported, you'll need to configure two credentials:

### Perplexity API
1. Click on the **Perplexity** node in the workflow
2. Under **Credentials**, click **Create New**
3. Name it: `Perplexity API`
4. Paste your API key
5. Click **Save**

### Anthropic (Claude) API
1. Click on the **Claude** node in the workflow
2. Under **Credentials**, click **Create New**
3. Name it: `Anthropic API`
4. Paste your API key
5. Click **Save**

---

## Step 3: Activate the Workflow

1. Click the toggle at the top right to **Activate** the workflow
2. The webhook is now live

---

## Step 4: Get Your Webhook URL

1. Click on the **Webhook** node (the first node in the workflow)
2. Copy the **Production URL**
3. It should look like: `https://your-n8n-instance.com/webhook/wingman`

---

## Step 5: Connect to the Frontend

### Option A: Use the Live Demo
1. Go to [your-vercel-link]
2. Click the ⚙️ settings icon (top right)
3. Paste your webhook URL
4. Click **Save**

### Option B: Run Locally
1. Clone this repo
2. Open `frontend/src/config.js`
3. Replace the webhook URL with yours:
   ```javascript
   export const WEBHOOK_URL = "https://your-n8n-instance.com/webhook/wingman";
   ```
4. Run `npm install && npm run dev`

---

## Step 6: Test It

1. Type a scenario: "Cold calling the Director of Operations at a restaurant chain to pitch AI automation"
2. Wait 60 seconds
3. You should get 3 confidence cards

---

## Troubleshooting

### "Webhook failed" error
- Check that your workflow is **activated** (toggle should be green)
- Verify both API keys are valid
- Check n8n execution logs for errors

### "Cards are empty" or generic
- Your scenario might be too vague
- Add more specifics: industry, role, context
- Example: ❌ "Meeting someone" → ✅ "Meeting the CTO of a Series B fintech startup"

### Slow response times
- Perplexity research takes 20-40 seconds
- Claude processing takes another 15-20 seconds
- Total: 60 seconds is normal

---

## API Costs (Estimate)

Per request:
- Perplexity: ~$0.005 (sonar-medium-online)
- Claude Sonnet 4: ~$0.02 (1500 tokens)
- **Total: ~$0.025 per scenario**

100 requests = ~$2.50

---

## Need Help?

Open an issue on GitHub or DM me on [LinkedIn/Twitter]

---

**You're live. Go prep for that high-stakes conversation.**
