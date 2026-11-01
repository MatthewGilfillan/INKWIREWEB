export const formats = [
  { id: 'full', name: 'Rivendell full course', lessonCount: 15, lessonMinutes: 120, lessonsPerWeek: 1, pacing: 'weekly' },
  { id: 'summer', name: 'Summer course', lessonCount: 10, lessonMinutes: 90, lessonsPerWeek: 1, pacing: 'lessons' },
  { id: 'upper-primary', name: 'Upper primary literature · Grades 4–6', lessonCount: 15, lessonMinutes: 50, lessonsPerWeek: 1, pacing: 'lessons' },
  { id: 'custom', name: 'Custom · set your own timetable' },
];
export function useFormat(course, id) {
  const format = formats.find(f => f.id === id);
  if (!format) throw Error('Choose a teaching format.');
  if (id === 'custom') return { ...course, format: id };
  const next = { ...course, ...format, format: id, weeks: Math.ceil(format.lessonCount / format.lessonsPerWeek) };
  delete next.id; delete next.name;
  if (id === 'upper-primary') Object.assign(next, { preset: 'upper-primary', includeWritingActivity: true, gradeBand: 'Grades 4–6' });
  else if (next.preset === 'upper-primary') next.preset = 'combined';
  return next;
}
