# PDF worksheets

## Teacher workflow

Open a class in the teacher dashboard, choose **Worksheets**, and upload a PDF.
Select a student copy to add text, pen or highlighter feedback. Double-click your
text to edit it; select its move or resize handle to reposition it. Students can
edit only their own annotations. The original PDF is locked.

**Share with parent** saves a read-only snapshot for that learner's linked
parents. Later edits stay in the classroom until the teacher shares again.
**Print / save PDF** prepares all pages with visible annotations for the browser's
print dialog. Print export is flattened; editable annotations stay on the site.

The Text tool is selected initially and remains selected after adding text. Text boxes keep move and resize handles in Text mode. Text supports plain-text paste, emojis, editable fonts, 8–96 font sizes, color, background highlight, bold, italic and underline. The feedback menu
offers editable starter phrases. Handwriting recognition, pressure-sensitive ink,
image stickers, rich-text paste and a custom saved-feedback bank are not included.

## Cloudflare deployment gate

R2 was activated by the account owner on November 1, 2026. The Standard bucket
`inkwire-worksheets` exists with public access disabled. The existing Cloudflare
build deploy command applies D1 migrations before publishing the Worker.

Run `npm test && npm run build` before publishing. Keep the bucket private and
retain its `WORKSHEETS` binding in `wrangler.jsonc`. Test with a non-sensitive PDF.

The existing build command bundles PDF.js and copies its worker, fonts, CMaps,
WASM decoders and license into `dist/pdf/`. These generated assets are ignored by
Git but included in the deployed static-assets directory. PDF.js loads only on
the worksheet page; landing-page payloads are unchanged.

## Storage and access

- D1 stores worksheet metadata, learner revisions, versioned annotation objects,
  and publication pointers. R2 stores original PDFs and immutable snapshots.
- Verified sessions and current class/learner membership are checked on every
  API request, including file downloads. Parent access also requires a published
  snapshot and a current parent–learner link.
- Each annotation has a server-assigned owner and teacher/student layer. Updates
  compare the version and reject stale writes; modifying someone else's object
  is forbidden. Deletions are tombstones so undo/redo can restore owned objects.
- The initial implementation polls every two seconds while visible, every twelve
  seconds while hidden. It is online shared editing, not an offline notebook.
- Unsaved changes remain in the current tab during connection failure. A warning
  prevents accidental navigation, with a JSON recovery download. There is no
  automatic recovery import yet. Conflicts require review and reload.
- Limits: 10 MiB / 60 pages per PDF; 2,000 annotation objects and about 1.5 MB of
  serialized annotation data per learner copy. Deleted objects count toward this
  limit. Upload and publication actions are rate-limited.
- Old published snapshots remain private. A deliberate retention/cleanup policy
  is future work; do not use an age-based bucket lifecycle that could delete a
  currently published snapshot or original PDF.

## Safe local practice

On the private Sites preview, open `/worksheets.html?preview=1`. This uses a
fictional classroom and this browser's IndexedDB. The role picker lets you test
teacher, student and parent views across tabs without real accounts or email.
Practice uploads and annotations do not reach Cloudflare or other devices.
The practice adapter is disabled on `inkwire-education.com` and its `www` host;
the production Worker also requires sign-in before serving the page.

Backend tests use real SQLite migrations with an in-memory private R2 stand-in.
They cover concurrent upload retries, membership isolation, separate learner
copies, annotation ownership, version conflicts, undo tombstones, immutable
parent publication, revoked access, PDF/input limits and CSRF rejection.
