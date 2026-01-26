# wingman-workflow.json

**You need to export this from your n8n instance.**

## How to Export Your Workflow:

1. Open your Wingman workflow in n8n
2. Click the **...** menu (top right)
3. Select **Download**
4. Save as `wingman-workflow.json`
5. Upload this file to your GitHub repo

---

## Important Notes Before Exporting:

### Remove Sensitive Data
Before uploading to GitHub, make sure your exported workflow does NOT contain:
- Your actual API keys (n8n should strip these automatically)
- Your n8n instance URL
- Any personal webhook URLs

### What Should Be Included:
- All node configurations
- Workflow logic
- Node connections
- Placeholder credential references (not actual keys)

---

## Workflow Structure Overview

Your exported workflow should contain these nodes:

1. **Webhook Trigger** - Receives requests from frontend
2. **Prepare Perplexity Request** - Extracts scenario from input
3. **Perplexity API Call** - Searches for current research
4. **Process Research & Prepare Claude** - Formats data for Claude
5. **Claude API Call** - Generates confidence cards
6. **Parse Claude Response** - Extracts the 3 cards
7. **Webhook Response** - Returns JSON to frontend

---

## After Exporting:

1. Open the JSON file in a text editor
2. Search for any sensitive data (API keys, URLs)
3. Replace with placeholders if needed
4. Upload to GitHub

---

**Need help?** Check the [SETUP.md](SETUP.md) guide for full instructions.
