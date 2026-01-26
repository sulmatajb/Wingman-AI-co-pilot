# 🤝 Wingman

An AI co-pilot for high-stakes conversations. Get researched conversation starters in 60 seconds.

**Built for the 70% of Gen Z professionals who say anxiety is their biggest career challenge.**

[Try it live](your-vercel-link) • [Setup Guide](SETUP.md)

---

## What It Does

Type your scenario → Get 3 confidence cards in 60 seconds:
- **The Hook** - How to start the conversation
- **The Anchor** - A fact to reference if it flows
- **The Exit** - How to leave gracefully

---

## How It Works

Behind the scenes:
- **Perplexity** finds current industry context
- **Claude Sonnet 4** coaches your delivery
- **n8n** orchestrates everything

---

## Quick Start

1. Import `wingman-workflow.json` into n8n
2. Add your API keys (Perplexity + Claude)
3. Copy your webhook URL
4. Paste it into [the app](your-vercel-link)

Full instructions → [SETUP.md](SETUP.md)

---

## Tech Stack

- **Automation:** n8n
- **Research:** Perplexity API (sonar-medium-online)
- **Coaching:** Claude Sonnet 4
- **Frontend:** React + Tailwind + Framer Motion
- **Hosting:** Vercel (frontend) + your n8n instance

---

## Example Scenarios

✅ "Cold calling the Director of Operations at a restaurant chain to pitch AI automation"  
✅ "Networking at a fintech conference in NYC where I only know the host"  
✅ "Presenting my automation roadmap to the executive team"  
✅ "Coffee meeting with a potential co-founder I met on Twitter"

❌ "Meeting someone" (too vague)  
❌ "Networking event" (needs more context)

---

## Cost

~$0.025 per scenario (Perplexity + Claude API usage)

---

## Why I Built This

98% of young professionals experience burnout. Most of it hits in the 30 seconds before you walk into a room.

I've been there - frozen outside a meeting, heart racing, brain blank.

This is for anyone who's felt that.

---

## Contributing

PRs welcome. Ideas for improvement:
- [ ] Voice input for mobile
- [ ] Save scenarios for later
- [ ] Calendar integration (auto-prep before meetings)
- [ ] Industry-specific templates

---

## License

MIT - use it, fork it, build on it.

---

**Built by [Besnik](https://linkedin.com/in/yourprofile)**  
Customer Care Manager & AI Champion at Schneider Electric  
Automation consultant at Besnik.AI

⭐ Star this repo if it helped you nail that conversation.
