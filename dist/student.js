// Student workflow uses the same fictional, browser-local records as the teacher.
// Views are not authorization; production access must be enforced on the server.
const STUDENT_NAME = 'Alex Lee';
const STUDENT_SECTIONS = ['Discussion','Writing','Reflection','Homework'];
let studentLesson = 1, studentSection = 'Discussion', studentFeedbackWeek = 'all';
try {
  const view = JSON.parse(localStorage.getItem('inkwire-student-view-v1') || '{}');
  if(Number.isInteger(view?.lesson) && view.lesson>=1 && view.lesson<=24) studentLesson=view.lesson;
  if(STUDENT_SECTIONS.includes(view?.section)) studentSection=view.section;
} catch { /* Start with the first lesson. */ }
function studentKey(lesson) { return STUDENT_NAME+'|'+lesson; }
function studentPrep(data,lesson) {
  const record=data.preparation?.[studentKey(lesson)] || {};
  return {reading:typeof record.reading==='boolean'?record.reading:lesson===1 && data.read===true,
    homework:record.homework===true, quiz:data.quizzes?.[studentKey(lesson)] || null};
}
function studentReadiness(data,lesson) {
  const prep=studentPrep(data,lesson), available=lesson===1;
  return {...prep,quizAvailable:available,done:Number(prep.reading)+Number(available && !!prep.quiz),total:available?2:1};
}
function studentNoteCount(data) {
  return Object.entries(data.notes || {}).filter(([key,value])=>{
    const [name,lesson,section,...rest]=key.split('|');
    return name===STUDENT_NAME && !rest.length && Number.isInteger(Number(lesson)) && Number(lesson)>=1 && Number(lesson)<=24 && STUDENT_SECTIONS.includes(section) && typeof value==='string' && !!value.trim();
  }).length;
}
function studentExport(data,getPlan) {
  const pages=[];
  for(let lesson=1;lesson<=24;lesson++) for(const section of STUDENT_SECTIONS) {
    const note=data.notes?.[studentKey(lesson)+'|'+section];
    if(typeof note==='string' && note.trim()) pages.push('Week '+Math.ceil(lesson/2)+' · Lesson '+((lesson-1)%2+1)+' — '+getPlan(lesson).title+'\n'+section+'\n\n'+note);
  }
  return 'Ink Wire · Literature & the World\n'+STUDENT_NAME+' · My notebook\n\n'+(pages.join('\n\n────────────────────\n\n') || 'No notebook entries yet.');
}
function studentRemember() {
  try { localStorage.setItem('inkwire-student-view-v1',JSON.stringify({lesson:studentLesson,section:studentSection})); } catch { /* Navigation still works without storage. */ }
}
function studentLabel(lesson) { return 'Week '+Math.ceil(lesson/2)+' · Lesson '+((lesson-1)%2+1); }
function studentBefore(lesson) { return lesson===1?'Read Act 2 through Gerald’s departure. Bring one quotation and one question.':plan(lesson-1).reading; }
function studentGo(lesson,route='dashboard',section=studentSection) {
  if(!Number.isInteger(lesson)||lesson<1||lesson>24)return;
  if(route==='timeline'){timelineExpanded.clear();timelineExpanded.add(Math.ceil(lesson/2));}
  studentLesson=lesson;studentSection=STUDENT_SECTIONS.includes(section)?section:'Discussion';studentRemember();
  if(location.hash==='#'+route || (!location.hash && route==='dashboard')){render();window.scrollTo(0,0);}else location.hash=route;
}
function studentTop(title,description) {
  return '<div class="student-heading"><div><div class="eyebrow">YOUR LEARNING STUDIO</div><h1>'+title+'</h1><p>'+description+'</p></div><span class="student-program">12 weeks <span>·</span> 24 lessons</span></div>';
}
function studentFocus() {
  return '<div class="student-focus"><label for="student-lesson">Lesson in focus</label><select id="student-lesson">'+topics.map((_,i)=>'<option value="'+(i+1)+'" '+(studentLesson===i+1?'selected':'')+'>'+studentLabel(i+1)+' — '+esc(plan(i+1).title)+'</option>').join('')+'</select><span>Beijing / Shanghai · UTC+8</span></div>';
}
function studentAction(lesson,route,label,section='Discussion',classes='btn secondary') {
  return '<button type="button" class="'+classes+'" data-student-lesson="'+lesson+'" data-student-route="'+route+'" data-student-section="'+section+'">'+label+'</button>';
}
function studentCheck(lesson,field,label,description,checked) {
  return '<label class="student-check"><input type="checkbox" data-prep-lesson="'+lesson+'" data-prep-field="'+field+'" '+(checked?'checked':'')+'><span><strong>'+label+'</strong><span>'+esc(description)+'</span><small>'+(checked?'Marked complete by you':'Mark complete when you’re ready')+'</small></span></label>';
}
function studentTicket(lesson) {
  const ready=studentReadiness(state,lesson);
  return '<section class="card student-ticket"><div class="cardtop"><h2>Before class</h2><span class="family-chip '+(ready.done===ready.total?'good':'neutral')+'">'+ready.done+' of '+ready.total+' ready</span></div>'+studentCheck(lesson,'reading','Read & bring a question',studentBefore(lesson),ready.reading)+'<div class="student-quiz-task"><span class="student-task-icon" aria-hidden="true">'+(ready.quiz?'✓':'↗')+'</span><div><h3>Your ticket into class</h3><p>'+(ready.quizAvailable?(ready.quiz?'Quiz submitted · '+esc(ready.quiz.score)+'/4. Bring your question to the conversation.':'Four reading questions and one reflection. Completion counts, whatever your score.'):'Your teacher has not added a quiz for this lesson yet.')+'</p>'+(ready.quizAvailable?studentAction(lesson,'quiz',ready.quiz?'Review my quiz →':'Take the preparation quiz →','Discussion','link text-button'):'<span class="family-chip neutral">Not assigned yet</span>')+'</div></div></section>';
}
function studentMeeting(lesson) {
  const date=familySampleDate(lesson),opts={timeZone:'Asia/Shanghai'};
  return '<section class="card student-meeting"><div class="eyebrow">LIVE LESSON · SAMPLE SCHEDULE</div><div class="student-date"><strong>'+new Intl.DateTimeFormat('en-US',{...opts,weekday:'long',month:'short',day:'numeric'}).format(date)+'</strong><span>'+new Intl.DateTimeFormat('en-US',{...opts,hour:'numeric',minute:'2-digit'}).format(date)+'</span></div><p>90 minutes · Beijing / Shanghai</p><button class="btn wide" disabled>Zoom link not set</button><small>Illustrative time only. Your teacher will confirm your schedule and individual class link.</small></section>';
}
function studentWeeks() {
  return '<div class="student-weeks" aria-label="Choose a week">'+Array.from({length:12},(_,i)=>'<button type="button" data-student-lesson="'+(i*2+1)+'" data-student-route="timeline" aria-pressed="'+(Math.ceil(studentLesson/2)===i+1)+'"><small>WEEK</small><strong>'+String(i+1).padStart(2,'0')+'</strong></button>').join('')+'</div>';
}
function studentRecap(record,compact=false) {
  if(!record)return '<section class="card student-empty"><div class="eyebrow">AFTER THE LESSON</div><h2>Lesson feedback</h2><p>Your teacher’s lesson recap, success, and next step will appear here after a review.</p><a class="link" href="#feedback">Visit my feedback →</a></section>';
  return '<article class="card student-review"><div class="cardtop"><span class="eyebrow">'+studentLabel(record.lesson)+'</span><span class="family-chip neutral">Teacher review</span></div><h2>'+esc(plan(record.lesson).title)+'</h2>'+(record.summary?'<div class="student-recap"><h3>What we explored</h3><p>'+esc(record.summary)+'</p></div>':'')+'<div class="student-note success"><h3>A success to build on</h3><p>'+esc(record.success||'Your teacher has not added a success note yet.')+'</p></div><div class="student-note next"><h3>Your next step</h3><p>'+esc(record.next||'Your teacher has not added a next step yet.')+'</p></div>'+(!compact?'<dl class="student-observations">'+Object.entries(FAMILY_LABELS).map(([key,label])=>'<div><dt>'+label+'</dt><dd>'+familyChip(record[key])+'</dd></div>').join(''):'')+studentAction(record.lesson,'notebook','Reflect in my notebook →','Reflection','link text-button')+'</article>';
}
function studentDashboard() {
  const p=plan(studentLesson),reviews=familyRecords(state.assessments),notes=studentNoteCount(state),ready=studentReadiness(state,studentLesson);
  return studentTop('Welcome back, Alex.','Literature & the World · Your lessons and assignments.')+studentFocus()+
    '<section class="student-hero"><div><span class="eyebrow">LITERATURE & THE WORLD</span><h2>Current lesson</h2><p>'+studentLabel(studentLesson)+' · '+esc(p.title)+'</p>'+studentAction(studentLesson,'notebook','Open my notebook ↗',studentSection,'btn light')+'</div><div class="student-hero-note"><span class="eyebrow">OUR LEARNING GOAL</span><p>'+esc(p.goal)+'</p><span class="student-teacher">WITH MATTHEW GILFILLAN</span></div></section>'+
    '<div class="student-stats"><a class="card" href="#tasks"><span>Preparation in focus</span><strong>'+ready.done+' <small>/ '+ready.total+'</small></strong><p>Items marked ready →</p></a><a class="card" href="#notebook"><span>Ideas in your notebook</span><strong>'+notes+'</strong><p>Pages with your writing →</p></a><a class="card" href="#feedback"><span>Feedback to build on</span><strong>'+reviews.length+'</strong><p>Lesson reviews →</p></a></div>'+
    '<div class="student-columns"><div>'+studentTicket(studentLesson)+'<div class="student-section-title"><h2>From your teacher</h2><a class="link" href="#feedback">All feedback →</a></div>'+studentRecap(reviews[0],true)+'</div><aside>'+studentMeeting(studentLesson)+'<section class="card student-lavender"><span class="eyebrow">AFTER THIS LESSON</span><h2>Reading assignment</h2><p>'+esc(p.reading)+'</p><a class="link" href="#tasks">Reading & tasks →</a></section></aside></div>'+
    '<section class="card"><div class="cardtop"><h2>Course timeline</h2><a class="link" href="#timeline">Explore the plan →</a></div>'+studentWeeks()+'<p class="student-small">An Inspector Calls → Lord of the Flies · Two lessons each week.</p></section>';
}
function studentTimeline(){return courseTimeline('student');}
function studentTasks() {
  const p=plan(studentLesson),prep=studentPrep(state,studentLesson),next=studentLesson+1;
  return studentTop('Reading & assignments','Your reading and assignments, one lesson at a time.')+studentFocus()+'<div class="student-columns"><div>'+studentTicket(studentLesson)+'<section class="card"><div class="eyebrow">FOLLOW-UP READING</div><h2>'+ (next<=24?'Prepare for '+studentLabel(next):'Your final reflection')+'</h2><p>'+esc(p.reading)+'</p>'+(next<=24?studentCheck(next,'reading','I’ve finished the follow-up reading','This also updates reading readiness for the following lesson.',studentPrep(state,next).reading):studentAction(studentLesson,'notebook','Write my final reflection →','Reflection'))+'</section><section class="card"><div class="eyebrow">WRITTEN HOMEWORK</div><h2>Written homework</h2>'+(p.homework?studentCheck(studentLesson,'homework','My homework is ready',p.homework,prep.homework)+'<p class="student-small">This is your own checklist. It does not submit your work or change your teacher’s assessment.</p>':'<p class="muted">No written homework has been assigned to this lesson yet.</p>')+studentAction(studentLesson,'notebook','Open homework page →','Homework','link text-button')+'</section></div><aside>'+studentMeeting(studentLesson)+'<section class="card student-lavender"><h2>Something unclear?</h2><p>Save a question in your notebook to bring to the lesson.</p>'+studentAction(studentLesson,'notebook','Write a question →','Discussion','link text-button')+'</section></aside></div>';
}
function studentNotebook() {
  const p=plan(studentLesson),key=studentKey(studentLesson)+'|'+studentSection,text=state.notes[key]||'',prompts={Discussion:'Record a question, a quotation reference, and your interpretation.',Writing:'Build your PEEEL paragraph: point, evidence, explanation, exploration, and link.',Reflection:'What changed in your understanding? What will you try next?',Homework:'Draft your homework here and record any revisions after feedback.'};
  return studentTop('Course notebook','A notebook for questions, connections, and the writing that follows.')+notebookControls()+(notebookMode==='local'?'<div class="student-notebook-bar"><span class="student-small">Browser notes</span><button type="button" id="student-export" class="btn secondary">Download my notebook ↓</button></div>':'')+'<div class="student-notebook-layout"><aside class="student-page-list"><h2>Course notebook</h2>'+Array.from({length:12},(_,i)=>'<div class="student-page-group"><h3>Week '+(i+1)+'</h3>'+[i*2+1,i*2+2].map(n=>'<button type="button" data-student-lesson="'+n+'" data-student-route="notebook" '+(n===studentLesson?'aria-current="page"':'')+'><span>'+((n-1)%2+1)+'</span>'+esc(plan(n).title)+'</button>').join('')+'</div>').join('')+'</aside><div class="student-notebook-content"><div class="student-notebook-title"><span class="eyebrow">'+studentLabel(studentLesson)+'</span><h2>'+esc(p.title)+'</h2><p>'+esc(p.goal)+'</p></div><div class="student-notebook-tabs" aria-label="Notebook sections">'+STUDENT_SECTIONS.map(s=>'<button type="button" data-student-tab="'+s+'" aria-pressed="'+(studentSection===s)+'">'+s+'</button>').join('')+'</div><section class="card student-writing"><div class="cardtop"><h2>'+studentSection+'</h2><span id="student-save-status" role="status">'+(text?'Saved in this browser':'A fresh page')+'</span></div><p>'+prompts[studentSection]+'</p>'+(studentSection==='Homework'&&p.homework?'<div class="notice"><b>Assignment:</b> '+esc(p.homework)+'</div>':'')+'<div class="formlabel">Your '+studentSection.toLowerCase()+' notes</div><div id="student-editor-toolbar" class="notebook-toolbar" role="group" aria-label="Text formatting"></div><div id="student-editor"></div><div class="student-writing-footer"><span id="student-word-count">'+studentWordCount(text)+' words</span><span>'+ (notebookMode==='shared'?'Student and teacher edits appear together.':'Only your browser notes are included in the notebook download.') +'</span></div></section></div></div>';
}
function studentWordCount(text) { return typeof text==='string' && text.trim()?text.trim().split(/\s+/).length:0; }
function studentQuiz() {
  if(studentLesson===1)return studentFocus()+quiz();
  return studentTop('Your ticket into class.','A short reading check before the conversation.')+studentFocus()+'<section class="card student-empty"><span class="eyebrow">'+studentLabel(studentLesson)+'</span><h2>No quiz assigned yet.</h2><p>You can prepare your reading and bring a question. This preview includes a working quiz for Week 1, Lesson 1.</p>'+studentAction(1,'quiz','Try the Lesson 1 quiz →')+'</section>'+studentTicket(studentLesson);
}
function studentFeedback() {
  const records=familyRecords(state.assessments),filtered=records.filter(r=>studentFeedbackWeek==='all'||Math.ceil(r.lesson/2)===Number(studentFeedbackWeek));
  return studentTop('Teacher feedback','Class summaries, assessments and next steps.')+'<div class="student-feedback-filter"><p>'+records.length+' lesson review'+(records.length===1?'':'s')+' from your teacher</p><label for="student-feedback-week">Show</label><select id="student-feedback-week"><option value="all">All weeks</option>'+Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'" '+(studentFeedbackWeek===String(i+1)?'selected':'')+'>Week '+(i+1)+'</option>').join('')+'</select></div>'+(filtered.length?filtered.map(r=>studentRecap(r)).join(''):'<section class="card student-empty"><h2>No feedback '+(studentFeedbackWeek==='all'?'yet.':'for this week yet.')+'</h2><p>Your teacher’s recap, observations, and next steps will appear after a lesson review.</p><a class="btn secondary" href="#notebook">Keep exploring your notebook →</a></section>');
}
function bindStudentEvents() {
  if(role!=='student')return;
  $('#student-lesson')?.addEventListener('change',e=>{studentLesson=Number(e.target.value);studentRemember();render();$('#student-lesson')?.focus();});
  document.querySelectorAll('[data-student-lesson]').forEach(b=>b.addEventListener('click',()=>studentGo(Number(b.dataset.studentLesson),b.dataset.studentRoute,b.dataset.studentSection||studentSection)));
  document.querySelectorAll('[data-student-tab]').forEach(b=>b.addEventListener('click',()=>{studentSection=b.dataset.studentTab;studentRemember();render();document.querySelector('[data-student-tab="'+studentSection+'"]')?.focus();}));
  document.querySelectorAll('[data-prep-field]').forEach(input=>input.addEventListener('change',()=>{
    const key=studentKey(Number(input.dataset.prepLesson)),field=input.dataset.prepField,previous=state.preparation?.[key];
    state.preparation ||= {};state.preparation[key]={...previous,[field]:input.checked};
    if(save()){render();document.querySelector('[data-prep-lesson="'+input.dataset.prepLesson+'"][data-prep-field="'+field+'"]')?.focus();}
    else {if(previous)state.preparation[key]=previous;else delete state.preparation[key];input.checked=!input.checked;}
  }));
  if($('#student-editor')) mountNotebookEditor('student-editor','student-editor-toolbar',studentKey(studentLesson)+'|'+studentSection,'student-save-status','student-word-count','Your '+studentSection.toLowerCase()+' notes');
  $('#student-export')?.addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([studentExport(state,plan)],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='inkwire-my-notebook.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your notebook download is ready.');
  });
  $('#student-feedback-week')?.addEventListener('change',e=>{studentFeedbackWeek=e.target.value;render();$('#student-feedback-week')?.focus();});
}
