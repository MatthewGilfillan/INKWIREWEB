import { api, escape } from './workspace-shared.js';
import { calendarGrid, shiftMonth, zonedClock } from './calendar-model.mjs';

export function createTeacherCalendar({ root, getClasses, openCourse, problem }) {
  let zone = 'Asia/Bangkok', month = zonedClock(Date.now(), zone).date.slice(0, 7), mode = matchMedia('(max-width:600px)').matches ? 'agenda' : 'month', generation = 0, data = null;
  root.innerHTML = `<div class="calendar-toolbar"><div class="teacher-actions"><button type="button" class="teacher-button secondary" data-cal="previous" aria-label="Previous month">←</button><button type="button" class="teacher-button secondary" data-cal="today">Today</button><button type="button" class="teacher-button secondary" data-cal="next" aria-label="Next month">→</button></div><label>Month<input type="month" data-cal="month" min="2000-01" max="2100-12" required></label><label>Show<select data-cal="mode"><option value="month">Month</option><option value="agenda">Agenda</option></select></label></div>
    <div class="calendar-filters"><label>Class<select data-cal="class"><option value="">All classes</option></select></label><label>Calendar time zone<select data-cal="zone"><option value="Asia/Bangkok">Bangkok (UTC+7)</option><option value="Asia/Shanghai">Beijing / Shanghai (UTC+8)</option><option value="Europe/London">London</option><option value="America/New_York">New York</option><option value="UTC">UTC</option></select></label></div><h2 data-cal="title"></h2><p data-cal="status" role="status"></p><button type="button" class="text-button" data-cal="retry" hidden>Try loading calendar again</button><div data-cal="events"></div><div data-cal="issues"></div><div data-cal="unscheduled"></div>`;
  const $ = name => root.querySelector(`[data-cal="${name}"]`);
  $('mode').value = mode; $('month').value = month;
  function eventLabel(event, day = event.date) {
    const start = zonedClock(event.startsAt, zone), end = zonedClock(event.endsAt, zone);
    if (day > start.date) return 'Until ' + end.time + ' · continued';
    return `${start.time}–${end.time}${end.date !== start.date ? ' (ends ' + end.date + ')' : ''}`;
  }
  function eventButton(event, day) {
    return `<button type="button" class="calendar-event" data-event="${escape(event.id)}" aria-label="${escape(eventLabel(event, day) + ' · ' + event.className + ' · ' + event.title)}"><time datetime="${escape(event.startsAt)}">${escape(eventLabel(event, day))}</time><strong>${escape(event.className)}</strong><span>${escape(event.title)}</span></button>`;
  }
  function dayLabel(day) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z')); }
  function render() {
    $('title').textContent = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T12:00:00Z'));
    $('month').value = month; $('previous').disabled = month <= '2000-01'; $('next').disabled = month >= '2100-12';
    if (!data) return;
    const filter = $('class').value, events = data.events.filter(e => !filter || e.classId === filter), monthEvents = events.filter(e => (e.dates || [e.date]).some(d => d.startsWith(month)));
    const days = calendarGrid(month), today = zonedClock(Date.now(), zone).date;
    $('status').textContent = `${monthEvents.length} scheduled lesson${monthEvents.length === 1 ? '' : 's'} this month. Times shown in ${zone}. Open a lesson to review or change its schedule.`;
    if (mode === 'month') $('events').innerHTML = `<div class="calendar-weekdays" aria-hidden="true">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<span>${d}</span>`).join('')}</div><div class="calendar-month">${days.map(day => `<section class="calendar-day ${day.startsWith(month) ? '' : 'outside-month'} ${day === today ? 'is-today' : ''}" aria-label="${dayLabel(day)}"><h3><time datetime="${day}" ${day === today ? 'aria-current="date"' : ''}>${Number(day.slice(-2))}</time></h3>${events.filter(e => (e.dates || [e.date]).includes(day)).map(event => eventButton(event, day)).join('')}</section>`).join('')}</div>`;
    else $('events').innerHTML = monthEvents.length ? `<div class="calendar-agenda">${[...new Set(monthEvents.flatMap(e => e.dates || [e.date]).filter(d => d.startsWith(month)))].sort().map(day => `<section><h3>${dayLabel(day)}</h3>${monthEvents.filter(e => (e.dates || [e.date]).includes(day)).map(event => eventButton(event, day)).join('')}</section>`).join('')}</div>` : '<div class="calendar-empty">No lessons are scheduled this month. Choose another month or schedule a class below.</div>';
    const missing = data.unscheduled.filter(c => !filter || c.classId === filter), issues = data.issues.filter(c => !filter || c.classId === filter);
    $('unscheduled').innerHTML = missing.length ? `<section class="calendar-unscheduled"><h3>Classes to schedule</h3>${missing.map(c => `<div><span><strong>${escape(c.className)}</strong><small>${c.count === null ? 'No course plan saved yet' : c.count + ' lesson dates to set'}</small></span><button type="button" class="teacher-button secondary" data-schedule="${escape(c.classId)}">Schedule lessons</button></div>`).join('')}</section>` : '';
    $('issues').innerHTML = issues.length ? `<section class="calendar-issues"><h3>Lesson times to check</h3>${issues.map((issue, i) => `<p><strong>${escape(issue.className + ' · ' + issue.title)}</strong><br>${escape(issue.message)} <button type="button" class="text-button" data-issue="${i}">Open lesson</button></p>`).join('')}</section>` : '';
    $('issues')._issues = issues;
  }
  async function reload() {
    if (root.hidden) return;
    const token = ++generation, days = calendarGrid(month), end = new Date(days.at(-1) + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 1);
    data = null; $('events').replaceChildren(); $('issues').replaceChildren(); $('unscheduled').replaceChildren(); render();
    $('status').textContent = 'Loading calendar…'; $('retry').hidden = true;
    try {
      const result = await api('/api/classes/calendar?' + new URLSearchParams({ from: days[0], to: end.toISOString().slice(0, 10), timeZone: zone }));
      if (token !== generation || root.hidden) return;
      data = result; render();
    } catch (error) { if (token !== generation) return; $('status').textContent = error.message; $('retry').hidden = false; if (error.status === 401) problem(error); }
  }
  function refresh() {
    const selected = $('class').value;
    $('class').innerHTML = '<option value="">All classes</option>' + getClasses().map(c => `<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');
    if ([...$('class').options].some(o => o.value === selected)) $('class').value = selected;
    return reload();
  }
  $('previous').onclick = () => { month = shiftMonth(month, -1); reload(); };
  $('next').onclick = () => { month = shiftMonth(month, 1); reload(); };
  $('today').onclick = () => { month = zonedClock(Date.now(), zone).date.slice(0, 7); reload(); };
  $('month').onchange = () => { if ($('month').checkValidity() && $('month').value) { month = $('month').value; reload(); } };
  $('zone').onchange = () => { zone = $('zone').value; reload(); };
  $('mode').onchange = () => { mode = $('mode').value; render(); };
  $('class').onchange = render; $('retry').onclick = reload;
  root.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || !data) return;
    if (button.dataset.event) { const lesson = data.events.find(e => e.id === button.dataset.event); if (lesson) openCourse(lesson.classId, button, lesson.lessonIndex); }
    if (button.dataset.schedule) openCourse(button.dataset.schedule, button);
    if (button.dataset.issue !== undefined) { const issue = $('issues')._issues[Number(button.dataset.issue)]; if (issue) openCourse(issue.classId, button, issue.lessonIndex); }
  });
  render();
  return { refresh, reload, clear() { generation++; data = null; $('events').replaceChildren(); $('issues').replaceChildren(); $('unscheduled').replaceChildren(); } };
}
