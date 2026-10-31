# PDF worksheets

The **PDF worksheet** tab adds a locked PDF background and separately editable annotation layers to the existing collaborative document editor. This implementation is confined to the editor experiment. It does not enable worksheets in the production classroom dashboards or connect them to Ink Wire accounts.

## Working with a worksheet

1. Open the editor and choose **PDF worksheet**. A local draft is saved in that browser.
2. Import an unlocked PDF up to 15 MiB and 100 pages. Pages appear in a vertical sequence; their backgrounds cannot be moved or erased by the annotation tools.
3. Choose **Type** and click a page to place text or emoji. In the text editor, select words to apply different fonts, custom sizes (8–96), bold, italic, underline, strikethrough, text colours, highlights, alignment, bullets and numbered lists. Use Indent/Outdent for list items. Select a placed text box and choose **Edit / format text**, or double-click it, to revise its content and formatting. Drag its lower-right corner handle to change its width, or enter an exact width in the editor. Keyboard users can focus a page with the Type tool selected and press Enter.
4. Draw with **Pen**, **Highlight**, **Arrow**, **Rectangle**, or **Ellipse**. Pen input records pressure when the device supplies it. Mouse input uses a fixed pressure. Finger drawing is opt-in; use **Scroll** for touch scrolling. Browser/device palm rejection varies; this is not a guarantee of hardware-level palm rejection.
5. Use **Lasso** to select a group, then drag it with **Select / move**. **Erase stroke** removes whole annotations on your own visible layer. Delete selected items, or use Undo/Redo. Selected annotations also support arrow-key movement, Delete, and Escape.
6. Toggle student answers and teacher feedback independently. Zoom and page navigation change the display, while annotations stay anchored to their PDF page.
7. **Export marked PDF** includes the currently visible layers. The export is flattened into page images, including Unicode text and emoji. It is suitable for viewing/printing; PDF text search and editable PDF annotation objects are not preserved.
8. **Save editable copy** downloads a `.inkwire.json` file containing the original PDF and annotation records. **Open editable copy** restores it in a local draft. Keep this file to continue editing outside the original browser. It can contain student work; share it with the same care as the notebook itself.

Replacing a PDF starts blank annotation layers. The UI asks before replacement and offers an editable-copy export. If another device replaces a PDF while offline edits are pending, the pending records are retained in a **Recover previous annotations** JSON download instead of being applied to the wrong worksheet. That recovery JSON contains annotation metadata and coordinates, not the replaced PDF itself.

## Shared access

Choose **New shared document** using the existing administrator creation key, then use **Share**:

| Link | Permissions |
| --- | --- |
| Teacher | Import/replace PDFs; add and change teacher feedback; edit the rich-text document |
| Student | Add and change the student answer layer; edit the rich-text document |
| Read-only | View the PDF, both annotation layers, and rich-text document; export copies |

The server determines roles from independently hashed capability keys and rejects cross-layer mutations and read-only writes. Changing a browser variable or submitted `layer` field cannot grant another role. Each document has one teacher capability and one student capability; people sharing a capability share that layer. Undo history is local to a browser session, not a global undo of another participant's work.

These are bearer links, not account invitations. They do not identify an individual learner, enforce class membership, revoke a previously distributed link, or restrict parents to published feedback. A read-only link shows both layers, including drafts. Do not treat the read-only link as the final parent publishing workflow. Complete the account integration in `INKWIRE-INTEGRATION.md` before real classroom use. The experiment never connects to the production database.

## Saving and concurrency

- PDF bytes live separately from annotations in the document's SQLite-backed Durable Object. They are transferred over authenticated HTTP and stored in bounded chunks, rather than inside the 1 MiB Yjs document.
- Annotation operations are validated against a fixed schema and the connection's role. Revisions reject conflicting edits to the same annotation; tombstones prevent stale offline edits from resurrecting deleted work. Retrying a recently acknowledged operation is idempotent.
- The server persists an accepted operation before acknowledging it. Other connected browsers receive the accepted record.
- A browser-local IndexedDB database stores the PDF, annotations, and queued operations. Shared caches are scoped to the document and a hash of its capability. Raw capability keys are not saved in this cache. The browser retains recovery data until site data is cleared.
- Offline edits are queued before transmission and replayed after reconnecting. The UI reports unsent changes. Reloading the app itself while completely offline requires it to be available in the browser cache; there is no service worker or offline app-shell guarantee.
- Limits: 15 MiB/PDF, 100 pages, 4,000 annotation records including tombstones, 2 MiB encoded annotation records, 2,048 points/stroke, 20,000 characters/text box, 30 connected browsers/document. The original rich-text state limit remains 1 MiB. The latest 2,000 operation receipts are retained.
- Offscreen pages release their canvas buffers and render when near the viewport. Each active canvas is capped at four million pixels. PDF.js, its worker, fonts, CMaps and WASM assets are bundled locally; no PDF upload to a third-party renderer is needed.

## Validation

With Node.js 22+ and pnpm installed:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test:unit
```

Start the actual local Cloudflare Worker in another terminal (synthetic key, local data only):

```sh
pnpm exec wrangler dev --port 8787 --inspector-port 9232 --var OWNER_KEY:local-development-test
```

Then run the original collaboration suite and worksheet server tests:

```sh
pnpm test
```

For browser verification, install Chromium with `pnpm exec playwright install chromium`, then run `pnpm test:browser`. Alternatively, use an installed Google Chrome with `PLAYWRIGHT_CHROME_CHANNEL=chrome pnpm test:browser`. Tests use isolated browser contexts and synthetic PDFs; they do not open personal browser profiles or access production.

The browser suite exercises import, typed feedback and emoji, pen/highlight/shapes, lasso movement, stroke erasing, Undo/Redo, teacher/student/viewer access, concurrent editing, offline reconnection, reload recovery, zoom, flattened export (including a rotated page), editable-copy restoration and narrow-screen layout.

Text tests also cover mixed formatting within one text box, resizing via its handle, rich-text document formatting, read-only formatting controls, serialization of nested lists and highlights, and rejected unsafe style values. PDF bytes and an acknowledged annotation were independently checked across a stopped-and-restarted local Cloudflare runtime.

## Source map

- `src/worksheet.js`: controls, collaboration queue, PDF rendering, local recovery and export.
- `src/worksheet-model.js`: shared validation, role policy and page-relative geometry.
- `src/worksheet-render.js`: common canvas drawing for the screen and PDF export.
- `src/worksheet-cache.js`: IndexedDB recovery; the PDF is written only when it changes.
- `src/text-formatting.js`: shared controls for the document and worksheet text editors.
- `src/rich-text.js`: restricted rich-text serialization, fonts and validation.
- `worker/worksheet.js`: PDF storage, role lookup, validated operations and durable receipts.
- `scripts/pdf-assets.mjs`: copies PDF.js support assets before dev/build.

This is an original browser implementation using PDF.js and pdf-lib. No OneNote source code or bundled assets are included.

## Paste, submission and feedback

Paste with Cmd/Ctrl+V into the document or a text box. Pasting onto a focused PDF page stages a text box for review. The Paste controls preserve supported text formatting; Paste without formatting inserts plain text. If clipboard reading is blocked, a keyboard-paste field is offered. Basic lists, fonts, colours, emphasis and alignment are supported; scripts, remote images and embedded objects are removed. Tables are flattened into text, not imported as editable tables.

**Add to worksheet** and **Update text** save draft annotations. **Submit work** hands in the entire document and worksheet, records the server submission time, stores a separate text/annotation snapshot and locks student edits. The teacher can save a private general feedback draft, then **Return feedback** to publish that comment and reopen student editing. Teacher ink/text annotations remain shared live; only the general feedback draft is private. Up to 20 submission attempts are retained, each with its time and late status.

The teacher can set an optional homework deadline in Bangkok time (UTC+7). Late work is always accepted and labelled **Submitted late**, with a note that teacher feedback before class is not guaranteed. A submission exactly at the deadline is on time. Extending or clearing the deadline updates the current attempt’s late label without changing its submission time; earlier attempts retain their recorded status. This standalone notebook workflow is not yet connected to account-based classroom assignments.

Server and browser suites also exercise submission locks, private feedback redaction, return/resubmission, deadlines, late acceptance, supported external paste, plain paste and denied-clipboard fallback.
