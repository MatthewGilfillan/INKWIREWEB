import { validateCourse } from '../dist/course-model.mjs';

export async function handleCourseOverview(request, env, user, classId, { json, fail, readJSON }) {
  const classroom = await env.DB.prepare(`SELECT c.id FROM classes c WHERE c.id = ? AND
    (c.owner_id = ? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id = c.id AND t.user_id = ?))`).bind(classId, user.id, user.id).first();
  if (!classroom) return fail('Class not found.', 404, 'NOT_FOUND');
  const read = () => env.DB.prepare('SELECT revision, content, updated_at AS updatedAt FROM course_overviews WHERE class_id = ?').bind(classId).first();
  const output = row => row ? { course: JSON.parse(row.content), revision: row.revision, updatedAt: row.updatedAt } : { course: null, revision: 0, updatedAt: null };
  if (request.method === 'GET') return json(output(await read()));
  if (request.method !== 'POST') return fail('Use GET or POST.', 405);
  if (request.headers.get('Origin') !== env.APP_ORIGIN || request.headers.get('Sec-Fetch-Site') === 'cross-site') return fail('Invalid origin.', 403, 'INVALID_ORIGIN');
  let input, course;
  try {
    input = await readJSON(request, 131072);
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw Error('Reload the course overview before saving.');
    course = validateCourse(input.course);
  } catch (error) { return fail(error.message === 'BODY_TOO_LARGE' ? 'This overview is too long. Shorten it before saving.' : error.message || 'Check the course overview.', 400, 'INVALID_INPUT'); }
  const content = JSON.stringify(course), now = Date.now();
  // A single conditional statement prevents two teachers overwriting one another.
  const saved = input.revision === 0
    ? await env.DB.prepare(`INSERT INTO course_overviews(class_id, revision, content, updated_by, updated_at) VALUES (?,1,?,?,?) ON CONFLICT(class_id) DO NOTHING RETURNING revision`).bind(classId, content, user.id, now).first()
    : await env.DB.prepare(`UPDATE course_overviews SET content = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE class_id = ? AND revision = ? RETURNING revision`).bind(content, user.id, now, classId, input.revision).first();
  if (!saved) {
    const latest = await read();
    // Retrying the same saved content is safe, including after a lost response.
    if (latest?.content === content) return json(output(latest));
    return fail('Another teacher saved changes. Your draft is still open. Copy or download it before closing, then reopen the overview to see the latest version.', 409, 'CONFLICT');
  }
  return json({ course, revision: saved.revision, updatedAt: now });
}
