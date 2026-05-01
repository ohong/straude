# Strava-Inspired Shareability Loop

Straude should treat each coding session the way Strava treats a run or ride: an activity is not just a log row, it is a social object with status, proof, comparison, and a next action.

## What Strava Users Share

Based on Strava's public growth mechanics and the Latterly strategy write-up:

- **Progress made visible**: routes, segment PRs, streaks, goals, and annual recaps turn private effort into a visible milestone.
- **Social recognition**: kudos, comments, clubs, and leaderboards make the activity feel witnessed.
- **Identity signaling**: sharing says "I am the kind of person who trains consistently," not just "I exercised."
- **Friendly rivalry**: segments and leaderboards create natural challenges without requiring users to write copy.
- **Fresh content loops**: every uploaded activity can become feed content, social content, club content, challenge progress, and lifecycle email content.

The useful growth-loop framing from Kevin Kwok's Figma analysis is that durable companies sequence loops. For Straude, the individual activity loop should feed the public proof-of-work loop, which should feed the referral loop.

## Applied To Straude

Straude already has the raw activity object: daily usage with spend, output tokens, models, screenshots, kudos, comments, and profile identity. The missing layer is packaging those facts into repeatable "why this is worth sharing" moments.

### Shipped In This Branch

**Share moments** package every post with a Strava-like share angle:

- Output PR: seven-figure output days.
- Big Build Day: high-spend verified sessions.
- Toolkit Flex: multi-model sessions.
- Receipts Attached: posts with screenshots.
- Community Pull: posts already receiving kudos/comments.
- Build Log: the default proof-of-work moment.

Each moment now appears in:

- Feed activity cards, so users see which part of the session is socially interesting.
- The share panel, so the card has a ready-made angle before choosing a theme or channel.
- Generated share text, so X/native shares carry challenge-oriented copy.
- A direct invite-link action, so a broadcast share can also become a friend/referral loop.

Loop:

```text
Code with AI -> push to Straude -> share moment appears ->
  user shares proof/invite -> non-user sees comparable artifact ->
    joins through /join/[username] -> pushes their own session
```

## Next Feature Ideas

- **Milestone share prompts**: after earning an achievement or breaking an output/spend personal record, open the share panel with that moment preselected.
- **Challenge replies**: add a "Beat this session" link that creates a lightweight challenge page between two users.
- **Weekly club-style recaps**: summarize followed users' biggest output PRs and invite the viewer to catch up.
- **Share conversion dashboard**: track view -> signup -> first push by surface: post card, recap, profile, invite, CLI scorecard.
- **Team segments**: private org leaderboards that make teams feel like Strava clubs.
