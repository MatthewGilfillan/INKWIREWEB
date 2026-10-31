# Folio: collaborative document editor for Cloudflare

A portable starter using Tiptap, Yjs, a Cloudflare Worker and one SQLite-backed Durable Object per document. It does not use code from WPS Office.

Included: rich text, headings, lists, links, quotes, undo/redo, live shared editing, connected-user count, durable server saving, browser offline recovery, editing links, iframe embedding, plain-text import, HTML export and browser print/PDF.

Shared notebooks also support student submission, private general feedback drafts, teacher return/resubmission, optional deadlines with late acceptance, and supported rich-text or plain-text paste. These are capability-based experiment workflows, not authenticated classroom assignments.

The **PDF worksheet** tab now supports locked PDF pages, free-positioned text and emoji, pressure-aware pen strokes, highlighting, arrows and shapes, lasso selection/movement, whole-stroke erasing, local undo/redo, separate teacher/student layers, role-enforced sharing, offline annotation recovery, flattened PDF export and editable worksheet copies. See [WORKSHEETS.md](WORKSHEETS.md) for the workflow, tests and integration limits.

## Run locally

Requires Node.js 22+ and pnpm 11.25.0 (or a compatible version).

```sh
pnpm install
pnpm build
```

Create `.dev.vars` with `OWNER_KEY="a-long-random-local-creation-key"`, then:

```sh
pnpm preview
```

Open http://localhost:8787. The initial sample is a local-only draft. Choose **New shared document**, enter your creation key, then choose **Share**. Open that link in another browser to edit together. For source hot reload, run `pnpm dev` in another terminal; it proxies API requests to the Worker on port 8787.

The creation key belongs only to the administrator. It is submitted to your Worker and never saved by the application. Never put it in the source code, iframe or GitHub repository. Document editing links contain a separate random capability in the URL fragment.

## Deploy on your Cloudflare account

```sh
pnpm exec wrangler login
pnpm exec wrangler secret put OWNER_KEY
pnpm deploy
```

The deployment command builds the client and deploys the Worker, static assets and Durable Object binding declared in `wrangler.jsonc`. Use your own Worker name and route. Deployment has NOT been performed on your account. GitHub automation and integration with your existing site require your repository and authentication design.

If your main site uses Cloudflare Pages, deploy this as a separate Worker, optionally on an editor subdomain, then embed it. If it already uses Workers, integrate the routes and binding into that existing configuration after inspecting it; do not overwrite its configuration wholesale.

## Embed

After creating a shared document, click **Embed** for the complete iframe code. Its URL has this shape:

```html
<iframe
  src="https://YOUR-EDITOR-DOMAIN/?doc=DOCUMENT-ID&embed=1#key=DOCUMENT-EDITING-KEY"
  title="Shared document"
  style="width:100%;height:850px;border:0"
  allow="clipboard-write"
></iframe>
```

Anyone who can see a link or iframe source receives that link's access. Teacher and student links permit rich-text editing; read-only links do not. Worksheet teacher/student layer permissions are enforced separately on the server. For members-only documents, replace capability authorization with your website's signed, document-scoped authorization. Account roles, revocation, comment threads, cursor labels, revision history and DOCX import/export are not implemented. A public page containing an editing iframe grants editing access to its visitors.

## Architecture

- `src/app.js`: Tiptap editor, Yjs document, IndexedDB recovery, WebSocket client and toolbar.
- `worker/index.js`: administrator-authorized creation, document-key validation, live updates and SQLite snapshots.
- `wrangler.jsonc`: static assets, Durable Object binding and initial migration.
- `tests/collaboration.test.js`: integration tests against a running local Worker.

The browser holds a Yjs document. Updates merge in the Durable Object, which persists the merged state before acknowledging a save. On reconnect, server and client exchange state so offline edits are retained. No external collaboration service is required. Cloudflare usage may incur charges under your account's plan.

Starter limits: 30 connections per document and 1 MiB encoded document state. The server validates each update against a fresh in-memory document and stores a complete snapshot; optimize this before use with large documents or high traffic. No automatic deletion, key rotation or backups UI is provided. Configure those and your site access controls for production.

## Verification

The production browser build passed. Local integration tests passed for authorization, concurrent edits converging, new-client state recovery, offline edits merging after reconnection and document isolation. These tests use raw Yjs clients and the actual local Cloudflare runtime, not mocks.

Run against a local Worker:

```sh
TEST_OWNER_KEY='your-local-creation-key' pnpm test
```

The test creates test documents in the local database. It does not access production.

## Primary documentation

- https://tiptap.dev/docs/editor/extensions/functionality/collaboration
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/durable-objects/
