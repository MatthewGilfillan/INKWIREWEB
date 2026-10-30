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
The notebook is plain text; shared live editing is not implemented.
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
