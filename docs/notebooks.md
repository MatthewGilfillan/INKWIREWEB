# Folio notebook hub

The teacher master view, class Notebooks tab, student dashboard and linked parent dashboard open one notebook per `(class_id, learner_id)`. Sections and pages have stable IDs. Changing views changes access, never creates another notebook copy.

The hub has four columns: Notebooks → Sections → Pages → Contents. Teachers can search/filter students, add sections and pages, and move pages. Drop one PDF anywhere in the notebook, including over an existing printout, or select “Add a PDF printout”. Choose a locked-background printout (the default) or a downloadable file attachment, review the title and select “Insert printout”; the PDF uploads into the current section and opens immediately without leaving the notebook. PDF entries reference existing worksheet IDs, original files and learner annotation layers. Text pages support rich text and pasted headings/lists, editable font families (including Calibri where installed), 8–96 point font sizes, text colors and highlight colors. Unavailable fonts use a browser fallback. Ink and positioned text are available over locked PDF printouts; free-positioned ink over ordinary rich-text pages is not implemented.

## Shared content and access

All content in this shared student notebook is visible to its student, assigned teachers and currently linked parents. Keep private teacher notes in the existing separate teacher-only assessment storage. Parents have a live read-only view, including new PDF annotations. The separate Worksheets “Share with parent” workflow still publishes immutable snapshots; the notebook view does not require that publication step.

Every API request verifies the website session and current class membership/guardian link. Parents cannot write even by making API requests directly. An account switch interrupts saving until the notebook is reloaded. No separate Folio or Microsoft sign-in is used.

## Synchronization and recovery

Rich-text pages use Yjs to merge concurrent edits. The server validates document shape and formatting, stores CRDT state plus a JSON projection in D1, and uses version-checked retries to prevent overwriting concurrent edits. Visible pages poll every two seconds; this is polling, not a WebSocket/presence service. PDF annotations retain their existing per-object ownership and version-conflict checks.

Text edits are also saved to IndexedDB under the signed-in user, notebook and page IDs before transmission. Saving is acknowledged only after the server responds. Reopening the same page/account merges the recovery draft. Pending edits block internal navigation and warn before closing; JSON draft download is available. Browser storage can be cleared or unavailable, so this is recovery support rather than a full offline guarantee. PDF recovery remains limited to the current tab and a draft download. Draft import, notebook history and storage cleanup remain future work.

Current server limits: 50 custom sections, 500 explicitly stored page records, 100,000 text characters / 5,000 document nodes per text page, 800 KB CRDT state per page and 4 MB CRDT state per notebook. PDF limits are documented in [PDF worksheets](pdf-worksheets.md).

## Deployment

Run `npm test && npm run build`. Apply `cloudflare/migrations/0014_notebooks.sql` and `0015_pdf_attachment_mode.sql` after earlier migrations before deploying the account Worker. R2 is activated and the private PDF bucket exists; see [PDF worksheets](pdf-worksheets.md). The Cloudflare build pipeline applies migrations before deployment. The static Sites deployment does not run this account Worker or apply D1 migrations.

For the hosted practice workspace, open `/notebooks.html?preview=1`. Teacher, student and parent links share fictional records through this browser's IndexedDB; they do not sync across devices or upload practice data to Cloudflare. Practice mode is disabled on `inkwire-education.com` and its www host. Dashboard links for real accounts use `/notebooks` with class/notebook IDs; the Worker protects that route and its aliases.

Automated checks cover session-protected routes, membership revocation, parent read-only access, concurrent teacher/student merges, live parent PDF reads, stable PDF references, malformed formatting, notebook limits and cross-origin write rejection.
