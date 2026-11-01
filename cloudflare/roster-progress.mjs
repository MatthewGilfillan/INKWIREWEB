import {lessonKey} from '../dist/lesson-feedback-model.mjs';

// Unrecorded lessons are unknown, never absences. Only published assessments
// contribute: an incomplete draft defaults to Present before the teacher rates it.
export function attendanceForRoster(students, course, reports) {
  const lessons = new Set((course?.lessons || []).map(lessonKey));
  const totals = new Map(students.map(s => [s.id, {present:0, absent:0, recorded:0, rate:null}]));
  for (const row of reports) {
    if (!lessons.has(row.lesson_id) || !row.published) continue;
    const report = JSON.parse(row.published);
    for (const [id, assessment] of Object.entries(report.students || {})) {
      const total = totals.get(id);
      if (!total || !['present','absent'].includes(assessment.attendance)) continue;
      total[assessment.attendance]++; total.recorded++;
    }
  }
  for (const total of totals.values()) if (total.recorded) total.rate = Math.round(total.present / total.recorded * 100);
  return totals;
}

export async function addRosterProgress(env, user, classId, students) {
  const [overview, reports, memberships] = await Promise.all([
    env.DB.prepare('SELECT content FROM course_overviews WHERE class_id=?').bind(classId).first(),
    env.DB.prepare('SELECT lesson_id, published FROM lesson_feedback WHERE class_id=? AND published IS NOT NULL').bind(classId).all(),
    env.DB.prepare(`SELECT s.learner_id AS learnerId, c.id, c.name FROM class_students s JOIN classes c ON c.id=s.class_id
      WHERE c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))
      AND EXISTS(SELECT 1 FROM class_students selected WHERE selected.class_id=? AND selected.learner_id=s.learner_id)
      ORDER BY c.name,c.id`).bind(user.id,user.id,classId).all()
  ]);
  const totals = attendanceForRoster(students, overview ? JSON.parse(overview.content) : null, reports.results);
  for (const student of students) {
    student.attendance = totals.get(student.id);
    student.courses = memberships.results.filter(c => c.learnerId === student.id).map(({id,name}) => ({id,name}));
    // Class-linked submission records are not available in the live system yet.
    student.homework = {tracked:false, completed:null, assigned:null, rate:null};
  }
}
