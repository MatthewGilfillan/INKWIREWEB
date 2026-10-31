# Teacher course planning

Open a class on the signed-in `/teacher` dashboard, then **Build course overview**. Existing plans show **Edit course overview** and the saved teaching-hour summary.

Teaching formats include:

| Format | Starting allocation | Calendar |
| --- | --- | --- |
| Rivendell full course | 15 × 120 minutes | Once weekly for 15 weeks |
| Summer course | 10 × 90 minutes | Individual class dates to arrange |
| Upper primary literature, Grades 4–6 | 15 × 50 minutes | Individual class dates to arrange |
| Custom | Editable lesson count and duration | 1–7 lessons per week, or individual dates |

Upper primary separates book sections from lesson numbers: author pre-reading, seven study sections and an optional Section 8 writing activity. The total lesson count stays editable, with an initial balanced allocation across sections. Teachers supply the actual text, questions and activities.

Choose combined literature/essay writing, literature, essay writing, upper primary structure or blank content independently of the teaching format. The presets provide suggested topics and learning goals, not a finished text-specific syllabus. Edit the overview, text/chapter reading and assignments before using it.

- Set the course title, organisation, total lessons, weekly frequency, lesson duration and optional starting date. Select the lesson time zone explicitly; the default is Beijing/Shanghai. Lesson dates are local calendar dates in that zone, without converting through the browser’s zone.
- **Generate weekly plan** replaces the lesson rows after confirmation. **Update lesson dates** preserves edited topics and assignments while recalculating the dates. For multiple lessons per week, suggested days are evenly spaced; individual dates remain editable for holidays and timetable changes.
- Paste one line per week for a weekly timetable, or one line per lesson for an individual-date course. Spreadsheet columns are topic, goals, reading and homework. Excess rows are rejected rather than silently discarded. Pasted content is treated as text.
- **Copy from another class** loads a saved plan from a class the teacher can access. Edit its title and dates before saving into the destination class. The source class is unchanged.
- Save explicitly. Drafts persist in D1 for the class owner and invited teachers. A concurrent save with different content returns a conflict and leaves the local draft open; download the outline before reopening the latest version. Unsaved work is not retained after closing or reloading.
- The unit overview also retains grade/age band, themes, essential questions, enduring understandings and source/review notes. Each lesson can retain its book section, skills, activities, evidence of learning and source-page references alongside goals, reading and assignments.
- **Open a prepared course file** reads a validated `.inkwire-course.json` draft locally. Opening does not upload or save it; review and explicitly save to the class. This is not a general PDF parser. PDF-to-course conversion is a separate preparation step. Source plans and converted drafts are not bundled into public website assets.
- **Save course file** creates a reusable JSON file that preserves the teaching fields and can be reopened. **Download outline** exports the current draft as plain text, including unsaved edits.

These are teacher-only planning drafts. Student/parent publication and connecting generated lessons to the standalone worksheet submission experiment are separate work. No emails or classroom notifications are sent.

## Deployment and checks

Apply `cloudflare/migrations/0005_course_overviews.sql` to the same D1 database before deploying this Worker and its assets. Existing classes and rosters are retained. The `/api/classes/:id/overview` GET/POST endpoint requires a verified teacher and ownership or invited membership, checks same-origin mutations, validates the plan and uses conditional revision writes. The larger 128 KiB request limit applies only to this endpoint; account request limits remain 8 KiB.

Run `node --test tests/*.test.cjs`. The account integration tests use SQLite and synthetic accounts, including plan persistence, class isolation, revoked access and concurrent-save conflicts. Serve `dist/` locally on port 8788. Install Chromium with `npx playwright install chromium`, then run `npm run test:browser`; alternatively use an installed Google Chrome with `PLAYWRIGHT_CHROME_CHANNEL=chrome npm run test:browser`. Browser tests use fictional API fixtures to verify the UI, copying, paste escaping, saved-plan reopening, conflict recovery, outline download and narrow-screen layout. Further checks cover custom frequency with a partly filled final week, 90-minute summer classes, 50-minute primary classes, optional writing sections, file import/export and retention of teaching fields. `TEST_PRIVATE_COURSE_DIR` can point to local prepared course files for optional import checks; their content is not committed or uploaded by those browser checks.
