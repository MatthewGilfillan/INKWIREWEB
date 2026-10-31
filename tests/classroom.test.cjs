const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function classroom() {
  const ctx=vm.createContext({localStorage:{getItem:()=>null},Intl,Date,URL,role:'teacher'});
  for(const file of ['student.js','parent.js','classroom.js'])vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),ctx);
  const app=fs.readFileSync('dist/app.js','utf8');
  vm.runInContext(app.slice(0,app.indexOf('const roleParam=')),ctx);
  return ctx;
}
test('past schedule is distinct from completed or rescheduled attendance',()=>{
  const c=classroom(),before=Date.parse('2026-10-30T10:00:00Z'),after=Date.parse('2026-10-30T12:00:00Z');
  assert.equal(c.courseStatus(1,'teacher',before),'upcoming');
  assert.equal(c.courseStatus(1,'teacher',after),'past');
  vm.runInContext("state.assessments['Alex Lee|1']={attendance:'Rescheduled'}",c);
  assert.equal(c.courseStatus(1,'teacher',after),'rescheduled');
  vm.runInContext("state.assessments['Alex Lee|1']={attendance:'Present'}",c);
  assert.equal(c.courseStatus(1,'teacher',before),'completed');
});
test('timeline summaries exclude private notes and other students in family views',()=>{
  const c=classroom();
  vm.runInContext("state.assessments={'Alex Lee|1':{summary:'Shared recap',private:'PRIVATE'},'Jamie Chen|1':{summary:'OTHER STUDENT'}};parentSource='saved'",c);
  for(const view of ['student','parent']){
    const html=c.courseSummary(1,view);
    assert.match(html,/Shared recap/);assert.doesNotMatch(html,/PRIVATE|OTHER STUDENT|Jamie Chen|Sam Rivera/);
  }
  assert.match(c.courseSummary(1,'teacher'),/OTHER STUDENT/);
  assert.doesNotMatch(c.courseSummary(1,'teacher'),/PRIVATE/);
});
test('assignment status retains self-report and teacher assessment distinction',()=>{
  const c=classroom();
  vm.runInContext("state.plan[1]={homework:'Write a paragraph'};state.preparation['Alex Lee|1']={homework:true};state.assessments['Alex Lee|1']={homework:'Partial'};state.quizzes['Alex Lee|2']={score:0}",c);
  const html=c.courseAssignments(1,'student');
  assert.match(html,/Partial/);assert.match(html,/Teacher assessment/);assert.match(html,/Not submitted/);assert.doesNotMatch(html,/Submitted · 0/);
  assert.match(c.courseAssignments(2,'student'),/Submitted · 0\/4/);
});
test('meeting links accept https and reject executable, insecure or credential-bearing URLs',()=>{
  const c=classroom();
  assert.equal(c.courseZoomLink('https://example.zoom.us/j/123'),'https://example.zoom.us/j/123');
  for(const value of ['javascript:alert(1)','http://example.com','https://user:password@example.com','bad'])assert.equal(c.courseZoomLink(value),'');
});
test('course opens with twelve collapsed weeks and honors selected week on navigation',()=>{
  const c=classroom(),html=c.courseTimeline('teacher');
  assert.equal((html.match(/data-course-week=/g)||[]).length,12);
  assert.match(html,/Week 1 – October 30/);assert.match(html,/An Inspector Calls — Act II/);
  assert.doesNotMatch(html,/id="course-week-\d+" open/);
  vm.runInContext('timelineExpanded.add(7)',c);
  assert.match(c.courseTimeline('student'),/id="course-week-7" open/);
});
test('saved lesson text is escaped when rendered in the timeline',()=>{
  const c=classroom();vm.runInContext("state.plan[1]={title:'<script>bad()</script>',goal:'<img onerror=bad()>',homework:'<b>task</b>'};state.assessments['Alex Lee|1']={summary:'<script>private()</script>'}",c);
  const html=c.courseTimeline('teacher');
  assert.doesNotMatch(html,/<script>|<img onerror/);assert.match(html,/&lt;script&gt;bad/);
});
test('next class skips completed and elapsed lessons and ends at the final lesson',()=>{
  const c=classroom(),now=new Date('2026-10-31T00:00:00Z');
  assert.equal(c.familyNextLesson([],now),2);
  assert.equal(c.familyNextLesson([{lesson:4,attendance:'Present'}],now),5);
  assert.equal(c.familyNextLesson([{lesson:24,attendance:'Present'}],now),null);
  assert.equal(c.familyNextLesson([],new Date('2027-03-01T00:00:00Z')),null);
  assert.equal(c.familyNextLesson([{lesson:4,attendance:'Rescheduled'}],now),2);
});
test('assigned homework appears before assessment without claiming submission or timeliness',()=>{
  const c=classroom();
  vm.runInContext("state.plan[1]={homework:'Write a paragraph'};state.preparation['Alex Lee|1']={homework:true}",c);
  const record=c.dashboardHomeworkRecord([],2),html=c.dashboardHomework(record,'student');
  assert.equal(record.lesson,1);assert.match(html,/Write a paragraph/);
  assert.match(html,/Not recorded/);assert.doesNotMatch(html,/On time|Late|Complete|Submitted/);
});
test('student and parent time zones reach the timeline and configured meeting links work',()=>{
  const c=classroom();
  vm.runInContext("role='student';studentTimezone='UTC';state.plan[2]={zoom:'https://example.zoom.us/j/123'}",c);
  assert.equal(c.courseTime(2),'10:00 AM');
  // Location is only read to label the selected-lesson card.
  c.location={hash:''};
  assert.match(c.studentMeeting(2),/https:\/\/example.zoom.us\/j\/123/);
  assert.match(c.studentMeeting(2),/10:00 AM/);
  vm.runInContext("role='parent';parentTimezone='Asia/Bangkok'",c);
  assert.equal(c.courseTime(2),'5:00 PM');
});
