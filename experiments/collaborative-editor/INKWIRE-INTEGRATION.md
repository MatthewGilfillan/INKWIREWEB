# Ink Wire editor handoff

## Recovered snapshot

Recovered from `folio-cloudflare.zip` on 2026-10-31. The archive contains a standalone Tiptap/Yjs editor backed by Cloudflare Durable Objects, not WPS Office code. It does not contain the other workspace's Git history.

The original source is preserved under `experiments/collaborative-editor/` on `codex/collaborative-editor-experiment`. This is an isolated experiment. No production routes, database migrations, authentication behavior, or deployment configuration have been changed. Generated `dist/`, dependencies, local test storage, and secrets are excluded.

## Independent verification

- `pnpm install --frozen-lockfile` succeeded using Node 24.22.1 and pnpm 11.25.0.
- `pnpm build` succeeded. All three generated files matched the supplied archive byte for byte.
- `pnpm test` passed against the actual local Cloudflare runtime with a synthetic local creation key. Its single integration test covers unauthorized creation, concurrent updates converging, shared titles, state recovery by a new client, offline updates merging after reconnection, incorrect document keys, and room isolation.
- This test uses raw Yjs clients. It does not verify browser interactions, clipboard fidelity, a runtime restart, production behavior, or account-based classroom permissions.
- The local runtime required an explicit inspector port and the server and test client to run within the same execution environment. These are review-environment details, not changes to the source.
- Vite reported a 527.87 kB JavaScript chunk (168.90 kB gzip). Load the editor only when opening a notebook; do not add it to the landing page bundle.

## Required classroom integration

1. Associate document records with a class, lesson or notebook page, and (for individual work) a learner. Use stable server-issued document IDs.
2. Authorize document creation and every connection through Ink Wire's verified account session and actual class membership. Replace the standalone owner-key prompt and permanent editing links. A role selected in the browser is not an access grant.
3. Enforce permissions on the server: class teachers may edit assigned classroom documents, students may access only their permitted documents, and linked parents receive only the published work or feedback intended for them. Parent views must not receive an editing credential.
4. Scope browser recovery data to the signed-in user and document. Define logout, account switching, revocation, and deletion behavior. The starter's document-only IndexedDB cache and offline editing state are not sufficient for a shared classroom device.
5. Connect notebook pages to the existing dashboards and timeline. Keep private drafts separate from published feedback. Validate collaboration, denied access, revocation, durable recovery after restart, and parent read-only behavior before enabling real student use.

## Features still to add

The PDF worksheet experiment now includes drawing/ink, free-positioned text and emoji, highlighting/shapes, lasso movement, erasing, teacher/student annotation layers, server-enforced capability roles, offline recovery and flattened PDF export. See `WORKSHEETS.md`. These features remain isolated from production notebook pages and verified classroom accounts.

Threaded teacher comments, reusable feedback snippets, image and table workflows in rich-text documents, named collaborator cursors, revision history, DOCX import/export, and lifecycle controls still need development. Rich-text import remains plain text; its export remains HTML or browser print/PDF. Worksheet editable-copy import/export is separate.

The starter permits 30 connections per document and a 1 MiB encoded Yjs state. It writes a full snapshot for each update. Review these limits and storage behavior before expanding usage.

Worksheet PDFs and annotation records are stored outside that Yjs state. The worksheet limits and permission model are documented in `WORKSHEETS.md`; capability roles do not replace the account/class/learner authorization requirements above.

AI-generated unit plans, quizzes, summaries, and feedback are separate future integrations. This snapshot makes no OpenAI calls.
