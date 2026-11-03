# LMS visual refresh · 3 November 2026

The signed-in teacher, student and parent workspaces use `dist/lms-skin.css`.
The public website and Ink Note editor keep their existing layouts. The palette
uses navy type, mint primary actions, pale paper surfaces and restrained lavender.

Students open a course in their dashboard, choose a lesson and see preparation,
the live lesson/notebook link, and homework. Published summaries and personal
feedback appear below. Phones use a compact lesson chooser. Existing quiz and
notebook APIs still handle learning content and permissions.

Teachers can switch the Today dashboard between Essentials (next class, classes,
review links and master notebooks) and Extended (also upcoming lessons and unit
timelines). The selection is stored on the device in
`inkwire.teacher.workspace.v1`. All class tools remain available in both layouts.

“Unit timeline” measures scheduled, non-cancelled lessons whose end time has
passed. It is not an assessment, attendance statistic or learning-mastery score.
Undated lessons remain in the total but cannot count as elapsed. Parent views do
not offer quiz submission controls; server permissions remain authoritative.

## Restore points

- `backup/lms-before-visual-refresh-20261103`: previous live source.
- `backup/lms-visual-working-pass-20261103`: initial complete skin and workspaces.
- `backup/lms-visual-verified-20261103`: reviewed version with responsive and
  read-only refinements.

Local source archives and review screenshots are in the sibling folder
`../lms-restore-points/`. GitHub also retains the previous live commit on branch
`backup/lms-before-visual-refresh-20261103`. These checkpoints contain application
source, not copies of student records, uploaded PDFs, or production credentials.
No database migration or student-data rewrite is part of this release.

To inspect a restore point safely, create a separate worktree at its tag rather
than resetting a checkout with uncommitted work. A production rollback should
restore its source through a new reviewed commit on the current main branch,
keeping later unrelated changes and all production records intact.

Validation: 146 tests pass; production build succeeds. Browser checks cover
Essentials/Extended persistence, teacher preparation and compact overview, student
lesson switching, the existing quiz dialog, published feedback and notebook URLs,
parent reading controls, and phone/laptop layouts using fictional local data.
