import {lessonTiming} from '../dist/schedule-model.mjs';
import { lessonKey } from '../dist/lesson-feedback-model.mjs';
import { validateCourse } from '../dist/course-model.mjs';

export async function handleCourseOverview(request, env, user, classId, { json, fail, readJSON }) {
  const classroom = await env.DB.prepare(`SELECT c.id FROM classes c WHERE c.id = ? AND c.deleted_at IS NULL AND
    (c.owner_id = ? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id = c.id AND t.user_id = ?))`).bind(classId, user.id, user.id).first();
  if (!classroom) return fail('Class not found.', 404, 'NOT_FOUND');
  const read = () => env.DB.prepare('SELECT revision, content, updated_at AS updatedAt FROM course_overviews WHERE class_id = ?').bind(classId).first();
  const output = row => row ? { course: JSON.parse(row.content), revision: row.revision, updatedAt: row.updatedAt } : { course: null, revision: 0, updatedAt: null };
  if (request.method === 'GET') return json({...output(await read()), serverNow:Date.now()});
  if (request.method !== 'POST') return fail('Use GET or POST.', 405);
  if (request.headers.get('Origin') !== env.APP_ORIGIN || request.headers.get('Sec-Fetch-Site') === 'cross-site') return fail('Invalid origin.', 403, 'INVALID_ORIGIN');
  let input, course;
  try {
    input = await readJSON(request, 131072);
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw Error('Reload the course overview before saving.');
    course = validateCourse(input.course);
  } catch (error) { return fail(error.message === 'BODY_TOO_LARGE' ? 'This overview is too long. Shorten it before saving.' : error.message || 'Check the course overview.', 400, 'INVALID_INPUT'); }
  const reports = (await env.DB.prepare('SELECT lesson_id,published FROM lesson_feedback WHERE class_id = ?').bind(classId).all()).results;
  const ids = new Set(course.lessons.map(lessonKey));
  const quizzes=(await env.DB.prepare('SELECT lesson_id FROM lesson_quizzes WHERE class_id=?').bind(classId).all()).results;
  if ([...reports,...quizzes].some(row => !ids.has(row.lesson_id))) return fail('Lessons with saved feedback or quizzes cannot be removed or replaced. Edit those lessons in place, or copy the plan into a new class.', 409, 'LESSON_HAS_FEEDBACK');
  const previous = await read(), priorCourse = previous ? JSON.parse(previous.content) : null;
  for (const report of reports.filter(r=>r.published)) {
    const before=priorCourse?.lessons.find((l,i)=>lessonKey(l,i)===report.lesson_id), after=course.lessons.find((l,i)=>lessonKey(l,i)===report.lesson_id);
    if (before && (after.status==='cancelled' || JSON.stringify(lessonTiming(priorCourse,before))!==JSON.stringify(lessonTiming(course,after)))) return fail('This lesson already has published feedback. Keep its recorded date and time; schedule a new lesson for a make-up class.',409,'LESSON_ALREADY_REPORTED');
  }
  const content = JSON.stringify(course), now = Date.now();
  // A single conditional statement prevents two teachers overwriting one another.
  const saved = input.revision === 0
    ? await env.DB.prepare(`INSERT INTO course_overviews(class_id, revision, content, updated_by, updated_at) VALUES (?,1,?,?,?) ON CONFLICT(class_id) DO NOTHING RETURNING revision`).bind(classId, content, user.id, now).first()
    : await env.DB.prepare(`UPDATE course_overviews SET content = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE class_id = ? AND revision = ? AND NOT EXISTS (SELECT 1 FROM lesson_feedback f WHERE f.class_id=? AND f.lesson_id NOT IN (SELECT COALESCE(json_extract(value,'$.id'),'legacy-'||(key+1)) FROM json_each(?,'$.lessons')))
      AND NOT EXISTS (SELECT 1 FROM lesson_quizzes q WHERE q.class_id=? AND q.lesson_id NOT IN (SELECT COALESCE(json_extract(value,'$.id'),'legacy-'||(key+1)) FROM json_each(?,'$.lessons')))
      AND NOT EXISTS (SELECT 1 FROM lesson_feedback f, json_each(?,'$.lessons') n, json_each(course_overviews.content,'$.lessons') old
        WHERE f.class_id=course_overviews.class_id AND f.published IS NOT NULL
        AND f.lesson_id=COALESCE(json_extract(n.value,'$.id'),'legacy-'||(n.key+1)) AND f.lesson_id=COALESCE(json_extract(old.value,'$.id'),'legacy-'||(old.key+1))
        AND (json_extract(n.value,'$.status')='cancelled' OR json_extract(n.value,'$.date')!=json_extract(old.value,'$.date')
          OR COALESCE(json_extract(n.value,'$.startTime'),json_extract(?,'$.startTime'))!=COALESCE(json_extract(old.value,'$.startTime'),json_extract(course_overviews.content,'$.startTime'))
          OR COALESCE(json_extract(n.value,'$.lessonMinutes'),json_extract(?,'$.lessonMinutes'))!=COALESCE(json_extract(old.value,'$.lessonMinutes'),json_extract(course_overviews.content,'$.lessonMinutes')))) RETURNING revision`).bind(content, user.id, now, classId, input.revision, classId, content, classId, content, content, content, content).first();
  if (!saved) {
    const latest = await read();
    // Retrying the same saved content is safe, including after a lost response.
    if (latest?.content === content) return json(output(latest));
    return fail('Another teacher saved changes. Your draft is still open. Copy or download it before closing, then reopen the overview to see the latest version.', 409, 'CONFLICT');
  }
  return json({ course, revision: saved.revision, updatedAt: now, serverNow:Date.now() });
}
