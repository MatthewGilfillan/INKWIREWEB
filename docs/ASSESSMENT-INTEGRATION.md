# Assessment and EDUCADE reuse

The teacher header and teacher notebook header link to `/teacher?view=assessment`. The workspace uses the signed-in teacher's existing class, roster and timeline APIs. It brings together first-submission quiz accuracy and published teacher lesson assessments, with links to notebooks and the existing timeline for feedback editing. The existing server enforces teacher membership. No new assessment storage or database migration is required by this release.

## Imported source

Imported with Matthew Gilfillan's authorization from `MatthewGilfillan/EDUCADE`:

- `public/teacher-data.js` at development commit `1a49552d1d76d4d3d9f973369454331b0fe7ba7c`: 53 groups, 134 Grade 5 English skills and 17 partial CCSS candidate mappings. Original EDUCADE skill IDs, reference URLs, checked dates and candidate statuses are retained in `dist/assessment-catalogue.mjs`.
- `public/teacher-curriculum.js` at feature/adaptive-reading-curriculum-dashboard commit `9bf1dd2f8caf791ca2ea63e1486bd3fccec20c02`: framework metadata and candidate links, materialized against those same skill IDs in `dist/assessment-curricula.mjs`. CCSS has 17 links, England 18, Australia 27 and Cambridge Primary 27. These describe partial or thematic connections, not a complete standards database.
- `public/teacher-standards.js` at the development commit above: Beginning, Approaching, Meeting and Exceeding descriptions, retained in `dist/assessment-model.mjs` as reference descriptors. No demo achievement levels were imported or inferred from scores.

Fictional fixtures are now available only through the explicitly labelled EDUCADE demo class choices. No sample teacher attainment judgments or reading levels are inferred. England is labelled National Curriculum for England, rather than a universal British curriculum. Cambridge Primary English (0058) is not IGCSE. The new standards registry adds separately researched reference packs; these are distinct from the older prototype mappings.

The class comparison layout and chart helpers in `dist/educade-assessment-view.js` adapt the actual EDUCADE `public/teacher.js` and profile axes from `public/teacher-data.js` at the development commit above. The default view uses one bold Class label and adjacent selector, truthful evidence counts, subject tabs, search/sort/portrait controls, progress bars, heatmap and standards views. Full student pages retain the existing quiz and lesson assessment details. No duplicate dashboard title, repeated class name or hamburger menu is included.

## Course standards and reference packs

`dist/standards-registry.mjs` contains 16 versioned reference packs: CCSS ELA, England English, Oxford Writing Criterion Scale, Alberta K–6 ELA, Cambridge Primary and Lower Secondary English, GCSE English Language and Literature, Cambridge IGCSE 0500 and 0475, AP Literature, IB PYP, MYP Language and Literature, DP Literature, DP Language and Literature, and IPC. Each pack lists its scope, edition and official source links. These are concise reference summaries, not exhaustive official databases or licensed rubric reproductions. Oxford's complete school checklist is not copied.

New class setup asks for a main framework and scope, with an explicit Decide later choice. Teachers can add up to four frameworks and school rubric notes. Existing courses remain compatible and can add standards through their course settings. The existing validated course JSON persists the settings; teacher timeline projection includes them, while student and parent projections exclude school rubric notes and enduring understanding targets.

PYP and IPC default to the school-defined B, B+, D, D+, M, M+ scale. Knowledge and Skills are assessed separately. Understanding remains a qualitative evidence profile connected to planned enduring understandings; it is not a calculated grade. The plus levels do not claim to be official IB or IPC descriptors.

The catalogue browser supports curriculum choice, skill-area filtering, search and individual mapping references. It is available independently of whether a class already has evidence. Current lesson ratings and quiz results do not contain EDUCADE skill IDs; the workspace does not automatically assign them to standards or claim standards mastery. Teacher achievement recording against skills is a later server-backed feature, not a browser-local substitute.

## Future game connection

`validateGameEvidence` in `dist/assessment-model.mjs` defines the initial versioned event envelope shared by future game adapters:

```json
{
  "version": 1,
  "sourceId": "viking-quest",
  "eventId": "unique-response-id",
  "activityId": "rising-tide",
  "classId": "ink-wire-class-id",
  "learnerId": "ink-wire-learner-id",
  "skillId": "EDU.G5.READING.COMPREHENSION.INFERENCE.01",
  "score": 1,
  "total": 1,
  "support": "independent",
  "attempt": 1,
  "occurredAt": "2026-11-03T09:00:00Z"
}
```

Stable skill IDs travel with responses; curriculum mappings stay in a separately versioned registry. The adapter preserves source, activity, attempts, support and timestamps, and rejects curriculum codes in place of skill IDs. Practice accuracy must remain separate from teacher achievement judgments.

This release contains the catalogue and validator, not a public game ingestion endpoint. Before enabling a game, add authenticated producer registration, server-side class/learner authorization, an idempotent unique `(sourceId,eventId)` store, and response-level evidence retrieval. Never trust client-supplied learner identity or achievement levels. A game-specific adapter can then translate its results into this shared envelope without rebuilding the LMS or renaming existing skill IDs.

## Validation and restore

The assessment tests cover learner isolation, absence/missing evidence, first-attempt weighting, unique preserved IDs, partial curriculum provenance, and invalid game events. Browser verification uses a local read-only fixture with fictional learners, then the live signed-in website without editing student work.

Restore checkpoint before Assessment: local `backup/lms-navigation-verified-20261103`, source commit `855dc33`, published commit `791f4b213201cbfea2616c45269eefd3cce13d54`. Archives are outside the release checkout in `work/lms-restore-points`.

## Fictional EDUCADE classes

`dist/educade-demo-data.mjs` preserves the complete original fictional fixture from `public/teacher-data.js` at development commit `1a49552d1d76d4d3d9f973369454331b0fe7ba7c`; only the global wrapper becomes an ES module. It contains nine fictional learners in Classes 5A (six) and 5B (three), with 540 responses per learner across four weeks. `dist/assessment-demo.mjs` adapts these into the existing assessment view without changing the original skill response accuracy.

The fixture is lazy-loaded when a demo is selected from the Class dropdown, or through `/teacher?view=assessment&demo=1`. Class and learner IDs are namespaced `demo-educade-`. They do not enter enrollment, profile, notebook or feedback APIs and create no accounts, invitations or database records. Selecting a real class removes the demo query, and normal class selection remains the default. A demo banner identifies every sample view; individual profiles are labelled Fictional learner. Initially Standards progress remained Not reviewed; the later owner-requested provisional B–M+ display is described below.

Progress bars use SVG width attributes instead of inline style attributes, preserving the live site's strict content security policy. Tests verify original roster membership, namespaced identities, source-equivalent domain percentages, known skill IDs and populated chart markup.

## Account-owned demo classes across the LMS

The initial Assessment-only fixture is now an explicit preview, available through the demo URL rather than automatically listed for all teachers. Its Add demo classes to my workspace action calls authenticated POST `/api/classes/demo-educade` with `{version:1}`. Ownership comes exclusively from the verified session; callers cannot select another account. Merely viewing Classes, Assessment or Notebooks never installs data.

The installer atomically creates two normal classes, nine disconnected fictional learner slots, two eight-lesson course plans and nine editable reading journal pages using the existing schema and Yjs state format. It creates no invitations, student logins or parent connections. Stable per-owner IDs and reserved class request IDs make retries safe. Reinstalling preserves edited plans and pages, removed roster members and Trash state. The owner’s regular Classes, Today, course overview, timeline, calendar and notebooks all use these same stored class IDs and normal access rules. Other teacher accounts receive no class membership.

The class list supplies a demoKey for installed fixtures. After the normal teacher class-access check, the teacher timeline maps the original EDUCADE practice records to the stored learner IDs and filters against the current roster. Families never receive that class-wide fixture. Tests verify ownership, cross-account denial, idempotence, current roster filtering, calendar projection and readable starter notebook pages. No database migration is needed.

## Student profile navigation

Student names in Assessment and the regular class roster open the full student page under the existing teacher header. The URL identifies the class and learner: `/teacher?view=assessment&class=<class-id>&learner=<learner-id>`. Profiles support direct loading, refresh, browser Back/Forward, Back to class and switching learners. They do not create dialogs or overlays.

`dist/educade-student-view.js` adapts EDUCADE's `renderProfile`, learning-area axes, cumulative four-week progress and Glows & Grows patterns from the same development source commit. Reading Foundations and Literacy retain separate evidence. The page includes chart choices, subject navigation, current support counts, inline responses, the skill catalogue, lesson feedback and a notebook link. Its relative strengths and next practice areas come from recorded accuracy; they do not assign standards attainment. No unsupported report-generation or grouping controls are included.


## Inline class evidence

The class table adapts EDUCADE's independent learner-row and subject-column expansion. Show learning evidence toggles summaries in that row without changing the route; student names and score buttons retain full profile navigation. Expanded areas show actual correct/attempt counts, hint and support counts, encountered skills and nested, scrollable response histories. Unassessed areas remain No evidence yet. Native details retain their open state across class-table rerenders. Class changes reset expansion, and row toggles preserve focus and the table scroll position.


## Provisional B–M+ percentage estimates

At the owner's request, Standards progress now displays a provisional conversion of recorded practice accuracy in both class and student views: B 0–39%, B+ 40–54%, D 55–69%, D+ 70–79%, M 80–89%, M+ 90–100%. The shared conversion uses the same rounded percentage as the progress bars. Missing evidence remains ungraded. Labels and a visible band key identify these as estimates; this display conversion does not write curriculum judgments, overwrite course standards or assign an understanding grade. Thresholds live in `dist/assessment-progress-scale.mjs` for later refinement.


## LMS appearance

`lms-theme.js` applies an explicit browser preference before first paint and mounts the same accessible Dark mode switch next to the account menu in teacher, student, parent and notebook headers. Light is the default. The choice is saved only on a toggle, survives navigation/reload, synchronizes through storage events and degrades to page-only state when storage is unavailable. No profile or classroom data is written. `lms-theme.css` supplies the navy screen palette, dark glass header, assessment/chart/grade surfaces, forms and notebook chrome. Notebook paper and print colours remain unchanged. Header labels use Dashboard in both teacher and notebook navigation.


## Calendar and header updates

The calendar uses a single Month/Agenda toggle and a month/year title between
previous/next arrows. It renders successive months, fetching each month's grid
separately within the existing 62-day API limit. Scrolling preloads another month;
a Show next month button remains available to keyboard users and browsers without
IntersectionObserver. Class filtering applies across loaded months. The class selector sits next to the
month navigation; the view toggle is on the right. The calendar hides the redundant
page heading and Create class action.

`display-time-zone.mjs` uses the device's IANA timezone by default. A verified
account may save a personal override under My account. Preferences are private
objects in the existing R2 binding, addressed exclusively by the session user ID.
This requires no schema migration. Lesson source timezones and wall-clock schedule
values are unchanged: a lesson at 18:00 Beijing displays at 17:00 Bangkok.
User-facing labels lead with the current GMT offset, for example GMT+7 · Bangkok
and GMT+8 · Beijing; the stored value remains an IANA identifier.

The shared header places the fixed sun/moon switch before an accessible notification
bell and the avatar. The bell lists actual submitted quizzes from current class
rosters plus current cancelled lessons for authorized teachers. It does not create
fictional submission alerts or expose teacher plans to families. Notification read
IDs are account-owned R2 preferences; opening a notification links to the relevant
course lesson. Cancellation dates in the feed identify the schedule's latest update,
and read status is keyed to the cancelled lesson. Homework tracking and persistent
notification event history remain future producers.

Course overview is the first class workspace tab and the default when entering
Classes from the header or Dashboard. Explicit lesson, timeline and student
links keep their own destinations. The shared header gutter matches the inner
1376px page container and responsive page padding.
