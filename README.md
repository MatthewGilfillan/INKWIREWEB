# Ink Wire Learning Studio

Landing page and interactive learning-studio prototype for Ink Wire Education.

## Run
Serve the dist directory with any static server, for example:
`python3 -m http.server 8000 --directory dist`

## Included
- Responsive landing page with Ink Wire branding, supplied photography, program information, teacher introduction, FAQs, and an email-enquiry draft form
- Sign-in entry with separate student, teacher, and parent dashboard previews
- Responsive student dashboard and 12-week / 24-lesson editable course timeline
- An Inspector Calls / Lord of the Flies curriculum and Lesson 1 preparation quiz with scoring, explanations, retries, and a discussion question
- Weekly notebooks with four sections and browser-local autosave
- Teacher assessment forms for three fictional students, organized by week
- Student feedback showing success and next-step notes
- Parent overview of preparation, reading, and teacher feedback, excluding private teacher notes from the displayed report
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

