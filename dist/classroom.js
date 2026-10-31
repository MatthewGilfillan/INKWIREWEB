// Compact course navigation. All records here remain fictional browser-local demo data.
const CLASSROOM_STUDENTS = ['Alex Lee', 'Jamie Chen', 'Sam Rivera'];
const timelineExpanded = new Set();
function courseHeading(title, subtitle) {
  return '<div class="course-heading"><div><h1>'+title+'</h1><p>'+subtitle+'</p></div>'+(role==='student'?dashboardTimezone('student-timezone',studentTimezone):'<span class="course-meta">Beijing / Shanghai · UTC+8</span>')+'</div>';
}
function courseDate(n, long=false) {
  return new Intl.DateTimeFormat('en-US',{timeZone:courseTimezone(),month:long?'long':'short',day:'numeric'}).format(familySampleDate(n));
}
function courseTopic(n) {
  if(n<=2)return 'An Inspector Calls — Act II';
  if(n<=5)return 'An Inspector Calls — Act III';
  if(n===6)return 'An Inspector Calls — Text comparison';
  if(n>=22)return 'An Inspector Calls & Lord of the Flies';
  const chapters=[1,1,2,3,4,4,5,6,7,8,9,9,10,11,12];
  return 'Lord of the Flies — Chapter '+chapters[n-7];
}
function courseRecords(n, view=role) {
  if(view==='parent' && parentSource==='sample')return FAMILY_SAMPLE[n] ? [{name:'Alex Lee',...FAMILY_SAMPLE[n]}] : [];
  const names=view==='teacher'?CLASSROOM_STUDENTS:['Alex Lee'];
  return names.flatMap(name=>{const record=familyRecords(state.assessments,name).find(r=>r.lesson===n);return record?[{name,...record}]:[];});
}
function courseStatus(n, view=role, now=Date.now()) {
  const records=courseRecords(n,view);
  if(records.some(r=>r.attendance==='Present'))return 'completed';
  if(records.length && records.every(r=>r.attendance==='Rescheduled'))return 'rescheduled';
  return familySampleDate(n).getTime()+90*60*1000<=now?'past':'upcoming';
}
function courseStatusLabel(status) {return {completed:'Completed',past:'Past class',upcoming:'Upcoming',rescheduled:'Rescheduled'}[status];}
function courseIsPast(n,view=role) {return ['completed','past'].includes(courseStatus(n,view));}
function courseNextLesson() {return Array.from({length:24},(_,i)=>i+1).find(n=>!courseIsPast(n,'teacher'))||24;}
function courseZoomLink(value) {
  try {const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password ? url.href : '';} catch {return '';}
}
function courseAction(n,route,label,learner='Alex Lee',classes='btn secondary') {
  return '<button type="button" class="'+classes+'" data-course-lesson="'+n+'" data-course-route="'+route+'" data-course-student="'+esc(learner)+'">'+label+'</button>';
}
function teacherDashboard() {
  const next=courseNextLesson(),p=plan(next),reviewed=Array.from({length:24},(_,i)=>courseRecords(i+1,'teacher')).filter(r=>r.length).length;
  return courseHeading('Active classes','1 class · Autumn semester')+
    '<p class="course-demo">Demo · Fictional students and sample dates. Changes save in this browser.</p>'+
    '<details class="active-class"><summary><span class="class-icon" aria-hidden="true">▤</span><span class="class-summary"><strong>Literature & the World</strong><span>An Inspector Calls → Lord of the Flies</span><small>3 demo students · 12 weeks · 24 lessons</small></span><span class="class-next"><small>Next scheduled lesson</small><b>'+courseDate(next,true)+' · '+courseTime(next)+'</b><span>'+esc(p.title)+'</span></span><span class="disclosure-icon" aria-hidden="true">+</span></summary><div class="active-class-body"><div class="class-overview"><div><span class="eyebrow">NEXT LESSON</span><h2>'+courseTopic(next)+'</h2><p>'+esc(p.title)+'</p></div><a href="#timeline" class="btn">Open course timeline →</a></div><div class="class-actions">'+courseAction(next,'notebook','Open notebook')+courseAction(next,'assessment','Post-lesson assessment')+'<span>'+reviewed+' of 24 lessons have feedback</span></div><details class="course-disclosure"><summary>Students <span>3 enrolled</span></summary><div class="class-roster">'+CLASSROOM_STUDENTS.map(name=>'<div><span><b>'+esc(name)+'</b><small>Demo student</small></span>'+courseAction(next,'assessment','View assessment',name,'link text-button')+'</div>').join('')+'</div></details></div></details>'+
    '<div class="teacher-shortcuts"><a href="#timeline"><b>Course timeline</b><span>Weeks, lesson details and assignments →</span></a><a href="#assessment"><b>Post-lesson assessments</b><span>Attendance, homework and feedback →</span></a></div>';
}
function coursePreparation(n, name, view) {
  if(view==='parent' && parentSource==='sample')return familyPreparation('sample',n,state);
  const entry=state.preparation?.[name+'|'+n]||{};
  return {reading:typeof entry.reading==='boolean'?entry.reading:name==='Alex Lee'&&n===1?!!state.read:null,homework:entry.homework===true,quiz:state.quizzes?.[name+'|'+n]||null};
}
function courseAssignments(n,view) {
  const names=view==='teacher'?CLASSROOM_STUDENTS:['Alex Lee'],records=courseRecords(n,view);
  return '<div class="course-table-wrap"><table class="course-table"><caption>Assignment status</caption><thead><tr><th scope="col">Student</th><th scope="col">Reading</th><th scope="col">Preparation quiz</th><th scope="col">Homework</th></tr></thead><tbody>'+names.map(name=>{
    const prep=coursePreparation(n,name,view),review=records.find(r=>r.name===name);
    const homework=review?.homework || (plan(n).homework ? (prep.homework?'Marked complete by student':'Not marked complete'):'Not assigned');
    return '<tr><th scope="row">'+esc(name)+'</th><td>'+familyChip(prep.reading===true?'Marked complete':prep.reading===false?'Not marked complete':'Not recorded')+'</td><td>'+familyChip(prep.quiz?'Submitted · '+prep.quiz.score+'/4':n===1?'Not submitted':'Not assigned')+'</td><td>'+familyChip(homework)+(review?.homework?'<small>Teacher assessment</small>':'')+'</td></tr>';
  }).join('')+'</tbody></table></div><p class="course-small">Reading checkmarks are student-reported. Unrecorded work is not treated as incomplete.</p>';
}
function courseSummary(n,view) {
  const records=courseRecords(n,view);
  return '<section class="course-recap"><h3>Class summary</h3>'+(records.some(r=>r.summary)?records.filter(r=>r.summary).map(r=>'<p>'+(view==='teacher'?'<b>'+esc(r.name)+'</b><br>':'')+esc(r.summary)+'</p>').join(''):'<p class="muted">No class summary has been added yet.</p>')+'</section>'+courseAssignments(n,view);
}
function courseLesson(n, view) {
  const p=plan(n),status=courseStatus(n,view),past=courseIsPast(n,view),zoom=courseZoomLink(p.zoom);
  return '<article class="course-lesson '+(past?'is-past':'')+'"><div class="course-lesson-heading"><div><span class="eyebrow">LESSON '+((n-1)%2+1)+' · '+courseDate(n)+' · '+courseTime(n)+'</span><h3>'+esc(p.title)+'</h3></div><span class="course-status '+status+'">'+courseStatusLabel(status)+'</span></div>'+
    (past?courseSummary(n,view):'')+
    (past?'<details class="course-disclosure"><summary>Lesson plan & resources</summary><div class="course-resource-body">':'<div class="course-resource-body">')+
    '<div class="course-resource-grid"><section><h3>Learning goals</h3><p>'+esc(p.goal)+'</p></section><section><h3>Reading before class</h3><p>'+esc(studentBefore(n))+'</p></section><section><h3>Assignments after class</h3><p>'+esc(p.reading)+'</p>'+(p.homework?'<p><b>Written homework:</b> '+esc(p.homework)+'</p>':'<p class="course-small">No written homework assigned.</p>')+'</section><section><h3>Preparation quiz</h3><p>'+(n===1?'Four reading questions and one reflection.':'No quiz assigned yet.')+'</p>'+(n===1 && view!=='parent'?courseAction(n,'quiz',view==='teacher'?'View preparation quiz':'Open preparation quiz'):'')+'</section></div><div class="course-lesson-actions"><div><h3>Zoom lesson</h3>'+(zoom?'<a class="btn light" href="'+esc(zoom)+'" target="_blank" rel="noopener noreferrer">Join Zoom ↗</a>':'<button class="btn secondary" disabled>Zoom link not set</button>')+'</div>'+(view!=='parent'?courseAction(n,'notebook','Open notebook →'):'')+'</div></div>'+(past?'</details>':'')+
    (view==='teacher'?'<div class="course-teacher-actions">'+courseAction(n,'assessment',past?'Edit assessment & summary':'Assessment & lesson settings')+(past?'': '<details class="course-disclosure"><summary>Student preparation</summary>'+courseAssignments(n,view)+'</details>')+'</div>':'')+
    (view==='parent'?'<button type="button" class="link text-button course-question" data-family-contact="'+n+'">Ask Matthew about this lesson →</button>':'')+'</article>';
}
function courseTimeline(view=role) {
  if(view==='parent')familyModel();
  const top=view==='parent'?familyTop('Course timeline','Literature & the World · 12 weeks · 24 lessons'):courseHeading('Course timeline','Literature & the World · 12 weeks · 24 lessons');
  return top+'<div class="course-timeline-tools"><label for="course-jump">Go to week<select id="course-jump"><option value="">Choose a week</option>'+Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'">Week '+(i+1)+' — '+courseDate(i*2+1)+'</option>').join('')+'</select></label><p>Sample schedule · Starts October 30, 2026<br>Expand a week to see its lessons.</p><button class="link text-button" id="course-collapse">Collapse all</button></div><div class="course-timeline">'+Array.from({length:12},(_,i)=>{
    const n=i*2+1,past=[n,n+1].filter(l=>courseIsPast(l,view)).length;
    const nowDate=new Date(),inWeek=nowDate>=familySampleDate(n)&&nowDate<new Date(familySampleDate(n).getTime()+7*86400000);
    return '<details class="course-week '+(past===2?'is-past':inWeek?'is-current':'')+'" data-course-week="'+(i+1)+'" id="course-week-'+(i+1)+'" '+(timelineExpanded.has(i+1)?'open':'')+'><summary><span class="week-heading"><strong>Week '+(i+1)+' – '+courseDate(n,true)+'</strong><span>'+courseTopic(n)+'</span>'+(courseTopic(n)!==courseTopic(n+1)?'<span>'+courseTopic(n+1)+'</span>':'')+'<small>'+esc(plan(n).title)+' · '+esc(plan(n+1).title)+'</small></span><span class="week-meta"><span class="course-status '+(past===2?'past':inWeek?'current':'upcoming')+'">'+(past===2?'Past classes':past===1?'1 past · 1 upcoming':inWeek?'This week':'Upcoming')+'</span><span class="week-expand"><span class="when-closed">View lessons</span><span class="when-open">Close week</span><span class="disclosure-icon" aria-hidden="true">+</span></span></span></summary><div class="course-week-body">'+courseLesson(n,view)+courseLesson(n+1,view)+'</div></details>';
  }).join('')+'</div>';
}
function teacherQuiz() {
  return courseHeading('Preparation quiz','Week 1 · Lesson 1 · An Inspector Calls — Act II')+'<p><a class="link" href="#timeline">← Course timeline</a></p><section class="card"><h2>Student questions</h2><ol class="teacher-quiz-questions">'+questions.map(q=>'<li><h3>'+esc(q.q)+'</h3><ul>'+q.options.map(o=>'<li>'+esc(o)+'</li>').join('')+'<details class="course-disclosure"><summary>Answer & explanation</summary><p>'+esc(q.options[q.answer])+'<br>'+esc(q.why)+'</p></details></li>').join('')+'</ol><h3>Reflection</h3><p>What would you like to discuss in class?</p></section>'+courseAssignments(1,'teacher');
}
function bindCourseEvents() {
  document.querySelectorAll('[data-course-week]').forEach(details=>details.addEventListener('toggle',()=>{const n=Number(details.dataset.courseWeek);if(details.open)timelineExpanded.add(n);else timelineExpanded.delete(n);}));
  $('#course-jump')?.addEventListener('change',e=>{const el=$('#course-week-'+e.target.value);if(el){el.open=true;el.scrollIntoView({block:'start'});el.querySelector('summary').focus();}});
  $('#course-collapse')?.addEventListener('click',()=>{document.querySelectorAll('[data-course-week]').forEach(el=>el.open=false);timelineExpanded.clear();});
  document.querySelectorAll('[data-course-lesson]').forEach(button=>button.addEventListener('click',()=>{
    const n=Number(button.dataset.courseLesson),route=button.dataset.courseRoute;
    if(role==='student'){studentGo(n,route);return;}
    week=n;student=button.dataset.courseStudent;
    if(location.hash==='#'+route)render();else location.hash=route;
  }));
}

function courseTimezone() {return role==='parent'?parentTimezone:role==='student'?studentTimezone:'Asia/Shanghai';}
function courseTime(n) {return new Intl.DateTimeFormat('en-US',{timeZone:courseTimezone(),hour:'numeric',minute:'2-digit'}).format(familySampleDate(n));}
