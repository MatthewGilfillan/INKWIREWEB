import {escape} from './workspace-shared.js';
import {courseSummary} from './course-model.mjs';
import {lessonKey} from './lesson-feedback-model.mjs';
import {billingSchedule,lessonTiming} from './schedule-model.mjs';

// Small outline icons stay crisp at every screen size. Text carries their meaning.
const paths = {
  book: '<path d="M12 6C9 3 5 3 2 3v16c4 0 7 1 10 3 3-2 6-3 10-3V3c-3 0-7 0-10 3Zm0 0v16M5 7l4 1M5 11l4 1M5 15l4 1m6-8 4-1m-4 5 4-1m-4 5 4-1"/>',
  video: '<rect x="2" y="6" width="14" height="13" rx="2"/><path d="m16 10 6-4v13l-6-4"/>',
  quiz: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 4h.01"/>',
  pencil: '<path d="m15 4 5 5M4 15 15 4a3.5 3.5 0 0 1 5 5L9 20l-7 2 2-7Zm0 0 5 5"/>',
  checklist: '<path d="M3 5h9M3 12h9M3 19h9m4-15 2 2 4-4m-6 9 2 2 4-4m-6 9 2 2 4-4"/>',
  chart: '<path d="M3 3v18h19M7 16v-4m5 4V7m5 9v-6"/>',
  document: '<path d="M14 2H4v20h16V8l-6-6Zm0 0v6h6M8 12h8m-8 4h8"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M7 2v5m10-5v5M3 10h18M7 14h2m4 0h2m-8 4h2m4 0h2"/>',
};
export function courseIcon(name) {
  return `<svg class="course-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.document}</svg>`;
}
const activity = (icon,label,text) => text ? `<li class="overview-activity">${courseIcon(icon)}<div><span class="overview-activity-label">${escape(label)}</span><p>${escape(text)}</p></div></li>` : '';

export function courseOverviewHTML(course,{draft=false}={}) {
  if (!course) return `<div class="overview-empty">${courseIcon('book')}<h3>Your course starts here.</h3><p>Create a unit plan from a teaching format, your own resources, or an existing outline. Your lessons will appear here once you save it.</p></div>`;
  const billing=billingSchedule(course);
  return `<header class="overview-intro">${draft?'<span class="class-badge">Unsaved draft · preview</span>':''}<h3>${escape(course.title)}</h3><p class="overview-course-meta">${escape(courseSummary(course))} · ${escape(course.timeZone)}</p>${course.description?`<p class="overview-description">${escape(course.description)}</p>`:''}</header>
  <ol class="course-overview-lessons">${course.lessons.map((lesson,i)=>{
    const id=lessonKey(lesson,i),timing=lessonTiming(course,lesson),cancelled=lesson.status==='cancelled';
    const date=timing.date ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(timing.date+'T12:00:00Z')) : 'Date to be set';
    return `<li class="overview-lesson ${cancelled?'is-cancelled':''}" data-overview-lesson="${i}">
      <span class="overview-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span>
      <div class="overview-lesson-content"><div class="overview-lesson-heading"><h3><span class="visually-hidden">Lesson ${i+1}: </span>${escape(lesson.title)}</h3><button type="button" class="overview-edit-icon" data-overview-edit="${i}" aria-label="Edit lesson ${i+1}" title="Edit lesson ${i+1}">${courseIcon('pencil')}</button></div>
      ${lesson.section?`<p class="overview-section">${escape(lesson.section)}</p>`:''}${cancelled?'<span class="overview-cancelled">Cancelled</span>':''}
      ${lesson.goal?`<p class="overview-goal">${escape(lesson.goal)}</p>`:''}
      <ul class="overview-activities">
      ${activity('book','Reading before class',lesson.reading)}
      <li class="overview-activity">${courseIcon('quiz')}<div><button type="button" class="overview-activity-link" data-overview-quiz="${escape(id)}" ${draft?'disabled':''}>Pre-lesson quiz</button><span class="overview-item-meta" data-overview-quiz-status="${escape(id)}">View / set up quiz</span></div></li>
      <li class="overview-activity">${courseIcon('video')}<div><span>Lesson ${i+1} · Live class</span><span class="overview-item-meta">${escape(date)}${timing.startTime?' · '+escape(timing.startTime):''} · ${timing.lessonMinutes} min</span>${lesson.rescheduledFrom?`<p class="overview-rescheduled">Rescheduled from ${escape(lesson.rescheduledFrom.date)} · ${escape(lesson.rescheduledFrom.startTime)}</p>`:''}${billing.get(id)?.label?`<p class="overview-billing">${escape(billing.get(id).label)}</p>`:''}</div></li>
      ${activity('checklist','Lesson activities',lesson.activities)}
      ${activity('pencil','Homework & writing',lesson.homework)}
      <li class="overview-activity overview-feedback">${courseIcon('chart')}<div><button type="button" class="overview-activity-link" data-feedback-open="${escape(id)}" disabled>Summary &amp; Feedback</button><span class="overview-item-meta" data-feedback-unlock></span></div></li>
      </ul></div></li>`;
  }).join('')}</ol>`;
}
