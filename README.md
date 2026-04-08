# Straude

**Strava for Claude Code.**

Track your Claude Code usage. Share your sessions. Climb the leaderboard.

[![Watch the demo](https://img.youtube.com/vi/NTI_-jRtW2g/maxresdefault.jpg)](https://www.youtube.com/watch?v=NTI_-jRtW2g)

## Why?

Running used to be solitary. Then Strava made it social. Agentic engineering with Claude Code is the new solitary grind — people are [spending thousands](https://www.wsj.com/tech/ai/anthropic-claude-code-ai-7a46460e) building with AI, but there's no way to share the journey. Straude changes that.

## How it works

Sync your stats with a single command — no install needed:

```bash
npx straude@latest
```

The CLI reads your local [ccusage](https://github.com/ryoppippi/ccusage) data (cost, tokens, models, sessions), uploads it to Straude, and auto-creates a post on your feed. First run opens a browser login; after that, just run `npx straude@latest` daily. It automatically pushes new stats since your last sync.

Options: `--date YYYY-MM-DD` to push a specific date, `--days N` to backfill the last N days (max 7), `--dry-run` to preview without posting. Run `npx straude@latest status` to check your streak and rank.

## Features

- **Track** — Cost, tokens, models, and sessions in one place.
- **Share** — Auto-posted sessions with optional screenshots and AI-generated captions.
- **Compete** — Global and regional leaderboards (daily/weekly/monthly/all-time).
- **Streak** — Code with Claude every day. Your streak is your badge of honor.

## Scorecard

Display your Straude scorecard on your GitHub profile:

<a href="https://straude.com/u/ohong">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://straude.com/api/embed/ohong/svg?theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://straude.com/api/embed/ohong/svg" />
    <img alt="Straude Scorecard" src="https://straude.com/api/embed/ohong/svg" />
  </picture>
</a>

Add this to your README (replace `YOUR_USERNAME` with your Straude username):

```markdown
[![Straude Scorecard](https://straude.com/api/embed/YOUR_USERNAME/svg)](https://straude.com/u/YOUR_USERNAME)
```

**Options:**

| Param | Values | Default |
|-------|--------|---------|
| `theme` | `light`, `dark` | `light` |
| `compact` | `1` | off |

**Compact badge:** `https://straude.com/api/embed/YOUR_USERNAME/svg?compact=1`

**Auto-match GitHub theme:**

```html
<a href="https://straude.com/u/YOUR_USERNAME">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://straude.com/api/embed/YOUR_USERNAME/svg?theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://straude.com/api/embed/YOUR_USERNAME/svg" />
    <img alt="Straude Scorecard" src="https://straude.com/api/embed/YOUR_USERNAME/svg" />
  </picture>
</a>
```

## Privacy

Go public and compete on the leaderboard, or stay private and share only with followers.

## FAQ

### What data does Straude collect?

Only **aggregate token usage statistics** — the same numbers you'd see on your Anthropic/OpenAI billing dashboard:

- Token counts (input, output, cache read, cache creation)
- Cost in USD
- Model names used (e.g. "Claude Opus", "GPT-4.1")
- Session count and dates

That's it. **We have zero access to your prompts, code, conversations, file contents, or anything you do inside Claude Code or Codex.** The CLI reads pre-aggregated daily totals from local [ccusage](https://github.com/ryoppippi/ccusage) data — it never touches your session transcripts or project files.

### Where does the usage data come from?

The CLI runs [ccusage](https://github.com/ryoppippi/ccusage) locally on your machine, which reads the JSONL log files that Claude Code writes to `~/.claude/`. These logs contain token counts and cost per API call. ccusage aggregates them into daily totals, and the Straude CLI sends those totals to the server. The raw logs never leave your machine.

### Can Straude see my code or prompts?

No. The data pipeline is: local JSONL logs → ccusage (local aggregation) → daily totals sent to Straude. At no point does any conversation content, prompt text, code, or file path leave your machine. You can verify this yourself — the CLI is open source, and you can run `npx straude --dry-run` to see exactly what would be sent before it's sent.

### Is my profile public by default?

No. You choose your visibility during onboarding. Private profiles are only visible to approved followers. You can switch between public and private at any time in settings.

## Hackathon

Straude is an entry in [**Built with Opus 4.6: a Claude Code hackathon**](https://cerebralvalley.ai/e/claude-code-hackathon) under **Problem Statement One: Build a Tool That Should Exist**. The entire project was built by Claude Opus 4.6, with special help from the experimental *Agent Teams* feature.

## Local development

### Prerequisites

- [Bun](https://bun.sh/) (v1.3+)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (v2.x)
- [Docker](https://docs.docker.com/get-docker/) (required by Supabase local)

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Start local Supabase (Postgres, Auth, Storage via Docker)
bun run local:up

# 3. Generate .env.local with local Supabase credentials
bun run local:env

# 4. Seed demo data (optional)
bun run local:seed

# Or run steps 2–4 in one command:
bun run local:setup

# 5. Start the dev server
bun run dev
```

The app will be available at `http://localhost:3000`.

## Docs

| Document | Description |
|----------|-------------|
| [Changelog](docs/CHANGELOG.md) | Release history and what changed |
| [Decisions](docs/DECISIONS.md) | Architecture and design decisions with rationale |
| [Roadmap](docs/ROADMAP.md) | Planned features and future work |
| [Security](docs/SECURITY.md) | Security audit findings and status |
| [Specs](docs/straude-specs-v1.md) | Original v1 product specification |

## Get started

> [straude.com](https://straude.com)
