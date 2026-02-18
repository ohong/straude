# Straude

**Strava for Claude Code.**

Track your Claude Code usage. Share your sessions. Climb the leaderboard.

![Hero — peak performance](apps/web/public/images/hero.jpg)

## Why?

Running used to be solitary. Then Strava made it social. Agentic engineering with Claude Code is the new solitary grind — people are [spending thousands](https://www.wsj.com/tech/ai/anthropic-claude-code-ai-7a46460e) building with AI, but there's no way to share the journey. Straude changes that.

## How it works

Push your stats with a single command — no install needed:

```bash
npx straude@latest push
```

The CLI reads your local [ccusage](https://github.com/ryoppippi/ccusage) data (cost, tokens, models, sessions), uploads it to Straude, and auto-creates a post on your feed. Login once with `npx straude@latest login`, then `push` daily. Use `npx straude@latest status` to check your streak and rank.

## Features

- **Track** — Cost, tokens, models, and sessions in one place.
- **Share** — Auto-posted sessions with optional screenshots and AI-generated captions.
- **Compete** — Global and regional leaderboards (daily/weekly/monthly/all-time).
- **Streak** — Code with Claude every day. Your streak is your badge of honor.

## Privacy

Go public and compete on the leaderboard, or stay private and share only with followers.

## Hackathon

Straude is an entry in [**Built with Opus 4.6: a Claude Code hackathon**](https://cerebralvalley.ai/e/claude-code-hackathon) under **Problem Statement One: Build a Tool That Should Exist**. The entire project was built by Claude Opus 4.6, with special help from the experimental *Agent Teams* feature.

## Get started

> [straude.com](https://straude.com)