import {validateCourse} from '../dist/course-model.mjs';
import { digest } from './auth.mjs';
import { createLearningInvite } from './enrollment.mjs';
import { handleCourseOverview } from './course-overviews.mjs';
import { handleCalendar } from './calendar.mjs';
import { handlePlanningAssistant } from './planning-assistant.mjs';

export const isTeacher = user => user?.emailVerified === true && user.requestedRole === 'teacher';
const classFields = `c.id, c.name, c.subject, c.created_at AS createdAt,
  CASE WHEN c.owner_id = ? THEN 'owner' ELSE 'teacher' END AS membership`;

export async function limitClassAction(env, userId, action, max = 10) {
  const period = Math.floor(Date.now() / 900000);
  await env.DB.prepare('DELETE FROM class_action_limits WHERE expires_at < ?').bind(Date.now()).run();
  const key = await digest(`${userId}:${action}:${period}`);
  return !!await env.DB.prepare(`INSERT INTO class_action_limits (key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count`)
    .bind(key, (period + 1) * 900000, max).first();
}

export async function handleClasses(request, env, user, { json, fail, readJSON }) {
  if (!user?.emailVerified) return fail('Please sign in.', 401, 'UNAUTHENTICATED');
  if (!isTeacher(user)) return fail('This workspace is for teacher accounts.', 403, 'FORBIDDEN');
  const path = new URL(request.url).pathname;
  const planningMatch = path.match(/^\/api\/classes\/([a-f0-9-]{36})\/planning-assistant$/);
  if (planningMatch) return handlePlanningAssistant(request, env, user, planningMatch[1], { json, fail, readJSON });
  if (path === '/api/classes/calendar') return handleCalendar(request, env, user, { json, fail });
  if (path === '/api/classes/trash' && request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT id, name, subject, deleted_at AS deletedAt FROM classes WHERE owner_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, id').bind(user.id).all();
    return json({ classes: rows.results });
  }
  const overviewMatch = path.match(/^\/api\/classes\/([a-f0-9-]{36})\/overview$/);
  if (overviewMatch) return handleCourseOverview(request, env, user, overviewMatch[1], { json, fail, readJSON });
  if (path === '/api/classes' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT ${classFields}, o.revision AS overviewRevision,
      json_extract(o.content, '$.weeks') AS courseWeeks, json_extract(o.content, '$.lessonsPerWeek') AS courseFrequency,
      json_extract(o.content, '$.lessonMinutes') AS courseMinutes, json_extract(o.content, '$.pacing') AS coursePacing, json_extract(o.content, '$.lessonCount') AS courseLessonCount FROM classes c LEFT JOIN course_overviews o ON o.class_id = c.id
      WHERE c.deleted_at IS NULL AND (c.owner_id = ? OR EXISTS (SELECT 1 FROM class_teachers m WHERE m.class_id = c.id AND m.user_id = ?))
      ORDER BY c.created_at DESC, c.id`).bind(user.id, user.id, user.id).all();
    return json({ classes: rows.results });
  }
  const inviteMatch = path.match(/^\/api\/classes\/([a-f0-9-]{36})\/invite$/);
  const lifecycleMatch = path.match(/^\/api\/classes\/([a-f0-9-]{36})\/(delete|restore)$/);
  if (path !== '/api/classes' && path !== '/api/classes/join' && !inviteMatch && !lifecycleMatch) return fail('Not found.', 404);
  if (request.method !== 'POST') return fail('Use POST.', 405);
  if (request.headers.get('Origin') !== env.APP_ORIGIN || request.headers.get('Sec-Fetch-Site') === 'cross-site') return fail('Invalid origin.', 403, 'INVALID_ORIGIN');
  let input;
  try { input = await readJSON(request, path === '/api/classes' ? 131072 : 8192); } catch { return fail('Invalid request.', 400, 'INVALID_INPUT'); }
  if (!await limitClassAction(env, user.id, inviteMatch ? 'invite' : path)) return fail('Too many attempts. Please try again in 15 minutes.', 429, 'RATE_LIMITED');
  if (lifecycleMatch) {
    const row = await env.DB.prepare(`UPDATE classes SET deleted_at = ${lifecycleMatch[2] === 'delete' ? 'COALESCE(deleted_at, ?)' : '?'} WHERE id = ? AND owner_id = ? RETURNING id, deleted_at AS deletedAt`)
      .bind(lifecycleMatch[2] === 'delete' ? Date.now() : null, lifecycleMatch[1], user.id).first();
    return row ? json({ classroom: row }) : fail('Class not found or you are not its owner.', 404, 'NOT_FOUND');
  }
  if (path === '/api/classes') {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
    if (!name || name.length > 80 || subject.length > 120 || !/^[a-f0-9-]{36}$/.test(input.requestId || '')) return fail('Enter a class name of up to 80 characters.', 400, 'INVALID_INPUT');
    let course=null;
    if(input.course){try{course=validateCourse(input.course);if(!course.lessons.every(l=>l.date) || !course.endDate || !course.weeklySlots?.length)throw Error('Review and complete the class timetable.');}catch(e){return fail(e.message,400,'INVALID_INPUT');}}
    const now=Date.now(),insert=env.DB.prepare(`INSERT INTO classes (id, owner_id, name, subject, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, request_id) DO NOTHING`).bind(crypto.randomUUID(), user.id, name, subject, input.requestId, now);
    if(course)await env.DB.batch([insert,env.DB.prepare(`INSERT INTO course_overviews(class_id,revision,content,updated_by,updated_at)
      SELECT id,1,?,?,? FROM classes WHERE owner_id=? AND request_id=? AND deleted_at IS NULL
      ON CONFLICT(class_id) DO NOTHING`).bind(JSON.stringify(course),user.id,now,user.id,input.requestId)]);
    else await insert.run();
    const classroom = await env.DB.prepare(`SELECT ${classFields} FROM classes c WHERE c.owner_id = ? AND c.request_id = ?`).bind(user.id, user.id, input.requestId).first();
    if (!await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND deleted_at IS NULL').bind(classroom.id).first()) return fail('This class is in Trash. Restore it or create a new class.', 409, 'CLASS_DELETED');
    await createLearningInvite(env, classroom.id);
    return json({ classroom }, 201);
  }
  if (path === '/api/classes/join') {
    const code = typeof input.code === 'string' ? input.code.replace(/[\s-]/g, '').toUpperCase() : '';
    if (!/^[A-HJ-NP-Z2-9]{12}$/.test(code)) return fail('This invite code is invalid or expired.', 400, 'INVALID_INVITE');
    const hash = await digest(code), now = Date.now();
    const classroom = await env.DB.prepare(`SELECT ${classFields} FROM classes c JOIN class_invites i ON i.class_id = c.id
      WHERE c.deleted_at IS NULL AND i.code_hash = ? AND i.expires_at > ?`).bind(user.id, hash, now).first();
    if (!classroom) return fail('This invite code is invalid or expired.', 400, 'INVALID_INVITE');
    if (classroom.membership !== 'owner') {
      await env.DB.prepare(`INSERT OR IGNORE INTO class_teachers (class_id, user_id, joined_at)
        SELECT class_id, ?, ? FROM class_invites WHERE code_hash = ? AND expires_at > ? AND EXISTS (SELECT 1 FROM classes c WHERE c.id=class_invites.class_id AND c.deleted_at IS NULL)`).bind(user.id, now, hash, now).run();
      if (!await env.DB.prepare('SELECT class_id FROM class_teachers WHERE class_id = ? AND user_id = ?').bind(classroom.id, user.id).first()) return fail('This invite code is invalid or expired.', 400, 'INVALID_INVITE');
    }
    return json({ classroom });
  }
  // Only the class owner can invite another teacher. Codes grant one class only.
  if (!await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND owner_id = ? AND deleted_at IS NULL').bind(inviteMatch[1], user.id).first()) return fail('Class not found or you are not its owner.', 404, 'NOT_FOUND');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // A 32-character alphabet gives 60 random bits with no modulo bias.
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const code = Array.from(bytes, value => alphabet[value & 31]).join('');
  const expiresAt = Date.now() + 7 * 86400000;
  await env.DB.prepare(`INSERT INTO class_invites (class_id, code_hash, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(class_id) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at`)
    .bind(inviteMatch[1], await digest(code), expiresAt).run();
  return json({ code, expiresAt });
}
