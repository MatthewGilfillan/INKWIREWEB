# Teacher planning assistant

The course overview builder can draft a complete course (up to 30 lessons) or activities for one selected lesson. Teachers enter a brief, review the generated suggestion, choose **Use suggestion in draft**, edit it, then save through the existing revision-checked course API. Generating never saves or publishes a course. Activity mode only changes activities, skills and evidence of learning. Dates, timetable, section labels and source references are preserved in both modes.

## Connect production

1. Use an OpenAI API project with billing/credits and access to `gpt-6-sol` (or configure another compatible Responses model). API project availability must be checked in the actual account.
2. In Cloudflare, open **Workers & Pages → inkwire-education → Settings → Runtime variables and secrets → Production → Add variable**. Choose **Secret**, name it `OPENAI_API_KEY`, and enter the key there. Never paste it into chat, a browser-side settings form, a Git file, or a build variable.
3. The committed configuration uses `OPENAI_PLANNING_ENABLED=true` and `OPENAI_PLANNING_MODEL=gpt-6-sol`. Without the secret, the assistant reports that it is not connected; manual planning remains available. Set `OPENAI_PLANNING_ENABLED=false` in the production configuration to disable generation.
4. Deploy the branch after applying `0007_ai_planning_limits.sql`. The existing Cloudflare production command applies pending D1 migrations before deploying. Retain the existing account secret, email binding and database binding.
5. Sign in as a teacher, open a class course overview and expand **Plan with AI**. Use a short fictional brief to verify course and activity generation, preview, discard, apply and save. No real API call is made by the automated tests.

For local work, copy the example into an ignored `.dev.vars` at the repository root. Use a development API project. Requests are sent server-side to `https://api.openai.com/v1/responses` using a strict JSON schema and `store:false`. The default model uses low reasoning effort. Generation has a 90-second server timeout; the browser waits up to 100 seconds. There are no automatic provider retries.

## Access, data and usage

- The endpoint is `/api/classes/:id/planning-assistant`. Verified teachers must own or belong to the active class. POST requests require the application origin. Class access is checked again after generation.
- Only a projection of course content, the selected lesson(s), and the teacher's explicit brief go to OpenAI. Account identifiers, roster records, organisation, timetable, dates and private source notes are excluded. Information manually pasted into the brief is included. The interface explains this before generation.
- Draft suggestions are not written to D1. Teachers save accepted content explicitly through the existing course API. Request-limit rows contain counters only and expire after at most two days. The application does not log prompts, responses or keys. `store:false` disables Responses application-state storage; it does not promise zero provider retention. See OpenAI's data-controls documentation.
- Limits: 5 attempted generations per teacher per UTC day, at least 60 seconds apart, plus 30 attempted generations shared across the site per UTC day. Counters reserve before contacting OpenAI, including requests that subsequently fail. An exhausted shared counter can consume a teacher's attempt. Atomic database increments enforce the caps across worker instances. These are request caps, not exact currency budgets.
- Input: at most 12,000 brief characters, existing course validation and a 145,000-byte request ceiling. Output: at most 16,000 tokens for a course or 4,500 for a lesson, including model reasoning. Provider refusal, incomplete output, malformed JSON, unexpected lesson order/count and field/size violations leave the draft unchanged. Full-course generation is limited to 30 lessons; a longer course can use individual activity suggestions.
- Preview uses escaped plain text. AI suggestions are drafts requiring teacher checks of facts, timings, text-specific references, age suitability and source rights. No browsing, file retrieval, external tools, grading, or student-facing AI is enabled.

Official documentation: [Responses text generation](https://developers.openai.com/api/docs/guides/text), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-6 Sol](https://developers.openai.com/api/docs/models/gpt-6-sol), [API key management](https://developers.openai.com/api/docs/guides/production-best-practices), [Data controls](https://developers.openai.com/api/docs/guides/your-data).

## Live transcript-summary test

The teacher dashboard's **Summarise a transcript** action calls `/api/teacher/transcript-summary` for a verified teacher. It sends a complete UTF-8 `.txt` or `.vtt` file (30 bytes–512 KiB) as a base64 `input_file` in the Responses API request, alongside summary instructions. It uses the existing server secret and shares the planning request limits. No transcript, summary or class record is stored by this endpoint. The teacher can download the returned summary and provider metadata. Output is rendered as text with safe bold headings and emphasis, without timestamps; no provider HTML is executed. Input file upload happens only after the teacher chooses **Generate class summary**.

Summary requests use `store:false`, low reasoning effort, at most 5,000 output tokens and a 90-second timeout. Prompts ask for a grounded class summary, grounded descriptions of assigned homework, omission of learner names and personal check-ins, and clearly separated suggested next steps. These instructions do not guarantee factual accuracy; the output remains a teacher-review draft. The real API test uses the user's explicitly supplied transcript, kept outside the public repository. Automated tests use fictional data only.

## Scheduled lesson reports

Migration `0008_lesson_feedback.sql` adds revisioned private teacher drafts and published lesson reports, plus teacher-only demo parent profiles. The course timeline and planner unlock **Summary & Feedback** at the scheduled end instant in the saved course time zone. The server enforces the same boundary. Undated or invalid schedules remain locked.

Teachers rate attitude, preparation, effort/focus and learning outcomes from 1–5; absent learners have no ratings. Drafts can be saved without a transcript. **Generate & publish feedback** sends the full UTF-8 transcript to Responses with strict structured output, `store:false`, and the existing model and limits. Ratings and parent notes are not sent to OpenAI. The transcript is not persisted. A revision check and two-minute generation lease prevent double submission and stale writes. Existing reports remain visible if generation fails. Course, membership and roster are rechecked before publication.

The recap is collective with bold headings and no timestamps. Homework replaces the displayed planned assignment only when exact evidence matches the teacher's identified transcript turns. Blank/uncertain speaker labels leave existing homework intact. Optional quotations must match the mapped student's exact words; optional AI parent messages require matching teacher evidence naming that speaker. These checks verify attribution, not semantic correctness; teachers can correct summaries, homework, quotes and parent messages after publication without a new AI request.

Family APIs project only the current learner's assessment and explicitly public course fields. Parent messages are excluded from student responses. Removed learners, disconnected parents and trashed classes lose access immediately. Stable lesson IDs keep reports attached during schedule edits, and saved reports/drafts prevent replacing their lessons through plan regeneration.

**Set up demo parent profiles** creates no authentication users, passwords, emails or anonymous links. Each profile opens the same parent projection under existing class-teacher authorization. Real parent invitations remain separate. The teacher also has a course timeline with direct feedback access.
