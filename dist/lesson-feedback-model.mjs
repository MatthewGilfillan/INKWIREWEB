import {lessonTiming} from './schedule-model.mjs';
import { lessonInstant } from './calendar-model.mjs';
export const ratingFields = { attitude: 'Attitude', prepared: 'Prepared for class', effort: 'Effort / focus', learning: 'Learning outcomes' };
export const lessonKey = (lesson, index) => lesson.id || `legacy-${index + 1}`;
export function lessonEnd(course, lesson) {
  if (!lesson.date || lesson.status==='cancelled') return null;
  const timing=lessonTiming(course,lesson);
  return lessonInstant(lesson.date, timing.startTime, course.timeZone) + timing.lessonMinutes * 60000;
}
export function validateAssessment(input, roster, complete = false) {
  if (!input || typeof input.teacherSpeaker !== 'string' || input.teacherSpeaker.length > 80 || !Array.isArray(input.assessments) || input.assessments.length !== roster.length || roster.length > 60) throw Error('Assess every student on the current class roster (up to 60 students).');
  const seen = new Set(), speakers = new Set();
  const teacherSpeaker = input.teacherSpeaker.trim();
  if (/[\r\n]/.test(teacherSpeaker)) throw Error('Use the teacher’s speaker label from the transcript.');
  if (teacherSpeaker) speakers.add(teacherSpeaker.toLowerCase());
  const assessments = input.assessments.map(item => {
    if (!roster.some(s => s.id === item.learnerId) || seen.has(item.learnerId)) throw Error('The class roster changed. Reopen Summary & Feedback.');
    seen.add(item.learnerId);
    if (!['present', 'absent'].includes(item.attendance)) throw Error('Record whether each student attended.');
    if (typeof item.speaker !== 'string' || item.speaker.length > 80 || /[\r\n]/.test(item.speaker) || typeof item.parentNote !== 'string' || item.parentNote.length > 1500) throw Error('Check the speaker labels and parent comments.');
    const speaker = item.speaker.trim();
    if (speaker && speakers.has(speaker.toLowerCase())) throw Error('Each transcript speaker must identify only one person. Leave uncertain student labels blank.');
    if (speaker) speakers.add(speaker.toLowerCase());
    const ratings = {};
    for (const key of Object.keys(ratingFields)) {
      const score = item.ratings?.[key] ?? null;
      if (item.attendance === 'absent') ratings[key] = null;
      else if (score === null && !complete) ratings[key] = null;
      else if (Number.isInteger(score) && score >= 1 && score <= 5) ratings[key] = score;
      else throw Error('Choose 1–5 stars in all four categories for each student who attended.');
    }
    return {learnerId:item.learnerId, attendance:item.attendance, ratings, speaker, parentNote:item.parentNote.trim()};
  });
  return {teacherSpeaker, assessments};
}
