import {lessonTiming,billingSchedule} from './schedule-model.mjs';
import { validDate } from './course-model.mjs';

const formatters = new Map();
function formatter(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.length > 80) throw Error('Choose a valid calendar time zone.');
  if (!formatters.has(timeZone)) {
    if (formatters.size >= 64) formatters.clear();
    formatters.set(timeZone, new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
  }
  return formatters.get(timeZone);
}
function parts(instant, zone) {
  return Object.fromEntries(formatter(zone).formatToParts(new Date(instant)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}
export function zonedClock(instant, zone) {
  const p = parts(instant, zone);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function lessonInstant(date, time, zone) {
  if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Set a valid lesson date and time.');
  const local = `${date}T${time}`, wall = Date.parse(local + ':00Z'), offsets = new Set();
  // Check the offsets on both sides of any nearby clock change, then verify
  // candidate instants against the original wall clock. Never shift a lesson
  // silently into a daylight-saving gap or choose between duplicate times.
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const probe = wall + hours * 3600000, p = parts(probe, zone);
    offsets.add(Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - probe);
  }
  const candidates = [...offsets].map(offset => wall - offset).filter(instant => {
    const clock = zonedClock(instant, zone); return `${clock.date}T${clock.time}` === local;
  });
  if (!candidates.length) throw Error('This local time does not exist because the clocks change. Choose a different lesson time.');
  if (candidates.length > 1) throw Error('This local time occurs twice because the clocks change. Choose a different lesson time or use UTC.');
  return candidates[0];
}
export function calendarGrid(month) {
  if (!/^\d{4}-\d\d$/.test(month)) throw Error('Choose a calendar month.');
  const first = new Date(month + '-01T12:00:00Z');
  if (!Number.isFinite(first.getTime()) || first.toISOString().slice(0, 7) !== month) throw Error('Choose a calendar month.');
  const last = new Date(first); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  const start = new Date(first); start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const count = Math.ceil((first.getUTCDay() + last.getUTCDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => { const day = new Date(start); day.setUTCDate(day.getUTCDate() + i); return day.toISOString().slice(0, 10); });
}
export function shiftMonth(month, amount) {
  const date = new Date(month + '-01T12:00:00Z'); date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}
export function projectCalendar(classes, from, to, displayZone) {
  formatter(displayZone);
  const events = [], unscheduled = [], issues = [];
  for (const classroom of classes) {
    const course = classroom.course;
    if (!course) { unscheduled.push({ classId: classroom.id, className: classroom.name, count: null }); continue; }
    let withoutDate = 0;const billing=billingSchedule(course);
    course.lessons.forEach((lesson, index) => {
      if (!lesson.date) { withoutDate++; return; }
      try {
        const timing=lessonTiming(course,lesson), start = lessonInstant(lesson.date, timing.startTime, course.timeZone), end = start + timing.lessonMinutes * 60000;
        const day = zonedClock(start, displayZone).date;
        const lastDay = zonedClock(end - 1, displayZone).date, dates = [];
        for (const date = new Date(day + 'T12:00:00Z'); date.toISOString().slice(0, 10) <= lastDay; date.setUTCDate(date.getUTCDate() + 1)) dates.push(date.toISOString().slice(0, 10));
        if (!dates.some(date => date >= from && date < to)) return;
        events.push({ id: `${classroom.id}:${index}`, classId: classroom.id, className: classroom.name, courseTitle: course.title, title: lesson.title, lessonIndex: index, sourceZone: course.timeZone, status:lesson.status || 'scheduled', billing:billing.get(lesson.id || `legacy-${index+1}`)?.label || '', startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), date: day, dates });
      } catch (error) { issues.push({ classId: classroom.id, className: classroom.name, title: lesson.title, lessonIndex: index, message: error.message }); }
    });
    if (withoutDate) unscheduled.push({ classId: classroom.id, className: classroom.name, count: withoutDate });
  }
  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.className.localeCompare(b.className) || a.id.localeCompare(b.id));
  return { events, unscheduled, issues, timeZone: displayZone };
}
