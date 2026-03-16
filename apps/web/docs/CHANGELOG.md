# Changelog

All notable changes to the Straude web app.

## Unreleased

### Added

- Public `/consistency/[username]` profile share page with a 52-week heatmap-first consistency card
- `/api/consistency/[username]/image` for downloadable / previewable profile consistency PNGs
- Inline profile share panel under Contributions with visible URL, preview, and PNG actions
- Inline post share panel on `/post/[id]` with visible permalink and generated image preview
- Shareable screenshot cards for posts — branded 1080x1080 PNG images with 3 theme variants (Light, Dark, Accent) that users can copy to clipboard or download
- `ShareMenu` dropdown on activity feed posts replacing the inline "Copy Link" button, with theme toggle, Copy Link, Copy Image, and Download PNG actions
- `/api/posts/[id]/share-image` API route for server-side image generation via Satori

### Changed

- Post share images now use a session-first card layout tuned for social reposting instead of the previous generic promo-style card
