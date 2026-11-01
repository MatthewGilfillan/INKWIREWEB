const {test}=require('node:test');
const assert=require('node:assert/strict');
test('generated content cannot alter schedule, sections or activity-mode lesson content',async()=>{
  const {defaults,generateLessons}=await import('../dist/course-model.mjs');
  const {applyPlanningResult,planningInput}=await import('../cloudflare/planning-assistant.mjs');
  const course={...defaults('Upper primary'),preset:'upper-primary',includeWritingActivity:true};course.lessons=generateLessons(course);
  const response={description:'Generated overview',reviewNotes:'Verify text details.',lessons:course.lessons.map((l,i)=>({number:i+1,title:'Lesson '+(i+1),goal:'A clear goal',reading:'A passage',homework:'A response',skills:'Reading',activities:'A timed activity',evidence:'An exit response',date:'2000-01-01',section:'Wrong section'}))};
  const result=applyPlanningResult(course,'course',0,response);
  assert.equal(result.course.lessons[0].section,'About the author · pre-reading');assert.equal(result.course.lessons[14].section,'Section 8 · writing activity');
  assert.equal(result.course.startTime,course.startTime);assert.equal(result.course.lessonMinutes,course.lessonMinutes);assert.equal(result.course.lessons[0].date,course.lessons[0].date);
  assert.equal(planningInput(course,'activities',4,'A teacher brief').lessons[0].number,5);
  for (const changed of [{...response,lessons:[]},{...response,lessons:[...response.lessons].reverse()},{...response,lessons:response.lessons.map(l=>({...l,activities:'x'.repeat(4001)}))}])assert.throws(()=>applyPlanningResult(course,'course',0,changed));
});
