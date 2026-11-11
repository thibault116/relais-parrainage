<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Member release announcements
For every member-visible feature or fix, update `lib/member-release.ts` with a new unique id and brief French notes describing only the changes since the previous member release. Keep the notes short (at most four bullets). Never include admin-only changes. Admin-only deployments must keep the member release id unchanged. Keep any tutorial link relevant to that release. Verify acknowledgement hides the dialog across reloads and a new release id shows it again.

## Beta-first feature releases
All NEW member-facing features must start in beta, per the user's instruction. Keep existing public features public (including Community). Register new keys in lib/feature-release.ts with status beta; unknown keys default to beta. Gate UI with useFeature and server endpoints/actions with canUseFeature(authenticatedUser.id, key), in addition to all existing role, ownership, and admin checks. Never trust a client beta flag. Beta opt-in is account-scoped, off by default, and reversible. Promote a feature to stable only after validation and an explicit release decision; do not claim perfection or automatically promote after compilation. Include tests for normal users, beta users, and opt-out. Beta feedback is reserved for opted-in accounts and remains private to administrators. Keep member release notes accurate about availability; do not announce beta-only functions as public.

## Discord member announcements
The owner-only Discord generator reads the version id and French notes from lib/member-release.ts across production commits. Keep the simple data-only double-quoted string format. Never put admin-only, infrastructure or private changes in those notes. Do not enable automatic Discord publishing or use the real webhook for tests without explicit user authorization. scripts/test-discord-changelog.ts only uses a local fake Discord server.
