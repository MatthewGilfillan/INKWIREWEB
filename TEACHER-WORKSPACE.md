# Teacher class workspace

Each class has inline Students, Course overview, Calendar and Timeline tabs. Changing tabs preserves the current unsaved course draft. Changing classes asks before discarding changes and waits for an in-flight save or AI suggestion.

The roster endpoint returns published attendance only (present / recorded lessons), linked-account status, and the learner's courses accessible to the current teacher. Missing attendance is unknown, not absent. The live class system does not yet have class-linked homework submission records; the table explicitly shows “Not tracked yet.” Demo parent previews are distinct from connected parent accounts.

Published lesson reports in the teacher timeline include named student assessment cards with attendance and all four star ratings. The timeline refreshes when the teacher closes a newly published or corrected report. Only the teacher endpoint includes the full assessment list; family endpoints remain scoped to their own child. New reports retain student display names for historical assessments, with current-roster names used for older reports.

## Scheduling

Course JSON optionally carries `endDate`, `weeklySlots` (weekday 0–6, local `startTime`, `lessonMinutes`) and `skippedSlots` (`YYYY-MM-DD|HH:mm`). The date checklist includes both endpoints. Without an end date it proposes the required number of lessons. Applying the checklist requires exactly one selected date per existing lesson, preserves lesson identifiers and teaching content, and maps the content onto the selected dates. Crossed-out dates are calendar gaps, not deleted lesson content.

Each lesson can override its time/duration, record its original date/time in `rescheduledFrom`, and be `scheduled` or `cancelled`. Cancelled lessons remain visible but cannot accept new feedback. Published feedback locks the recorded lesson date/time and prevents cancellation, including an atomic save guard against concurrent publication. Default course times remain compatible with older course JSON. Calendar and server feedback unlocks use the individual lesson overrides.

## Billing

`billingMode` is `none`, `monthly` or `packs`. `billTo` is optional teacher-only client text. Eight-lesson pack numbers follow scheduled dates/times. A cancellation is excluded unless `chargeCancelled` is true; rescheduling never duplicates a lesson. The eighth lesson carries a renewal reminder. These are schedule-derived labels, not payment or purchased-credit balances.

Monthly totals and CSV exports show scheduled billable hours, including explicitly chargeable cancellations. They must be reviewed against delivered lessons before invoicing. No invoices, payments, or client messages are sent. The family projection includes pack labels but excludes private billing-client names and monthly billing information. Teachers can see billing labels in the course, calendar and timeline.

## Pre-lesson quiz scores

Teachers assign a short multiple-choice quiz from each lesson's Timeline entry. Students take it through their signed-in course timeline; an optional reflection is unscored. The server calculates one point per correct answer and saves attempts against the learner, class and stable lesson ID. Learning scores use the actual question total, never game points or a fixed denominator.

The timeline shows the latest score and percentage, best score and attempt count, with distinct Not assigned, Not submitted and In progress states. Zero is a submitted score. Before the class recap is published, teachers see quiz preparation by student; afterwards scores appear in the same cards as the four assessment ratings. Parents and students receive only the linked learner's results. Existing browser-demo answers are not imported into real accounts.

Migration `0009_lesson_quizzes.sql` stores definitions and attempts. Definitions support 1–20 questions with 2–4 choices and optional explanations. The answer key locks atomically when the first attempt starts, keeping every attempt comparable. Each learner can complete up to 20 attempts; a partial attempt is resumed instead of duplicated. Resubmitting the same attempt cannot change or duplicate its score. Questions and correct answers are revealed for review only after submission. Lessons with quizzes retain their IDs when rescheduled and cannot be replaced accidentally. Cancelled lessons preserve old results and reject new submissions.


## AI quiz resources and drafts

Teachers can upload a book or chapter excerpts, unit plans, and supporting files under Course overview → Resources & AI quizzes, or in the lesson quiz editor. PDF, DOC/DOCX, CSV, XLS/XLSX, TXT and VTT are accepted (20 MiB per file, eight files / 40 MiB per course). Files are privately uploaded to OpenAI Files with purpose `user_data`; only course teachers can list or remove their metadata. Provider file IDs and source files are never returned to families. Removal deletes the provider file before removing its record. Soft-deleted classes retain their resources for restoration. No secrets or file bodies are logged.

The Responses API receives saved course resources, the target lesson's title/section/goals/reading/homework and the teacher's brief. It uses the existing configured model and `store:false`, strict JSON output, server validation, and a separate bounded quota (40 upload/generation requests per teacher, 160 site-wide per UTC day). Course generation works in batches of five, persists completed batches and skips assigned quizzes and existing drafts. Individual lesson generation can replace a private draft. In-flight jobs are locked per class and duplicate successful requests replay their result. Source hints are model suggestions for teacher verification, not independently verified citations.

Spreadsheet inputs read the first 1,000 rows per sheet. Word/spreadsheet embedded images are not read; use PDF for diagrams or scanned content. Large books may exceed model context even within file-size limits; the UI recommends chapter excerpts. Errors preserve the teacher's entries and assigned quizzes.

Migration `0010_quiz_assistant.sql` adds private course resources, quiz drafts and generation-job locks. Drafts are not quizzes: student and parent timelines show no draft content or answer keys. Teachers review sources, edit questions/answers and choose Save & assign quiz. Assignment checks the draft, course and quiz revisions; started quizzes retain their answer key.

Summary & Feedback offers a checked option to draft the next scheduled lesson's quiz when publishing a transcript. The existing recap request includes the next lesson's learning context and returns a separately validated private quiz draft. No extra model request is made, no raw transcript is stored, and recap publication does not depend on valid quiz output. It chooses the next chronological, non-cancelled lesson (outline order only when the current lesson has no date). Automatic generation never replaces an assigned quiz or existing draft. The teacher timeline labels private suggestions Review AI draft. Replaying publication does not generate another quiz.

Validation: actual handlers against SQLite migrations cover upload formats/access, server-side draft validation, privacy, stale/concurrent edits, lock protection, replay, and transcript-to-next-lesson drafting. The browser test uploads resources, creates course drafts, reviews/edits/assigns one, verifies failure recovery and mobile fit. Provider responses are mocked in automated tests; live API verification is recorded separately in release proof.
