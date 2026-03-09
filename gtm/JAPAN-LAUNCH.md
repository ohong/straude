# Japan Launch — Execution Guide

**Owner:** Growth Intern
**Goal:** 200K+ impressions in first week of Japanese market launch
**Target:** Japanese developers using Claude Code, Codex, Cursor, and other AI coding tools

**Tools at your disposal:** Claude Code (for content drafts, translations, automation scripts), OpenClaw (for research, scheduling, outreach automation), plus any browser-based tools you need.

---

## How to Use This Document

This is a step-by-step checklist. Do the steps in order. Each step tells you exactly what to do, what tool to use, and what "done" looks like. The collateral is drafted in both English and Japanese — review the Japanese with a native speaker or Claude before publishing.

---

## Phase 1: Account Setup (Day -7)

### Step 1.1: Create platform accounts

You need accounts on 5 platforms. Do all of these in one sitting.

| # | Platform | URL | What to do | Done when |
|---|----------|-----|-----------|-----------|
| 1 | **Qiita** | qiita.com | Sign up with GitHub. Add a profile photo and bio in Japanese. | You can see the "New Article" button |
| 2 | **Zenn** | zenn.dev | Sign up with GitHub. Connect a GitHub repo for publishing. | You can see the "New Article" button |
| 3 | **Note.com** | note.com | Sign up with email. Add profile photo and bio in Japanese. | You can see the "Create" button |
| 4 | **PR TIMES** | prtimes.jp | Create a company account. This requires a Japanese phone number — ask the team if we have one, or use a virtual number service. | You can access the press release editor |
| 5 | **Connpass** | connpass.com | Sign up. Join "Claude Code Meetup Japan" group. | You're a member of the meetup group |

**Bio to use on all platforms (Japanese):**

> Straudeの開発チームです。Claude CodeとCodexの利用データを可視化するプラットフォームを作っています。「アスリートのようにコードを書く」がコンセプトです。
>
> (We're the Straude dev team. We build a platform that visualizes Claude Code and Codex usage data. Our concept is "code like an athlete.")

**Automation tip:** Use Claude Code to generate platform-specific bios if character limits differ. Prompt: `"Shorten this Japanese bio to under 80 characters for [platform]"`

### Step 1.2: Set up tracking

Before any content goes live, set up tracking so we can measure impressions.

- [ ] Create a UTM spreadsheet with these campaign parameters:
  - `utm_source=qiita|zenn|note|twitter|prtimes|youtube|slack|discord`
  - `utm_medium=social|article|press|community`
  - `utm_campaign=japan-launch-2026`
- [ ] Generate shortened links for each platform using Dub.co or Bit.ly
- [ ] Set up a simple dashboard (Notion or Google Sheet) to track daily: impressions, clicks, signups, CLI installs

**Automation tip:** Use Claude Code to generate all UTM link combinations at once. Prompt: `"Generate UTM links for straude.com with source=[list], medium=[list], campaign=japan-launch-2026. Output as a markdown table."`

---

## Phase 2: Prepare Collateral (Day -6 to -3)

### Step 2.1: Record the demo video (60 seconds)

Record this FIRST — you'll embed it in the X thread and reference it in articles.

**Equipment:** Screen recording tool (OBS, Loom, or QuickTime). No voiceover needed — text overlays only.

**Script:**

| Timestamp | What's on screen | Text overlay (EN) | Text overlay (JP) |
|-----------|-----------------|-------------------|-------------------|
| 0-5s | Empty terminal, cursor blinking | "How much are you spending on Claude Code?" | 「Claude Codeにいくら使ってる？」 |
| 5-15s | Type `npx straude@latest`, show CLI output | "One command. Full visibility." | 「コマンド一つで、すべて可視化。」 |
| 15-25s | Browser: Straude feed with sessions | "Track every session. See the patterns." | 「すべてのセッションを記録。パターンを見つけよう。」 |
| 25-35s | Leaderboard page, filter by 🇯🇵 | "Compete with developers worldwide." | 「世界中の開発者と競い合おう。」 |
| 35-45s | Profile page: streak counter, contribution graph | "Streaks. Kudos. Community." | 「連続記録。リアクション。コミュニティ。」 |
| 45-55s | Join page with referral link, OG image | "Share your invite. Build your crew." | 「仲間を招待して、クルーを作ろう。」 |
| 55-60s | Logo + URL on dark background | "straude.com — Code like an athlete." | 「straude.com — アスリートのようにコードを書け。」 |

**Steps:**
1. Open the Straude app and make sure there's real data visible (use a test account with sessions)
2. Record each segment separately — it's easier to edit
3. Use **Japanese text overlays** for the JP version, English for the EN version (make two cuts)
4. Export as MP4, 1280x720, under 60 seconds
5. Upload to the team's shared drive

**Automation tip:** Use OpenClaw to find royalty-free background music (lo-fi or ambient) that fits a 60-second tech demo. Keep it subtle.

### Step 2.2: Take screenshots

You'll need these for the Qiita article, X thread, and press release.

Capture these screenshots at 2x resolution (Retina):

- [ ] CLI output after running `npx straude@latest` (terminal with dark theme)
- [ ] Feed page with 3+ sessions visible
- [ ] Leaderboard filtered by 🇯🇵 Japan (if we have JP users; if not, use global)
- [ ] Profile page showing streak, contribution graph, and stats
- [ ] Join/referral page with the dynamic OG card visible
- [ ] Settings page showing the privacy toggle

Save as PNG. Name them: `ss-cli.png`, `ss-feed.png`, `ss-leaderboard.png`, `ss-profile.png`, `ss-join.png`, `ss-settings.png`

### Step 2.3: Write the Qiita article

This is the single most important piece of content. A viral Qiita article is worth more than everything else combined.

**What makes Qiita articles go viral:**
- 10+ LGTMs in the first 24 hours puts you on the daily ranking
- Daily ranking → trending feed → 5,000-10,000 views/day compounding
- Practical "how-to" format with code blocks outperforms opinion pieces
- Post at **8:00 AM JST** (morning commute = first wave of engagement)

**Tags to use (exactly 5):** `ClaudeCode`, `生成AI`, `バイブコーディング`, `CLI`, `Anthropic`

Copy-paste the article below into Qiita's editor. Replace `[screenshots]` with actual images. Review the Japanese with a native speaker before publishing.

---

**Title:** `Claude Codeにいくら使ってるか可視化したら、開発スタイルが変わった話`

**Body:**

```markdown
## はじめに

Claude Codeを毎日使っている。もう何ヶ月も。でも、いくら使っているのか、トークンをどれだけ消費しているのか、「生産的」だと思っていたセッションが実際に効率的だったのか——まったく把握できていなかった。

だから作った。[Straude](https://straude.com?utm_source=qiita&utm_medium=article&utm_campaign=japan-launch-2026) ——Claude Code版のStrava。

## Straudeが記録するもの

コマンド一つで、こうなる：

$ npx straude@latest

  ┌─────────────────────────────────────────┐
  │  straude — code like an athlete         │
  │                                         │
  │  today       $4.82 · 847K tokens        │
  │  this week   $18.40 · 3.2M tokens       │
  │  streak      12 days                    │
  │  rank        #47 globally               │
  └─────────────────────────────────────────┘

ローカルのClaude Code利用データを読み取り、ダッシュボードに同期する。それだけ。

[screenshot: ss-cli.png]

## セットアップ（2分）

1. [straude.com](https://straude.com?utm_source=qiita&utm_medium=article&utm_campaign=japan-launch-2026) でGitHubアカウントを使ってサインアップ
2. CLIを実行：

```bash
npx straude@latest
```

3. ブラウザで認証。以上。

あとは毎日 `npx straude@latest` を1回実行するだけ（cronで自動化も可能）。日次の利用状況——コスト、トークン数、使用モデル、セッション数——がすべて記録される。

## データから分かったこと

### セッションのコストと生産性は比例しない

最も高額なセッション（$15以上）は、タスク間を行き来してコンテキストを何度も説明し直すような、コンテキストスイッチの嵐だった。最も生産的だったのは、$3〜5程度の2〜3時間の集中ブロック。

### 金額より連続記録（ストリーク）が重要

Straudeは毎日のコーディングストリークを記録する。カウンターを見た途端、毎日欠かさずコードを書くようになった。ランニングの連続記録と同じ心理——途切れさせたくない。

### 他の開発者との比較がモチベーションになる

グローバルリーダーボードで、支出額、トークン数、ストリークのランキングが見られる。自分が12日連続のとき、30日連続の人を見つけたら？それは燃料になる。

[screenshot: ss-leaderboard.png]

## ソーシャル機能

Straudeは単なるダッシュボードではない：

- **セッション共有** — 日次ログにタイトル、説明、スクリーンショットを追加
- **フォロー** — 他の開発者がどのモデルを使い、いくら使っているか確認
- **コメント＆リアクション** — Stravaのkudosのようなもの
- **リーダーボード** — デイリー、ウィークリー、マンスリー、オールタイム。国別フィルターあり

[screenshot: ss-feed.png]

## チームでの活用

チームでClaude Codeを使っているなら、Straudeはマイクロマネジメントなしに全体の利用状況を把握できる。誰が最もアウトプットしているか？共有する価値のある効率的なワークフローを見つけたのは誰か？

## プライバシー

プロフィールはパブリックにもプライベートにもできる。プライベートユーザーはリーダーボードや検索に表示されない。表示する情報は自分でコントロールできる。

[screenshot: ss-settings.png]

## アスリートのメタファー

私はマラソンを走る。すべてのランをStravaで記録している——誰かに強制されるからではなく、計測することで上達するから。Straudeは同じ原理をAI駆動開発に適用した。

トレーニングに時計なしで臨む人はいない。なぜAIコーディングは記録せずにやるのか？

---

**試してみる：** [straude.com](https://straude.com?utm_source=qiita&utm_medium=article&utm_campaign=japan-launch-2026)

```bash
npx straude@latest
```
```

---

### Step 2.4: Write the Zenn article

This is a shorter version of the Qiita article, focused on the technical setup. Zenn's audience prefers depth and technical detail over storytelling.

**Steps:**
1. Create a new article on Zenn
2. Use the content below
3. Publish at **8:30 AM JST** on launch day (30 min after Qiita)

---

**Title:** `Claude Codeの利用コストをCLIで可視化する「Straude」を試してみた`

(I tried "Straude" — a CLI tool for visualizing Claude Code usage costs)

**Body:**

```markdown
## TL;DR

- Claude Code / Codexの日次利用データ（コスト、トークン、モデル、セッション数）を1コマンドで記録
- グローバルリーダーボードで他の開発者と比較
- 連続記録（ストリーク）で毎日のモチベーション維持
- 無料。セットアップ2分

## インストールと初回セットアップ

```bash
# GitHubアカウントでstraude.comにサインアップ後：
npx straude@latest
```

初回実行時にブラウザが開き、OAuth認証を行う。認証後、その日のClaude Code利用データが自動的にアップロードされる。

2回目以降は、前回の同期以降のデータ（最大7日分）を自動でプッシュする。

## CLIコマンド一覧

```bash
# デフォルト（スマート同期）
npx straude@latest

# ログイン（トークン再取得）
npx straude@latest login

# 特定の日付をプッシュ
npx straude@latest push --date 2026-03-01

# 過去N日分をプッシュ（最大7日）
npx straude@latest push --days 3

# ドライラン（データ確認のみ、送信しない）
npx straude@latest push --dry-run

# ステータス確認（ストリーク、週間コスト、ランク）
npx straude@latest status
```

## データソース

StraudeはローカルのClaude Code利用データ（ccusage CLIの出力）を読み取る。Codexのデータにも対応しており、日付ごとにマージされる。

データは `~/.straude/config.json` に保存される（モード0600、オーナーのみ読み取り可能）。

## ダッシュボード

Webダッシュボード（straude.com）では以下が確認できる：

- **フィード** — 自分と他のユーザーのセッション一覧
- **リーダーボード** — デイリー/ウィークリー/マンスリー/オールタイム、国別フィルター
- **プロフィール** — ストリーク、コントリビューショングラフ（GitHubのような日次ヒートマップ）、累計コスト
- **投稿詳細** — セッションにタイトル・説明・画像を追加、コメント・リアクション

## cron で自動化

毎日自動的にデータを同期するなら：

```bash
# crontab -e で以下を追加（毎日23:50に実行）
50 23 * * * npx straude@latest push --days 1
```

## プライバシー

- プロフィールはパブリック/プライベート切り替え可能
- プライベートユーザーはリーダーボード・検索に非表示
- データは暗号化して送信、ローカルの利用データは読み取りのみ（変更・削除しない）

## 所感

1週間使ってみて分かったこと：

1. **高額セッション ≠ 生産的セッション。** $15超えのセッションはコンテキストスイッチの嵐だった
2. **ストリークの心理効果は強い。** 連続記録が途切れそうになると、23:50に駆け込みでコードを書く自分がいた
3. **国別リーダーボードが意外と楽しい。** 🇯🇵をもっと上位に押し上げたい

---

試してみる → [straude.com](https://straude.com?utm_source=zenn&utm_medium=article&utm_campaign=japan-launch-2026)
```

---

### Step 2.5: Write the X/Twitter launch thread

This goes out at **9:00 AM JST** on launch day. Post all 5 tweets as a thread within 2-3 minutes.

**Automation tip:** Use OpenClaw or Typefully to schedule the thread in advance. Set it for 9:00 AM JST on launch day.

---

**Tweet 1 (Hook):**

> EN: I've spent $XXX on Claude Code in the past 3 months.
> I know the exact number because I built a tool to track it.
> Straude — Strava for Claude Code.

> JP:
> この3ヶ月でClaude Codeに$XXX使った。
>
> 正確な金額が分かるのは、それを記録するツールを作ったから。
>
> Straude — Claude Code版Strava。🧵

**Tweet 2 (Problem):**

> EN: Claude Code doesn't show you:
> - How much you've spent today
> - Your most expensive sessions
> - Whether you're getting faster or just spending more
>
> I wanted a running log for my AI coding habit.

> JP:
> Claude Codeは教えてくれない：
> ・今日いくら使ったか
> ・最も高額だったセッション
> ・速くなっているのか、ただ多く使っているだけなのか
>
> AIコーディングの「走行ログ」が欲しかった。

**Tweet 3 (Solution):**

> EN: One command:
> `npx straude@latest`
>
> It reads your local Claude Code data and syncs it to a dashboard.
> Cost, tokens, models, sessions — all tracked daily.
>
> [attach: ss-cli.png]

> JP:
> コマンド一つ：
> `npx straude@latest`
>
> ローカルのClaude Codeデータを読み取り、ダッシュボードに同期。
> コスト、トークン数、モデル、セッション——毎日記録される。
>
> [attach: ss-cli.png]

**Tweet 4 (Social):**

> EN: But the real hook is the social layer.
> - Global leaderboard (filter by country 🇯🇵)
> - Daily streaks (don't break the chain)
> - Follow devs, react to sessions
> - Share your breakthrough moments
>
> [attach: ss-leaderboard.png]

> JP:
> 本当に面白いのはソーシャル機能。
> ・グローバルリーダーボード（国別フィルターあり 🇯🇵）
> ・デイリーストリーク（連続記録を途切れさせるな）
> ・開発者をフォロー、セッションにリアクション
> ・突破の瞬間を共有
>
> [attach: ss-leaderboard.png]

**Tweet 5 (CTA):**

> EN: Try it free: straude.com
> Takes 2 minutes. See where you rank.
> Japanese Claude Code users — see you on the leaderboard.

> JP:
> 無料で試せる → straude.com
> 2分でセットアップ完了。自分のランクを確認しよう。
>
> 日本のClaude Codeユーザーの皆さん、リーダーボードで待ってます。
>
> #ClaudeCode #バイブコーディング

---

### Step 2.6: Write the Note.com founder story

This targets a broader audience — PMs, designers, tech-curious people — not just engineers. Publish at **12:00 PM JST** on launch day.

---

**Title:** `なぜ「Claude Code版Strava」を作ったのか`

**Body:**

**EN:**

> I run. And I code with AI.
>
> Both are solitary activities that feel better when measured and shared.
>
> When I started using Claude Code seriously, I noticed something familiar. The same feeling I get after a long run — "how far did I go? How does that compare to last week?" — started showing up after coding sessions. How much did that cost? Am I getting more efficient? Is anyone else spending this much?
>
> Strava answered those questions for running. Nothing answered them for Claude Code.
>
> So I built Straude.
>
> **The name** is a portmanteau — Strava + Claude. (Also sounds like "stride" if you say it right.)
>
> **The insight** is that developers who use AI coding tools daily have the same needs as endurance athletes:
> - **Tracking:** You want to know your numbers
> - **Streaks:** Consistency matters more than intensity
> - **Community:** Seeing others' efforts motivates you
> - **Progress:** Are you getting better over time?
>
> **What surprised me:** The leaderboard drives behavior more than I expected. When you see someone in your country with a 45-day streak and $2,000 in total spend, you either think "that's insane" or "I need to catch up." Both reactions keep people coming back.
>
> **What's next:** We're adding support for more AI tools (Codex is already supported), team dashboards, and regional leaderboards. Japan was one of the first countries where Claude Code went mainstream — I want to see 🇯🇵 dominate the leaderboard.
>
> Try it: straude.com

**JP:**

> 走ることと、AIでコードを書くこと。
>
> どちらも一人でやる行為だけど、記録して共有すると、もっと良くなる。
>
> Claude Codeを本格的に使い始めたとき、既視感があった。長距離を走った後に感じる「今日はどれくらい走った？先週と比べてどう？」という感覚が、コーディングセッションの後にも現れ始めた。いくらかかった？効率は上がっている？他の人もこんなに使ってる？
>
> ランニングにはStravaがあった。Claude Codeには何もなかった。
>
> だから、Straudeを作った。
>
> **名前の由来：** Strava + Claudeの造語（英語の"stride"=歩幅にも聞こえる）。
>
> **気づき：** AIコーディングツールを毎日使う開発者は、持久系アスリートと同じニーズを持っている：
> - **記録** — 自分の数字を知りたい
> - **継続** — 強度より一貫性が重要
> - **コミュニティ** — 他の人の努力を見ると、やる気が出る
> - **成長** — 時間とともに上達しているか？
>
> **想定外だったこと：** リーダーボードの行動変容効果は予想以上だった。自分の国に45日連続・累計$2,000の人がいるのを見たとき、「狂ってる」か「追いつかなきゃ」のどちらかを感じる。どちらの反応も、ユーザーを引き戻す。
>
> **今後の展開：** より多くのAIツール対応（Codexは既に対応済み）、チームダッシュボード、地域別リーダーボード。日本はClaude Codeが最も早く浸透した国の一つ——🇯🇵がリーダーボードを制覇するのを見たい。
>
> 試してみる → [straude.com](https://straude.com?utm_source=note&utm_medium=article&utm_campaign=japan-launch-2026)

---

### Step 2.7: Prepare the PR TIMES press release

PR TIMES auto-distributes to ITmedia, CodeZine, CNET Japan, and dozens of other outlets. This is how you get "free" media coverage.

**Important:** PR TIMES press releases must be in Japanese. The format is structured — follow the template exactly.

---

**Headline:**
`Claude Codeの利用コストを可視化・共有できるプラットフォーム「Straude」が日本市場に本格展開`

**Sub-headline:**
`AIコーディングツールの利用状況を「Strava」のように記録・共有。グローバルリーダーボードで世界中の開発者と競い合える無料プラットフォーム`

**Body (JP):**

> **概要**
>
> Straude（ストラウデ、https://straude.com ）は、Claude CodeおよびCodexの利用データを可視化・共有できる無料プラットフォームです。開発者はCLIコマンド1つで日次の利用状況（コスト、トークン数、使用モデル、セッション数）を記録し、グローバルリーダーボードで他の開発者と比較できます。
>
> 「アスリートのようにコードを書く」をコンセプトに、ランニングアプリ「Strava」のような利用体験を、AI駆動開発に適用しました。このたび、日本市場への本格展開を開始します。
>
> **背景**
>
> バイブコーディング（AI支援開発）が主流になる中、開発者は自身の利用パターンやコストを把握する手段を持っていません。Anthropic社のClaude CodeやOpenAI社のCodexは世界中で数十万人の開発者に日常的に使用されていますが、いずれも詳細な支出追跡やソーシャル機能を提供していません。
>
> **主な機能**
>
> ・CLIコマンド1つで日次利用データを同期：`npx straude@latest`
> ・コスト、トークン数、使用モデル、セッション数を日次で記録
> ・グローバル＆地域別リーダーボード（国別フィルター対応）
> ・デイリーコーディングストリーク（連続記録）
> ・セッション共有、コメント、リアクション機能
> ・パブリック/プライベート切り替え可能なプロフィール
>
> **日本市場展開の理由**
>
> 日本はAI開発ツールの世界で最も急速に成長している市場の一つです。ChatGPTの初期からの早期採用、バイブコーディングの主流化など、日本の開発者はAIツール活用の最前線にいます。Straudeが重視する「日々の継続」「計測」「健全な競争」は、日本のエンジニアリング文化と親和性が高いと考えています。
>
> **主要数値**
>
> ・登録ユーザー数：[X]名
> ・記録セッション数：[X]件
> ・累計AI利用コスト記録額：$[X]
> ・利用国数：[X]カ国
>
> **利用方法**
>
> 無料。straude.comでサインアップ後、`npx straude@latest` を実行するだけで利用開始できます。
>
> **お問い合わせ**
>
> [Name] — [email] — [phone]

**Body (EN, for reference):**

> Straude (https://straude.com), a platform for tracking, sharing, and competing on AI coding tool usage, announces expansion into the Japanese market. Developers track daily Claude Code and Codex usage (cost, tokens, models, sessions) with one CLI command. The platform features global and regional leaderboards, daily coding streaks, session sharing with comments and reactions, and privacy controls. Free to use.

---

### Step 2.8: Write the Connpass talk proposal

Submit this to the next Claude Code Meetup Japan event on Connpass.

---

**Title (JP):** `Claude Codeの利用データを"走行ログ"のように記録する — Straudeの設計と開発`

**Abstract (JP):**

> Claude Codeの利用状況をStravaのように記録・可視化するプラットフォーム「Straude」をどのように設計・開発したかを共有します。
>
> 取り上げるトピック：
> ・なぜ開発者に利用状況の可視化が必要なのか（コスト帰属、効率追跡）
> ・CLIがClaude Codeのローカルテレメトリデータをどう読み取るか
> ・アーキテクチャ：Next.js 16 + Supabase + Turborepo
> ・リテンションを支えるソーシャルメカニクス（ストリーク、リーダーボード、kudos）
> ・データから見えた、開発者のAIツール利用パターン
> ・ライブデモ：`npx straude@latest` からリーダーボードのランキング表示まで
>
> 対象者：Claude Code、Cursor、Codex、その他のAIコーディングツールを日常的に使っている方
>
> 発表時間：15〜20分 ＋ Q&A

**Abstract (EN, for reference):**

> How I built Straude, a platform that tracks Claude Code usage like Strava tracks running. Covers: why usage visibility matters, how the CLI reads local telemetry, architecture (Next.js 16 + Supabase + Turborepo), social mechanics (streaks, leaderboards, kudos), usage patterns from real data, and a live demo. 15-20 min + Q&A.

---

### Step 2.9: Prepare influencer DM templates

Personalize each DM before sending. Do NOT send a generic blast.

**Template (JP):**

> [name]さん、はじめまして。
>
> Straudeというツールを開発しています——Claude Code版のStravaです。CLIコマンド1つで日次のコスト、トークン数、モデル、セッション数を記録し、グローバルリーダーボードにランクインできます。
>
> [name]さんの[specific topic]に関するコンテンツをいつも拝見しており、まさにStraudeのターゲットユーザーに届く方だと感じています。
>
> もしよろしければ、早期アクセスやデモをお見せできます。セットアップは2分で完了です：
>
> ```
> npx straude@latest
> ```
>
> サイト：straude.com
>
> お試しいただけるか、取り上げていただける可能性があれば、ぜひお聞かせください。
>
> [Your name]

**Template (EN, for reference):**

> Hi [name], I built Straude — Strava for Claude Code. One CLI command tracks daily spend, tokens, models, and sessions, and puts you on a global leaderboard. I follow your content on [specific topic] and think your audience would find this useful. Happy to give early access or a demo — setup takes 2 minutes: `npx straude@latest`. Site: straude.com. Let me know if you're interested.

**Personalization checklist for each influencer:**

| Influencer | What to mention in `[specific topic]` | Platform to DM on |
|-----------|---------------------------------------|-------------------|
| 深津貴之 (@fladdict) | AI戦略、UXデザイン、noteでの発信 | X DM |
| KNR (@MacopeninSUTABA) | Qiitaでの記事、AI Toolbox、Cursor/Claudeの比較記事 | X DM |
| KEITO | YouTubeでのAIツールレビュー、ハンズオン形式のデモ | YouTube comment + X DM |
| イケハヤ (@ihayato) | バイブコーディングへのピボット、noteでの発信 | X DM |
| けんすう (@kensuu) | AIプロダクトの考察、テック起業家としての視点 | X DM |
| しまぶー (@shimabu_it) | プログラミングチュートリアル、元Yahoo Japan | X DM |
| KENTA (@and_and_and_and) | フリーランスエンジニアコミュニティ、オンラインサロン | X DM |
| あるる | AIツールのステップバイステップガイド | X DM |
| mikimiki | Web/AIツールの紹介、幅広い視聴者層 | YouTube comment + X DM |

---

### Step 2.10: Prepare community posts

For vim-jp Slack, Vibe Coding Salon Discord, and any other communities you find.

**Post (JP):**

> こんにちは——このコミュニティに役立ちそうなものを作ったので共有します。
>
> **Straude**（straude.com）は、Claude Code / Codexの利用状況をStravaのように記録するツールです。コマンド1つ：
>
> ```
> npx straude@latest
> ```
>
> 日次のコスト、トークン数、セッション数を記録し、グローバルリーダーボードにランクインできます。ストリーク（連続記録）も追跡——自分は今[X]日目で、途切れさせないよう頑張ってます。
>
> リーダーボードは国別フィルターがあるので、🇯🇵をもっと上位に押し上げたいです。
>
> 無料です。パワーユーザーの皆さんからのフィードバックをお待ちしています。

**Post (EN, for reference):**

> Hey everyone — built something this community might find useful. Straude (straude.com) tracks your Claude Code / Codex usage like Strava tracks running. One command: `npx straude@latest`. Shows daily spend, tokens, session count, and puts you on a global leaderboard. Also tracks streaks. You can filter the leaderboard by country — would love to see more 🇯🇵 on there. Free to use. Would love feedback from power users.

---

## Phase 3: Influencer Outreach (Day -5 to -3)

### Step 3.1: Send Tier 1 DMs

Send personalized DMs to these 4 people. These are the highest-leverage contacts — one RT from any of them can deliver 50-100K impressions alone.

| # | Who | Handle | Followers | DM on | Priority |
|---|-----|--------|-----------|-------|----------|
| 1 | 深津貴之 (Fukatsu) | @fladdict | ~195K | X | Highest — his endorsement legitimizes tools in Japan |
| 2 | KNR | @MacopeninSUTABA | ~50K | X | High — Qiita #1 contributor, Cursor/Claude specialist |
| 3 | KEITO | KEITO【AI&WEB ch】 | ~168K | YouTube + X | High — does hands-on tool reviews on YouTube |
| 4 | イケハヤ (Ikehaya) | @ihayato | ~300K | X | High — massive reach, pivoted to vibecoding |

**Steps for each:**
1. Follow them first (if not already following)
2. Like/retweet 2-3 of their recent posts about AI tools (genuine engagement, not spam)
3. Wait 24 hours
4. Send the personalized DM from Step 2.9
5. Log the DM date and response status in your tracking sheet

**If they don't respond within 48 hours:**
- Reply to one of their public posts with something relevant (not a pitch — add value to the conversation)
- Try again after launch with traction data ("We got X signups from Japan in the first 24 hours")

### Step 3.2: Prepare Tier 2 outreach

Draft (but don't send yet) personalized DMs for Tier 2 influencers. You'll send these on Day 1-3 when you have traction data to share.

| Who | Handle | Followers | Send on |
|-----|--------|-----------|---------|
| けんすう (Kensuu) | @kensuu | ~300K | Day 1 |
| しまぶー (Shimaboo) | @shimabu_it | ~100K | Day 2 |
| KENTA | @and_and_and_and | ~80K | Day 2 |
| あるる (Aruru) | — | ~72K | Day 2 |
| mikimiki | mikimiki web school | ~150K | Day 3 |

---

## Phase 4: Launch Day (Day 1 — Thursday)

### Step 4.1: Morning launch sequence (8:00-9:00 AM JST)

Execute these in order, within a 1-hour window:

| Time (JST) | Action | Platform | Content |
|------------|--------|----------|---------|
| 8:00 AM | Publish Qiita article | Qiita | Step 2.3 content |
| 8:15 AM | Publish Zenn article | Zenn | Step 2.4 content |
| 8:30 AM | Upload demo video | YouTube (unlisted) or direct to X | Step 2.1 video |
| 9:00 AM | Post X/Twitter launch thread | X | Step 2.5 content + attach video + screenshots |
| 9:00 AM | Publish PR TIMES release | PR TIMES | Step 2.7 content |

**Automation tip:** Pre-schedule the X thread using Typefully or OpenClaw. For Qiita and Zenn, draft the article the night before and hit "publish" manually at 8:00 AM.

### Step 4.2: Midday push (12:00 PM JST)

- [ ] Publish Note.com founder story (Step 2.6)
- [ ] Check Qiita LGTM count — if under 5, share the article link in the X thread replies
- [ ] Respond to any comments on Qiita/Zenn

### Step 4.3: Evening push (8:00 PM JST)

This is peak X/Twitter engagement time on Thursdays.

- [ ] Post a follow-up tweet with a specific data point or user reaction:

> JP:
> 朝投稿してから[X]人の開発者がStraudeに登録してくれた。
> 日本からの登録が[X]%——予想以上に多い。
> リーダーボードの🇯🇵が増えていくのを見るのが楽しい。
>
> まだの人はぜひ → straude.com

> EN: Since this morning, [X] developers signed up for Straude. [X]% from Japan — more than expected. Love watching 🇯🇵 climb the leaderboard. Try it → straude.com

- [ ] Respond to every reply on the X thread
- [ ] Check Qiita LGTMs again — need 10+ by end of day to hit daily ranking

### Step 4.4: Community posts (anytime Day 1)

- [ ] Post in vim-jp Slack (Step 2.10 content)
- [ ] Post in Vibe Coding Salon Discord (Step 2.10 content)
- [ ] If you find other active JP developer Slack/Discord communities during research, post there too

---

## Phase 5: Amplification (Day 2-3)

### Step 5.1: Engage with everything

- [ ] Reply to every comment on Qiita (authors who reply get more visibility)
- [ ] Reply to every comment on Zenn
- [ ] Reply to every X mention and quote tweet
- [ ] Like every positive mention

**Rule:** Response time under 2 hours during JST business hours. Japanese community norms value responsiveness.

### Step 5.2: Send Tier 2 DMs

Now you have real traction data. Customize each DM:

> [name]さん、はじめまして。
>
> Straudeの[Your name]です。昨日ローンチしたClaude Code版Stravaです。
>
> 初日で[X]人の開発者が登録し、QiitaのLGTMランキングに入りました。日本からの登録が[X]%と予想以上に多く、リーダーボードに🇯🇵が増えています。
>
> [name]さんの[specific topic]に関するコンテンツと相性が良いと思い、ご連絡しました。
>
> お試しいただけると嬉しいです → straude.com

### Step 5.3: Share social proof

- [ ] Screenshot any positive Qiita comments and share on X
- [ ] Screenshot the leaderboard showing Japanese users and share on X
- [ ] If any influencer posts about Straude, RT and quote tweet with thanks

---

## Phase 6: Content Wave (Day 4-5)

### Step 6.1: Publish follow-up content

Write a short Qiita article or Zenn "Scrap" with real data from the first few days:

**Title (JP):** `Straudeローンチ3日間のデータまとめ——日本の開発者はClaude Codeにいくら使っているか`

(3 days of Straude launch data — how much are Japanese developers spending on Claude Code?)

**Content ideas:**
- Average daily spend of Japanese users vs global
- Most popular models among JP users
- Streak distribution
- Top JP leaderboard positions
- Any surprising patterns

**Automation tip:** Use Claude Code to query the Supabase database for these stats. Prompt: `"Write a SQL query for daily_usage that shows average cost_usd, average total_tokens, and count of distinct users where the user's country is 'JP', grouped by date, for the last 7 days."`

### Step 6.2: Pitch media

Now you have traction data. Pitch these outlets:

| Outlet | How | What to send |
|--------|-----|-------------|
| **GIGAZINE** | ネタのタレコミ form on gigazine.net | Short pitch + link to Qiita article + traction numbers |
| **ITmedia AI+** | Email press release | PR TIMES release + "we got [X] signups in [Y] days" |
| **CodeZine** | Email | PR TIMES release + link to Zenn article |
| **Publickey** | Email | Focus on technical architecture angle |

**Email template (JP):**

> 件名：Claude Code利用データの可視化プラットフォーム「Straude」がローンチ[X]日で[Y]名の開発者が登録
>
> お世話になっております。
>
> AI駆動開発の利用状況を可視化するプラットフォーム「Straude」についてご紹介させていただきます。
>
> ローンチから[X]日で[Y]名の開発者に登録いただき、Qiitaの記事は[Z]LGTMを獲得しました。日本からの登録が全体の[X]%を占めています。
>
> 詳細：
> ・サイト：straude.com
> ・Qiita記事：[URL]
> ・PR TIMES：[URL]
>
> ご取材・ご掲載をご検討いただけますと幸いです。
>
> [Name]
> [Email]

### Step 6.3: Reach out to KEITO for YouTube review

KEITO does hands-on AI tool reviews on YouTube (~168K subscribers). A single video from him could deliver 20-50K impressions.

**Steps:**
1. Find KEITO's business email (usually in YouTube channel "About" section)
2. Send a personalized email (not a generic pitch)
3. Offer: early access, exclusive data, or a joint live stream
4. Include: traction numbers, Qiita article link, 3-sentence explanation

---

## Phase 7: Community Building (Day 6-7)

### Step 7.1: Connpass meetup

- [ ] If accepted to Claude Code Meetup Japan, prepare slides (see Step 2.8 for abstract)
- [ ] If not accepted yet, submit to the next event
- [ ] Consider hosting our own Connpass event: "Straude User Meetup — AI開発のコストと効率を語る会"

### Step 7.2: Compile Japan leaderboard

- [ ] Take a screenshot of the leaderboard filtered by Japan
- [ ] Post it on X with commentary:

> JP:
> Straude日本リーダーボード 🇯🇵（1週目）
>
> 1位：@xxx — $XX.XX / ストリーク XX日
> 2位：@xxx — $XX.XX / ストリーク XX日
> 3位：@xxx — $XX.XX / ストリーク XX日
>
> まだランクインしてない人、まだ間に合う → straude.com

### Step 7.3: Plan ongoing cadence

Set up a recurring content schedule:

| Frequency | Content | Platform |
|-----------|---------|----------|
| Weekly | 🇯🇵 leaderboard update tweet | X |
| Bi-weekly | Technical tip or usage insight | Qiita or Zenn Scrap |
| Monthly | "Japan Monthly Recap" with data | Note.com |
| Quarterly | Connpass meetup talk | Connpass |

**Automation tip:** Use OpenClaw to set up recurring reminders for each content piece. Or use Claude Code to create a cron-based notification script.

---

## Influencer Reference Table

Keep this updated as you make contact.

| Name | Handle | Platform | Followers | Status | DM Sent | Response | Notes |
|------|--------|----------|-----------|--------|---------|----------|-------|
| 深津貴之 | @fladdict | X | ~195K | Tier 1 | | | AI strategy, note CXO |
| KNR | @MacopeninSUTABA | X/Qiita | ~50K | Tier 1 | | | Qiita #1, AI Toolbox |
| KEITO | YouTube | YouTube | ~168K | Tier 1 | | | Hands-on reviews |
| イケハヤ | @ihayato | X/Note | ~300K | Tier 1 | | | Vibecoding pivot |
| けんすう | @kensuu | X | ~300K | Tier 2 | | | Tech entrepreneur |
| しまぶー | @shimabu_it | X/YT | ~100K | Tier 2 | | | Ex-Yahoo JP |
| KENTA | @and_and_and_and | X/YT | ~80K | Tier 2 | | | Engineer community |
| あるる | — | X | ~72K | Tier 2 | | | AI tutorials |
| mikimiki | YouTube | YouTube | ~150K | Tier 2 | | | Web/AI tools |

---

## Media Pitch Reference

| Outlet | Type | How to Pitch | Contact Method |
|--------|------|-------------|---------------|
| GIGAZINE | Consumer tech | ネタのタレコミ form on site | Web form |
| ITmedia AI+ | Enterprise AI | Press release email | Email |
| CodeZine | Developer news | Email press release | Email |
| Publickey | Dev tools | Email, focus on architecture | Email |
| Gihyo (技術評論社) | Tech publisher | Long-term book pitch | Email |
| PR TIMES | Distribution | Self-service publish | Dashboard |
| TechFeed | Aggregator | Submit article URLs | Web form |

---

## Impression Tracking Sheet

Copy this to a Google Sheet and update daily:

| Day | Qiita Views | Qiita LGTMs | Zenn Views | X Impressions | Note Views | PR TIMES Pickups | YouTube Views | Community Clicks | Total Est. Impressions | JP Signups | CLI Installs |
|-----|------------|-------------|------------|--------------|------------|-----------------|--------------|-----------------|----------------------|-----------|-------------|
| 1 | | | | | | | | | | | |
| 2 | | | | | | | | | | | |
| 3 | | | | | | | | | | | |
| 4 | | | | | | | | | | | |
| 5 | | | | | | | | | | | |
| 6 | | | | | | | | | | | |
| 7 | | | | | | | | | | | |
| **Total** | | | | | | | | | | | |

---

## Product Localization Suggestions

**DO NOT IMPLEMENT YET** — these are suggestions for the engineering team to prioritize before launch.

### Must-Have Before Launch

1. **JPY currency display** — Show ¥720 instead of $4.82. Japanese devs think in yen. Store in USD, display in preferred currency. This is the single biggest "feels local" signal.

2. **Japan in leaderboard country filter** — Make sure 🇯🇵 is a prominent option, not buried in a dropdown.

3. **Timezone handling** — Verify streak calculations work correctly for JST (Asia/Tokyo). A user who codes at 11:55 PM JST should not lose their streak because the server thinks it's the next day in UTC.

### Nice-to-Have Before Launch

4. **Japanese OG images** — For join/referral pages of users with `country: 'JP'`, generate OG images with Japanese text. E.g., 「@username は今週 ¥2,700 使った。ついて来れるか？」

5. **Landing page in Japanese** — Even a basic `/ja` route with translated hero + CTA would help. Key copy:
   - "Code like an athlete" → 「アスリートのようにコードを書け」
   - "Track your Claude Code spend" → 「Claude Codeの利用コストを可視化」
   - "Compete with friends" → 「仲間と競い合おう」
   - "Share your breakthrough sessions" → 「突破の瞬間を共有しよう」
   - "Ready to run?" → 「さあ、走り出そう」
   - Feature: "Track Spend" → 「コスト可視化」
   - Feature: "Compare Pace" → 「ペース比較」
   - Feature: "Keep Streaks" → 「連続記録」
   - Feature: "Share Progress" → 「成長共有」

6. **CLI locale detection** — Detect `LANG=ja_JP` and show Japanese strings in CLI output. Key strings:
   - "code like an athlete" → 「アスリートのようにコードを書け」
   - "today" → 「今日」
   - "this week" → 「今週」
   - "streak" → 「ストリーク」(katakana is fine, devs know this word)
   - "rank" → 「ランク」

### Post-Launch Backlog

7. **i18n framework** — Add `next-intl`. Start with landing page + onboarding. Don't translate the entire app yet.

8. **Regional leaderboard page** — Dedicated `/leaderboard/jp` with Japanese UI.

9. **"Share to Qiita" button** — Auto-generate a Qiita-formatted markdown snippet of session stats. This turns every user into a distribution channel.

10. **Japanese onboarding flow** — Translate the 3-step setup. Add Japan-specific social proof.

11. **Connpass event integration** — Link to community events from the app.

### Things NOT to Localize

- Username/handle system — keep ASCII
- Currency storage — always USD in DB
- API responses — keep English
- Technical terms — Claude Code, Codex, tokens, CLI stay in English
- Brand name — "Straude" stays as-is (ストラウデ in katakana when needed)

---

## Success Criteria

After 7 days, evaluate against these targets:

| Metric | Target | Stretch |
|--------|--------|---------|
| Total impressions (all platforms) | 200K | 500K |
| Qiita LGTMs | 50 | 200 |
| New JP signups | 100 | 300 |
| CLI installs from JP | 200 | 500 |
| JP users on leaderboard | 20 | 50 |
| Influencer mentions | 3 | 8 |
| Media pickups | 2 | 5 |
| X followers gained | 500 | 2,000 |

**If we hit 200K impressions but <50 signups**, the content resonated but the conversion funnel has friction — check if the landing page needs Japanese copy, if the CLI install instructions are clear, or if there's a signup blocker.

**If we hit <100K impressions but >100 signups**, the content didn't spread wide but converted well — double down on community posts and influencer outreach to increase top-of-funnel.
