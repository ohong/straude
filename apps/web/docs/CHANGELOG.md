# Changelog

All notable changes to the Straude web app.

## Unreleased

### Added

- Shareable screenshot cards for posts — branded 1080x1080 PNG images with 3 theme variants (Light, Dark, Accent) that users can copy to clipboard or download
- `ShareMenu` dropdown on activity feed posts replacing the inline "Copy Link" button, with theme toggle, Copy Link, Copy Image, and Download PNG actions
- `/api/posts/[id]/share-image` API route for server-side image generation via Satori
