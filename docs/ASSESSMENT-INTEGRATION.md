# Assessment and EDUCADE reuse

The teacher header and teacher notebook header link to `/teacher?view=assessment`. The workspace uses the signed-in teacher's existing class, roster and timeline APIs. It brings together first-submission quiz accuracy and published teacher lesson assessments, with links to notebooks and the existing timeline for feedback editing. The existing server enforces teacher membership. No new assessment storage or database migration is required by this release.

## Imported source

Imported with Matthew Gilfillan's authorization from `MatthewGilfillan/EDUCADE`:

- `public/teacher-data.js` at development commit `1a49552d1d76d4d3d9f973369454331b0fe7ba7c`: 53 groups, 134 Grade 5 English skills and 17 partial CCSS candidate mappings. Original EDUCADE skill IDs, reference URLs, checked dates and candidate statuses are retained in `dist/assessment-catalogue.mjs`.
- `public/teacher-curriculum.js` at feature/adaptive-reading-curriculum-dashboard commit `9bf1dd2f8caf791ca2ea63e1486bd3fccec20c02`: framework metadata and candidate links, materialized against those same skill IDs in `dist/assessment-curricula.mjs`. CCSS has 17 links, England 18, Australia 27 and Cambridge Primary 27. These describe partial or thematic connections, not a complete standards database.
- `public/teacher-standards.js` at the development commit above: Beginning, Approaching, Meeting and Exceeding descriptions, retained in `dist/assessment-model.mjs` as reference descriptors. No demo achievement levels were imported or inferred from scores.

Fictional students, scores, practice responses, reading levels and browser-local teacher judgments were excluded. England is labelled National Curriculum for England, rather than a universal British curriculum. Cambridge Primary English (0058) is not IGCSE. An IGCSE catalogue was not found in the inspected source branches and has not been invented.

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
