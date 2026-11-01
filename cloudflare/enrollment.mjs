import { digest } from './auth.mjs';
import { isTeacher, limitClassAction } from './classes.mjs';
import { addRosterProgress } from './roster-progress.mjs';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const cleanCode = code => typeof code === 'string' ? code.replace(/[\s-]/g, '').toUpperCase() : '';
const validCode = (kind, code) => new RegExp(`^[A-HJ-NP-Z2-9]{${kind === 'class' ? 8 : 12}}$`).test(code);
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 80;
const uuid = '[a-f0-9-]{36}';
const classAccess = (env, user, classId) => env.DB.prepare(`SELECT id, name, subject FROM classes c WHERE c.id = ? AND c.deleted_at IS NULL
  AND (c.owner_id = ? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id = c.id AND t.user_id = ?))`)
  .bind(classId, user.id, user.id).first();
const learnerInClass = (env, classId, learnerId) => env.DB.prepare(`SELECT l.id, l.display_name AS name, l.user_id AS userId
  FROM learners l JOIN class_students s ON s.learner_id = l.id WHERE s.class_id = ? AND l.id = ?`).bind(classId, learnerId).first();

async function cipherKey(env) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('inkwire-invites-v1:' + env.BETTER_AUTH_SECRET));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(env, code, id) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:new TextEncoder().encode(id)}, await cipherKey(env), new TextEncoder().encode(code)));
  return btoa(String.fromCharCode(...iv, ...encrypted));
}
async function unseal(env, encoded, id) {
  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:new TextEncoder().encode(id)}, await cipherKey(env), bytes.slice(12)));
}
async function storedInvite(env, classId, kind, learnerId = null) {
  return env.DB.prepare('SELECT * FROM learning_invites WHERE class_id = ? AND kind = ? AND learner_id IS ?').bind(classId, kind, learnerId).first();
}
export async function createLearningInvite(env, classId, kind = 'class', learnerId = null, reset = false) {
  const current = await storedInvite(env, classId, kind, learnerId);
  if (!reset && current && current.expires_at > Date.now() && !current.redeemed_by) {
    try { return {code:await unseal(env, current.code_cipher, current.id), expiresAt:current.expires_at, kind}; }
    catch { /* Secret rotation: replace an unreadable invitation with a fresh one. */ }
  }
  const code = Array.from(crypto.getRandomValues(new Uint8Array(kind === 'class' ? 8 : 12)), byte => alphabet[byte & 31]).join('');
  const id = current?.id || await digest(`${classId}:${kind}:${learnerId || ''}`), expiresAt = Date.now() + 7 * 86400000;
  await env.DB.prepare(`INSERT INTO learning_invites (id, kind, class_id, learner_id, code_hash, code_cipher, expires_at, redeemed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET code_hash = excluded.code_hash,
    code_cipher = excluded.code_cipher, expires_at = excluded.expires_at, redeemed_by = NULL`)
    .bind(id, kind, classId, learnerId, await digest(code), await seal(env, code, id), expiresAt).run();
  return {code, expiresAt, kind};
}

export async function handleEnrollment(request, env, user, {json, fail, readJSON}) {
  if (!user?.emailVerified) return fail('Please sign in.', 401, 'UNAUTHENTICATED');
  const path = new URL(request.url).pathname.replace('/api/enrollment', '');
  const teacher = isTeacher(user);
  if (request.method === 'GET') {
    if (path === '/mine' && user.requestedRole === 'student') {
      const learner = await env.DB.prepare('SELECT id, display_name AS name FROM learners WHERE user_id = ?').bind(user.id).first();
      const rows = learner ? await env.DB.prepare(`SELECT c.id, c.name, c.subject FROM classes c JOIN class_students s ON s.class_id = c.id WHERE s.learner_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at DESC`).bind(learner.id).all() : {results:[]};
      return json({learner, classes:rows.results});
    }
    if (path === '/mine' && user.requestedRole === 'parent') {
      const children = (await env.DB.prepare(`SELECT l.id, l.display_name AS name FROM learners l JOIN learner_parents p ON p.learner_id = l.id WHERE p.parent_id = ? ORDER BY l.display_name, l.id`).bind(user.id).all()).results;
      for (const child of children) child.classes = (await env.DB.prepare(`SELECT c.id, c.name, c.subject FROM classes c JOIN class_students s ON s.class_id = c.id WHERE s.learner_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at DESC`).bind(child.id).all()).results;
      return json({children});
    }
    if (path === '/learners' && teacher) return json({learners:(await env.DB.prepare(`SELECT DISTINCT l.id, l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id JOIN classes c ON c.id=s.class_id WHERE c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?)) ORDER BY l.display_name, l.id`).bind(user.id,user.id).all()).results});
    const roster = path.match(new RegExp(`^/classes/(${uuid})/roster$`));
    if (teacher && roster && await classAccess(env,user,roster[1])) {
      const students = (await env.DB.prepare(`SELECT l.id, l.display_name AS name, l.user_id IS NOT NULL AS connected, EXISTS(SELECT 1 FROM demo_parent_profiles d WHERE d.learner_id=l.id AND d.class_id=s.class_id) AS demoParent FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? ORDER BY l.display_name,l.id`).bind(roster[1]).all()).results;
      for (const student of students) student.parents=(await env.DB.prepare('SELECT parent_id AS id, parent_name AS name FROM learner_parents WHERE learner_id=? ORDER BY connected_at').bind(student.id).all()).results;
      await addRosterProgress(env,user,roster[1],students);
      return json({students});
    }
    return fail('Not found.',404,'NOT_FOUND');
  }
  if (request.method !== 'POST') return fail('Use POST.',405);
  if (request.headers.get('Origin') !== env.APP_ORIGIN || request.headers.get('Sec-Fetch-Site') === 'cross-site') return fail('Invalid origin.',403,'INVALID_ORIGIN');
  let input; try {input = await readJSON(request);} catch {return fail('Invalid request.',400,'INVALID_INPUT');}
  if (!await limitClassAction(env,user.id,path === '/preview' || path === '/join' ? 'enroll' : 'manage-enrollment', path === '/preview' || path === '/join' ? 10 : 60)) return fail('Too many attempts. Please try again in 15 minutes.',429,'RATE_LIMITED');
  if (path === '/preview' || path === '/join') {
    const {kind} = input, code = cleanCode(input.code);
    if (!['class','student','family'].includes(kind) || !validCode(kind,code)) return fail('This invitation is invalid, expired, or closed.',400,'INVALID_INVITE');
    const expectedRole = kind === 'family' ? 'parent' : 'student';
    if (user.requestedRole !== expectedRole) return fail(`This invitation is for a ${expectedRole} account. Sign in with the correct account.`,409,'ROLE_MISMATCH');
    const invite = await env.DB.prepare(`SELECT i.*, c.name AS class_name, c.subject, l.display_name AS student_name, l.user_id AS student_user
      FROM learning_invites i JOIN classes c ON c.id=i.class_id LEFT JOIN learners l ON l.id=i.learner_id
      WHERE c.deleted_at IS NULL AND i.code_hash=? AND i.kind=? AND i.expires_at>?
      AND (i.learner_id IS NULL OR EXISTS (SELECT 1 FROM class_students s WHERE s.class_id=i.class_id AND s.learner_id=i.learner_id))`)
      .bind(await digest(code),kind,Date.now()).first();
    if (!invite || (invite.redeemed_by && invite.redeemed_by !== user.id)) return fail('This invitation is invalid, expired, or already used.',400,'INVALID_INVITE');
    if (path === '/preview') return json({kind,className:invite.class_name,subject:invite.subject,studentName:invite.student_name || null,expiresAt:invite.expires_at,alreadyJoined:invite.redeemed_by === user.id});
    const now=Date.now();
    if (kind === 'class') {
      let learner = await env.DB.prepare('SELECT id FROM learners WHERE user_id=?').bind(user.id).first();
      if (!learner && !validName(input.name)) return fail('Enter the student’s name (up to 80 characters).',400,'INVALID_NAME');
      if (!learner) {
        await env.DB.prepare('INSERT INTO learners (id,display_name,user_id,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(crypto.randomUUID(),input.name.trim(),user.id,now).run();
        learner = await env.DB.prepare('SELECT id FROM learners WHERE user_id=?').bind(user.id).first();
      }
      await env.DB.prepare(`INSERT OR IGNORE INTO class_students (class_id,learner_id,joined_at) SELECT class_id,?,? FROM learning_invites WHERE id=? AND code_hash=? AND expires_at>? AND EXISTS (SELECT 1 FROM classes c WHERE c.id=learning_invites.class_id AND c.deleted_at IS NULL)`)
        .bind(learner.id,now,invite.id,invite.code_hash,now).run();
      if (!await learnerInClass(env,invite.class_id,learner.id)) return fail('This invitation is no longer available.',400,'INVALID_INVITE');
    } else if (kind === 'student') {
      const existing = await env.DB.prepare('SELECT id FROM learners WHERE user_id=?').bind(user.id).first();
      if (existing && existing.id !== invite.learner_id) return fail('Your account is already connected to a student. Ask your teacher to add that student to this class, or use the class join code.',409,'ALREADY_CONNECTED');
      await env.DB.prepare(`UPDATE learners SET user_id=? WHERE id=? AND (user_id IS NULL OR user_id=?) AND EXISTS
        (SELECT 1 FROM learning_invites i JOIN class_students s ON s.class_id=i.class_id AND s.learner_id=i.learner_id WHERE i.id=? AND i.code_hash=? AND i.expires_at>? AND EXISTS (SELECT 1 FROM classes c WHERE c.id=i.class_id AND c.deleted_at IS NULL) AND (i.redeemed_by IS NULL OR i.redeemed_by=?))`)
        .bind(user.id,invite.learner_id,user.id,invite.id,invite.code_hash,now,user.id).run();
      const linked = await env.DB.prepare('SELECT user_id FROM learners WHERE id=?').bind(invite.learner_id).first();
      if (linked?.user_id !== user.id) return fail('This student invitation has already been used.',400,'INVALID_INVITE');
      await env.DB.prepare('UPDATE learning_invites SET redeemed_by=? WHERE id=? AND code_hash=? AND (redeemed_by IS NULL OR redeemed_by=?)').bind(user.id,invite.id,invite.code_hash,user.id).run();
    } else {
      if (!validName(input.name)) return fail('Enter your name (up to 80 characters).',400,'INVALID_NAME');
      // Claim atomically. Repeating the same request is safe; a second parent needs a new code.
      const claimed = await env.DB.prepare(`UPDATE learning_invites SET redeemed_by=? WHERE id=? AND code_hash=? AND expires_at>? AND (redeemed_by IS NULL OR redeemed_by=?)
        AND EXISTS (SELECT 1 FROM classes c WHERE c.id=learning_invites.class_id AND c.deleted_at IS NULL) AND EXISTS (SELECT 1 FROM class_students s WHERE s.class_id=learning_invites.class_id AND s.learner_id=learning_invites.learner_id) RETURNING learner_id`)
        .bind(user.id,invite.id,invite.code_hash,now,user.id).first();
      if (!claimed) return fail('This parent invitation has already been used or closed.',400,'INVALID_INVITE');
      await env.DB.prepare('INSERT OR IGNORE INTO learner_parents (learner_id,parent_id,parent_name,connected_at) VALUES (?,?,?,?)').bind(invite.learner_id,user.id,input.name.trim(),now).run();
    }
    return json({status:true,dashboardPath:expectedRole === 'parent' ? '/parent' : '/student'});
  }
  const route = path.match(new RegExp(`^/classes/(${uuid})/(students|invite|remove|disconnect)$`));
  if (!teacher || !route || !await classAccess(env,user,route[1])) return fail('Class not found.',404,'NOT_FOUND');
  const classId=route[1], action=route[2];
  if (action === 'students') {
    let learnerId=input.learnerId;
    if (learnerId) {
      const accessible=await env.DB.prepare(`SELECT l.id FROM learners l JOIN class_students s ON s.learner_id=l.id JOIN classes c ON c.id=s.class_id
        WHERE l.id=? AND c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?)) LIMIT 1`).bind(learnerId,user.id,user.id).first();
      if (!accessible) return fail('Student not found.',404,'NOT_FOUND');
    } else {
      if (!validName(input.name) || !new RegExp(`^${uuid}$`).test(input.requestId || '')) return fail('Enter a student name.',400,'INVALID_INPUT');
      // Deterministic per-teacher retry key prevents duplicate empty roster slots.
      learnerId=(await digest(`${user.id}:${classId}:${input.requestId}`)).slice(0,32);
      await env.DB.prepare('INSERT OR IGNORE INTO learners (id,display_name,created_at) VALUES (?,?,?)').bind(learnerId,input.name.trim(),Date.now()).run();
    }
    await env.DB.prepare('INSERT OR IGNORE INTO class_students (class_id,learner_id,joined_at) VALUES (?,?,?)').bind(classId,learnerId,Date.now()).run();
    return json({learnerId},201);
  }
  const kind=input.kind, learnerId=kind === 'class' ? null : input.learnerId;
  if (action === 'invite') {
    if (!['class','student','family'].includes(kind)) return fail('Choose an invitation type.',400,'INVALID_INPUT');
    const learner=learnerId ? await learnerInClass(env,classId,learnerId) : null;
    if (kind !== 'class' && !learner) return fail('Student not found.',404,'NOT_FOUND');
    if (input.action === 'disable') {
      await env.DB.prepare('DELETE FROM learning_invites WHERE class_id=? AND kind=? AND learner_id IS ?').bind(classId,kind,learnerId).run();
      return json({status:true});
    }
    if (kind === 'student' && learner.userId) return fail('This student account is already connected.',409,'ALREADY_CONNECTED');
    const invitation=await createLearningInvite(env,classId,kind,learnerId,input.action === 'reset');
    return json({...invitation,studentName:learner?.name || null,link:`${env.APP_ORIGIN}/join#${kind}=${invitation.code}`});
  }
  if (!await learnerInClass(env,classId,input.learnerId)) return fail('Student not found.',404,'NOT_FOUND');
  if (action === 'remove') {
    await env.DB.prepare('DELETE FROM learning_invites WHERE class_id=? AND learner_id=?').bind(classId,input.learnerId).run();
    await env.DB.prepare('DELETE FROM class_students WHERE class_id=? AND learner_id=?').bind(classId,input.learnerId).run();
    return json({status:true});
  }
  if (action === 'disconnect') {
    await env.DB.prepare('DELETE FROM learner_parents WHERE learner_id=? AND parent_id=?').bind(input.learnerId,input.parentId || '').run();
    // Invalidate redeemed invitations too, preventing the old recipient from reconnecting.
    await env.DB.prepare("DELETE FROM learning_invites WHERE kind='family' AND learner_id=? AND redeemed_by=?").bind(input.learnerId,input.parentId || '').run();
    return json({status:true});
  }
  return fail('Not found.',404);
}
