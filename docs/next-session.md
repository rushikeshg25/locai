# Browser-only chat checkpoint

Paused at the user's request after five of ten commits, starting from `7bf24b9`.

Completed:

1. Preserve review fixes: protected terms/custom instructions, stale attachment isolation, consistent runtime cache configuration.
2. Remove the local-server provider and its source, controls and tests.
3. Replace server-based browser tests with a browser-worker fixture. This tests interactions, not real model quality.
4. Add browser-only onboarding and conversation starters.
5. Add searchable desktop conversation navigation; retain the narrow-screen conversation selector.

Proposed remaining five commits, to resume only when requested:

6. Preserve unsent drafts and attachments per conversation when switching chats.
7. Add conversation renaming with opt-in persistence and accessible controls.
8. Improve partial-download cleanup and cache/connection status without promising offline readiness from weights alone.
9. Attempt real WebGPU chat, stop/retry and offline inference checks on a supported browser; record actual results and blockers.
10. Complete regression checks, update setup/evaluation documentation and review the browser-only release.

Known limits: switching chats still clears unsent drafts; automated WebGPU inference is unverified; the small model is a provisional download-size choice. Real inference and quality checks remain explicit opt-ins. No deployment or new push is included in this checkpoint.
