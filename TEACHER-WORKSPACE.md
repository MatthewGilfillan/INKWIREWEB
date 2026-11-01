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
