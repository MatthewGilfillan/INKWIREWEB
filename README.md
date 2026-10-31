# Ink Wire Learning Studio

Landing page and interactive learning-studio prototype for Ink Wire Education.

For the separate public Cloudflare deployment at **inkwire-education.com**, see [CLOUDFLARE.md](CLOUDFLARE.md). Hosting is being prepared first; email services and real student accounts are deferred.

## Run
Serve the dist directory with any static server, for example:
`python3 -m http.server 8000 --directory dist`

## Included
- Responsive landing page with Ink Wire branding, supplied photography, program information, teacher introduction, FAQs, and an email-enquiry draft form
- Simple email/password sign-in and account-creation design previews, plus the email-activation screen
- Separate student, teacher, and parent dashboard previews
- Responsive student dashboard and 12-week / 24-lesson editable course timeline
- An Inspector Calls / Lord of the Flies curriculum and Lesson 1 preparation quiz with scoring, explanations, retries, and a discussion question
- Weekly notebooks with four sections, browser-local autosave, and an opt-in Liveblocks shared development demo
- Teacher assessment forms for three fictional students, organized by week
- Student feedback showing success and next-step notes
- Parent portal with weekly plans, preparation readiness, attendance/homework summaries, filterable lesson feedback, read markers, and email drafts
- Parent reports include attitude and effort/focus observations; teacher-only notes are omitted from the displayed report
- Placeholder for an individually assigned Zoom link

## Scope and data
This is a workflow prototype, not a production student information system.
All records are fictional. Assessments, preparation, and Browser notes use localStorage. Opt-in Shared demo notebook text is sent to and stored by the connected Liveblocks development project.
Student/teacher/parent navigation is a demo switch, not authorization. Secure sign-in and automatic account-role routing are not connected.
The enquiry form opens a draft in the visitor's email app; it does not submit or send messages from the site.
No real student information, secrets, or meeting links belong in this repository.
The notebook uses Tiptap rich text. Browser notes remain local; the separate Shared demo connects student and teacher editing through Liveblocks.
The sample schedule is illustrative and does not send reminders or enforce quiz release windows.
The reading plan is editable sample content, not a finalized teaching unit.

## Next implementation phase
Add authenticated student, teacher, and parent accounts with server-enforced roles, a relational database for enrollments/lessons/submissions/assessments, individual Zoom-link configuration, timezone-aware scheduling, and a collaborative editor with revision history.
Store private teacher notes on the server with teacher-only access. Add export/backup, retention settings, and a tested permission model before real students use it.

## Source
Public GitHub source: https://github.com/MatthewGilfillan/INKWIREWEB
Sites hosting uses a separate managed source remote. Keep the GitHub source and deployment source synchronized for future edits.


## Agreed account flow
1. Create account with email and password only.
2. Send a verification email containing an expiring, single-use activation link.
3. Require email verification before granting dashboard access.
4. Returning users sign in with email and password. Route them by their server-assigned role; users must not be able to grant themselves teacher access.
5. Provide resend-verification and password-reset links in the connected service.

The current UI is a design preview: email/password fields and submit buttons are disabled, and the activation screen explicitly states that nothing has been sent. No credentials are collected, stored, or transmitted. The dashboard preview links remain demo navigation. Production account creation, verification email delivery, password reset, sessions, and server-enforced access require a connected authentication service and compatible hosting; none is configured in this static Sites preview.

## Optional teacher portrait
The supplied personal photo is held in the private Site source and deployment only. The public GitHub repository excludes `dist/assets/matthew-gilfillan.png`; the teacher card displays the existing Ink Wire logo if that optional asset is absent.

## Parent portal
Open `studio.html?role=parent`. The sidebar contains Overview, Weekly plan, Progress & feedback, and Contact Matthew.

- **Sample journey** shows a fictional learner with four example lesson reviews and an explicitly illustrative 12-week schedule.
- **Saved demo work** uses Alex Lee’s reading status, quiz submissions, edited lesson plans, and assessments from the existing demo workspaces in this browser. No existing work is overwritten by sample data.
- The weekly plan covers all 24 lessons with goals, preparation reading, and follow-up assignments. The time-zone selector defaults to Beijing / Shanghai (Asia/Shanghai, UTC+8) and converts the sample session times. Saved demo work has no confirmed schedule or Zoom link.
- Homework and attendance summaries use only recorded, applicable observations. Missing observations remain “Not recorded.”
- Read markers persist separately in this browser, and changed family-visible feedback becomes unread again. Read markers are not sent to the teacher.
- Contact opens an email draft to `matthew@inkwire.online`, optionally with lesson context. It does not send email from the site.
- The teacher form now records attendance and attitude alongside the existing homework, preparation, participation, effort/focus, and learning-goal observations. Open parent tabs reflect saved demo changes.

Parent-facing records use an explicit field list excluding private teacher notes and other learners. This is display filtering in a static prototype, **not a security boundary**: the browser-local demo storage is not suitable for real student records. Production requires server-enforced guardian/student relationships and separate teacher-only storage before the portal is used with families.

### Checks
Run `node --test tests/parent.test.cjs` for parent record projection, privacy omissions, progress denominators, preparation isolation, read-marker invalidation, sample/saved separation, and sample time-zone conversion.

## Student studio
Open `studio.html?role=student`. The expanded workspace has Overview, Course timeline, Reading & tasks, My notebook, Preparation quiz, and My feedback.

- All 24 lessons have a focus selector, goals, reading before/after class, and individual reading checklists. Follow-up reading updates the next lesson's preparation; parent saved-work views use the same records. Existing Lesson 1 reading work remains compatible.
- Readiness counts only assigned preparation items. The working sample quiz is Lesson 1 only; other lessons explicitly say that no quiz is assigned. Completion counts regardless of quiz score.
- Optional written homework can be set by the teacher. The student's checklist is a self-report, not a submission or teacher grade.
- The notebook has lesson pages and Discussion, Writing, Reflection, and Homework sections; it uses Tiptap with bold, italic, underline, headings, lists, quotations, and undo/redo. It autosaves locally, remembers the selected page, counts words, and downloads only the current fictional learner's notebook as plain text.
- Teacher reviews show a recap, success, next step, and recorded observations, filtered to this learner. Reviews saved in another tab update the overview and feedback; open notebook and quiz drafts are left intact.
- Illustrative lesson times use Beijing / Shanghai (Asia/Shanghai, UTC+8). Dates are samples, and no live Zoom link is connected.

## Manual transcript preview
The teacher form includes a `.vtt` / `.txt` file picker (2 MB maximum), a readable transcript preview, and removal. Files stay only in the current tab's memory, scoped to the selected fictional learner and lesson. Reloading clears them. No raw transcript is saved in localStorage, uploaded, or displayed in student/parent views. File contents are escaped as text.

The teacher can write and save a reviewed lesson recap using the new shared assessment field. The **Generate draft** button is disabled because no OpenAI API connection exists. Future generation should run on the server with a protected API key, use the lesson plan plus transcript, produce evidence-grounded summaries/targets, and require teacher review before sharing. Zoom integration, real student records, recording consent, authenticated uploads, and API billing are not implemented by this prototype.

Run `node --test tests/*.test.cjs` for preparation isolation, legacy compatibility, family projection, export boundaries, and transcript input validation.

## Notebook editor and Liveblocks
Run `npm ci` and `npm run build` to rebuild the self-contained Tiptap bundle from `src/notebook-editor.js`. The committed bundle runs without a third-party CDN. Existing plain-text notes are converted to document nodes without interpreting HTML. Rich-text JSON is saved alongside a text mirror for counts and plain-text downloads.

Tiptap + Liveblocks is the agreed live notebook architecture: https://liveblocks.io/docs/products/sync/text-editing/tiptap. The **Shared demo** mode now uses `@liveblocks/client`, `@liveblocks/yjs`, and Tiptap Collaboration/CollaborationCaret. It supports simultaneous rich-text edits, remote cursors, participant counts, and explicit saving/connection states. The Yjs provider owns undo/redo in this mode; StarterKit history is disabled.

Open either notebook and select **Shared demo**, then **Open teacher/student view** to open the same lesson and section. Each fictional enrollment lesson has a stable room, with separate Yjs fields for Discussion, Writing, Reflection, and Homework. The four sections share lesson presence. The configuration accepts only the fictional Alex Lee demo; room naming is not an access-control mechanism. Shared pages start empty and never import local notes, assessments, or transcripts. Switching back to Browser notes preserves the existing local rich-text documents. Shared downloads contain the current page only; local notebook exports contain local pages only. Shared work does not feed the browser-local dashboard note count.

`src/liveblocks-config.mjs` contains the supplied **public development key**, intended for client use. It is not a secret. Anyone with this public project key can access development rooms; the private Site gate does not secure those rooms against direct API access. Use fictional practice text only. Do not use this mode for real student records. Configure the Liveblocks project's allowed domains for the intended preview/deployed hosts if domain restrictions are enabled. No secret key belongs in the client or this repository.

Editing waits for the shared document to load and pauses when disconnected. Liveblocks warns on closing the tab with unsynchronized changes, and internal navigation waits for pending changes. Keep the page open during reconnecting; download the current page if needed. Offline editing/recovery after forcibly closing the tab is not supported. Destroying an editor removes listeners and leaves its room using the provider's documented lifecycle.

Before using with real students: connect verified accounts, replace `publicApiKey` with a server authentication endpoint, validate assigned learner/teacher enrollment on the server, and enforce room permissions. Restrict linked parents to intended reports or read-only content. Keep private teacher notes outside shared documents. Migrate local drafts only after authorization, with a one-time migration marker. Test unauthorized access, concurrent edits, reconnection and durable storage. Comments, version history, account authentication, and parent notebook access are not implemented.

## Compact classroom navigation

The teacher dashboard opens with expandable active classes. Assessment forms are available under `#assessment`; transcript import, preparation and lesson settings expand on demand. The shared course timeline in all three workspaces uses twelve wide downward-arrow week blocks. The illustrative schedule now begins October 30, 2026 at 18:00 Asia/Shanghai, with two 90-minute lessons each week; these dates are not confirmed bookings.

Past scheduled lessons are muted and show the saved class recap and assignment status. A recorded presence marks a lesson completed; rescheduled records are labeled separately. Missing observations are displayed as unrecorded. Reading and homework checklists remain distinguishable from teacher assessments, and student/parent projections exclude private notes and other learners. Lesson settings accept optional HTTPS meeting links. All account/record limitations described above still apply. Liveblocks text comments, reusable feedback snippets, and freehand drawing are not implemented by this navigation update.

## Signed-in teacher course planner

The authenticated teacher dashboard now includes a reusable course overview builder with 15-week, weekly 120-minute Rivendell presets, editable lesson plans, outline paste, course copying and class-scoped D1 draft storage. See [COURSE-PLANNING.md](COURSE-PLANNING.md) for the workflow, migration and checks. This is separate from the static demonstration timeline described above.
