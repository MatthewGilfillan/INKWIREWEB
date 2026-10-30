# Ink Wire Learning Studio

Landing page and interactive learning-studio prototype for Ink Wire Education.

## Run
Serve the dist directory with any static server, for example:
`python3 -m http.server 8000 --directory dist`

## Included
- Responsive landing page with Ink Wire branding, supplied photography, program information, teacher introduction, FAQs, and an email-enquiry draft form
- Simple email/password sign-in and account-creation design previews, plus the email-activation screen
- Separate student, teacher, and parent dashboard previews
- Responsive student dashboard and 12-week / 24-lesson editable course timeline
- An Inspector Calls / Lord of the Flies curriculum and Lesson 1 preparation quiz with scoring, explanations, retries, and a discussion question
- Weekly notebooks with four sections and browser-local autosave
- Teacher assessment forms for three fictional students, organized by week
- Student feedback showing success and next-step notes
- Parent portal with weekly plans, preparation readiness, attendance/homework summaries, filterable lesson feedback, read markers, and email drafts
- Parent reports include attitude and effort/focus observations; teacher-only notes are omitted from the displayed report
- Placeholder for an individually assigned Zoom link

## Scope and data
This is a workflow prototype, not a production student information system.
All records are fictional and stored only in localStorage on the current browser.
Student/teacher/parent navigation is a demo switch, not authorization. Secure sign-in and automatic account-role routing are not connected.
The enquiry form opens a draft in the visitor's email app; it does not submit or send messages from the site.
No real student information, secrets, or meeting links belong in this repository.
The notebook uses Tiptap rich text with browser-local persistence. Liveblocks collaboration is not connected yet.
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

Tiptap + Liveblocks is the agreed live notebook architecture: https://liveblocks.io/docs/products/sync/text-editing/tiptap. This release implements Tiptap only. It does not claim cross-device sync, simultaneous editing, cloud backup, comments, or version history. Multiple tabs editing the same page are not a collaborative session.

Connect Liveblocks only after authenticated accounts and enrollment authorization exist. Use a stable room per enrollment/lesson, separate document fields for Discussion/Writing/Reflection/Homework, and server-issued room access restricted to the assigned learner and teacher. Keep private teacher assessments outside shared documents. Add the Liveblocks collaboration extension and disable StarterKit's local undo/redo when collaboration owns history. Migrate local drafts once into authorized rooms; do not initialize the cloud document repeatedly on page mounts. Configure secrets server-side, never in this repository. Test access isolation and concurrent edits before using real student work.
