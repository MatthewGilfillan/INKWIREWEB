// Shared by the teacher planner and its authenticated API.
export const presets = [
  { id: 'combined', name: 'Literature & essay writing', description: 'Read closely, discuss ideas and build a literary essay.', overview: 'Students develop thoughtful interpretations of literature through close reading and discussion, then shape those ideas into clear, well-supported essays. The course moves from short analytical responses to independent drafting, feedback and revision.' },
  { id: 'literature', name: 'Literature study', description: 'A sustained reading journey with discussion and written responses.', overview: 'Students explore character, language, structure and themes through sustained reading and discussion. They support their interpretations with textual evidence, consider alternative readings and develop an independent final response.' },
  { id: 'essay', name: 'Essay writing', description: 'Build an argument through planning, drafting and revision.', overview: 'Students learn to unpack a question, develop a thesis and organise a convincing argument. They practise evidence selection, analytical paragraphs, coherence and precise expression before drafting and revising an independent essay.' },
  { id: 'blank', name: 'Blank overview', description: 'Start with your own weekly topics.', overview: '' },
];
const literature = [
  ['Introducing the text', 'Explore context, first impressions and reading habits.'],
  ['Character & motivation', 'Support an interpretation of a character with evidence.'],
  ['Setting & atmosphere', 'Explain how setting shapes a reader’s response.'],
  ['Narrative voice', 'Explore perspective and the choices a narrator makes.'],
  ['Language & imagery', 'Analyse the effects of precise language choices.'],
  ['Structure & turning points', 'Trace how the writer develops tension and meaning.'],
  ['Themes & patterns', 'Connect recurring ideas to specific moments in the text.'],
  ['Mid-course discussion', 'Revisit interpretations and identify questions for further reading.'],
  ['Relationships & conflict', 'Compare perspectives and the development of conflict.'],
  ['Context & interpretation', 'Use relevant context to deepen a reading.'],
  ['Alternative readings', 'Compare interpretations using textual evidence.'],
  ['Comparing passages', 'Develop connections between passages or texts.'],
  ['Independent close reading', 'Build a supported interpretation of a new passage.'],
  ['Seminar & response', 'Respond thoughtfully to other readers’ ideas.'],
  ['Final response & reflection', 'Present an interpretation and reflect on progress.'],
];
const writing = [
  ['Writing baseline & goals', 'Identify strengths and set personal writing goals.'],
  ['Understanding the question', 'Define the task, audience and key terms.'],
  ['Building a thesis', 'Develop a clear, arguable answer to the question.'],
  ['Selecting evidence', 'Choose relevant evidence and explain its value.'],
  ['Analytical paragraphs', 'Connect a claim, evidence and reasoning.'],
  ['Explaining language', 'Move from identifying a technique to explaining its effect.'],
  ['Essay structure', 'Organise ideas into a coherent argument.'],
  ['First extended draft', 'Develop a sustained response and identify revision priorities.'],
  ['Introductions & conclusions', 'Frame an argument and draw a considered conclusion.'],
  ['Coherence & transitions', 'Develop clear connections within and between paragraphs.'],
  ['Counterarguments', 'Consider alternative views and refine the argument.'],
  ['Style & precision', 'Make language accurate, concise and purposeful.'],
  ['Independent essay draft', 'Apply the writing process to an independent response.'],
  ['Feedback & revision', 'Use specific feedback to strengthen an essay.'],
  ['Final essay & reflection', 'Submit a polished response and evaluate progress.'],
];
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2100-12-31') return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function addDays(value, days) {
  if (!validDate(value)) return '';
  const date = new Date(value + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function defaults(title = '') {
  return { version: 1, preset: 'combined', organization: 'Rivendell', title: title || 'Literature & essay writing', description: presets[0].overview, weeks: 15, lessonsPerWeek: 1, lessonMinutes: 120, startDate: '', startTime: '16:00', timeZone: 'Asia/Shanghai', lessons: [] };
}
export function courseSummary(course) {
  const count = course.weeks * course.lessonsPerWeek;
  return `${course.weeks} weeks · ${course.lessonsPerWeek} lesson${course.lessonsPerWeek === 1 ? '' : 's'}/week · ${course.lessonMinutes} min · ${Number((count * course.lessonMinutes / 60).toFixed(1))} teaching hours`;
}
export function generateLessons(course, outline = '') {
  // One pasted line is one week's topic; tabs from a spreadsheet become columns.
  const lines = outline.trim().split(/\r?\n/).filter(line => line.trim());
  if (lines.length > course.weeks) throw Error(`Your outline has ${lines.length} rows. Increase the number of weeks or shorten it; no rows have been discarded.`);
  const lessons = [];
  for (let week = 1; week <= course.weeks; week++) {
    const index = course.weeks === 1 ? 0 : Math.round((week - 1) * 14 / (course.weeks - 1));
    const read = literature[index], write = writing[index];
    const pasted = lines[week - 1]?.replace(/^\s*(?:week\s*\d+\s*[:.\-–—]?|\d+[.)])\s*/i, '').split('\t');
    for (let slot = 1; slot <= course.lessonsPerWeek; slot++) {
      let title = '', goal = '';
      if (course.preset === 'combined') { title = `${read[0]} / ${write[0]}`; goal = `${read[1]} ${write[1]}`; }
      if (course.preset === 'literature') [title, goal] = read;
      if (course.preset === 'essay') [title, goal] = write;
      lessons.push({ week, slot, date: addDays(course.startDate, (week - 1) * 7 + Math.floor((slot - 1) * 7 / course.lessonsPerWeek)), title: pasted?.[0]?.trim() || title || `Week ${week}${course.lessonsPerWeek > 1 ? ` · lesson ${slot}` : ''}`, goal: pasted?.[1]?.trim() || goal, reading: pasted?.[2]?.trim() || '', homework: pasted?.slice(3).join(' ').trim() || '' });
    }
  }
  return lessons;
}
export function validateCourse(value) {
  if (!value || value.version !== 1 || !presets.some(p => p.id === value.preset)) throw Error('Choose a course format.');
  for (const [key, min, max] of [['weeks', 1, 52], ['lessonsPerWeek', 1, 3], ['lessonMinutes', 15, 240]]) {
    if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max) throw Error(`Check ${key === 'lessonMinutes' ? 'lesson length (15–240 minutes)' : key === 'lessonsPerWeek' ? 'lessons per week (1–3)' : 'course length (1–52 weeks)'}.`);
  }
  const text = (input, max, label, required = false) => {
    if (typeof input !== 'string' || input.length > max || (required && !input.trim())) throw Error(`Check ${label} (up to ${max.toLocaleString()} characters).`);
    return input.trim();
  };
  const course = { version: 1, preset: value.preset, organization: text(value.organization, 120, 'school or organisation'), title: text(value.title, 160, 'course title', true), description: text(value.description, 4000, 'course description'), weeks: value.weeks, lessonsPerWeek: value.lessonsPerWeek, lessonMinutes: value.lessonMinutes };
  if (value.startDate !== '' && !validDate(value.startDate)) throw Error('Choose a valid start date.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime)) throw Error('Choose a valid lesson time.');
  try { if (typeof value.timeZone !== 'string' || value.timeZone.length > 80) throw Error(); new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); }
  catch { throw Error('Choose a valid time zone.'); }
  Object.assign(course, { startDate: value.startDate, startTime: value.startTime, timeZone: value.timeZone });
  if (!Array.isArray(value.lessons) || value.lessons.length !== course.weeks * course.lessonsPerWeek) throw Error('Generate the weekly plan after changing the course length.');
  course.lessons = value.lessons.map((lesson, i) => {
    if (lesson.week !== Math.floor(i / course.lessonsPerWeek) + 1 || lesson.slot !== i % course.lessonsPerWeek + 1 || (lesson.date !== '' && !validDate(lesson.date))) throw Error('Check the lesson dates and order.');
    return { week: lesson.week, slot: lesson.slot, date: lesson.date, title: text(lesson.title, 160, 'lesson topic', true), goal: text(lesson.goal, 1200, 'learning goals'), reading: text(lesson.reading, 1200, 'reading'), homework: text(lesson.homework, 1200, 'homework') };
  });
  if (new TextEncoder().encode(JSON.stringify(course)).byteLength > 120000) throw Error('This overview is too long. Shorten the lesson notes before saving.');
  return course;
}
