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
