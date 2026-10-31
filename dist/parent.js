// Parent-facing projections use an explicit field list. This is presentation filtering,
// not access control: production roles and private notes must be enforced on a server.
const FAMILY_FIELDS = ['attendance','homework','homeworkTiming','preparation','attitude','participation','focus','learning','summary','success','next'];
const FAMILY_LABELS = {attendance:'Attendance',homework:'Homework',homeworkTiming:'Homework timing',preparation:'Preparation',attitude:'Attitude',participation:'Participation',focus:'Effort & focus',learning:'Learning goals'};
const FAMILY_SAMPLE = {
  1:{attendance:'Present',homework:'Complete',preparation:'Ready',attitude:'Engaged',participation:'Contributes constructively',focus:'Sustained',learning:'Developing',success:'You noticed how Sheila’s response changes as she learns more about Gerald. You supported your interpretation with a well-chosen quotation.',next:'After each quotation, explain what the reader learns about the character.'},
  2:{attendance:'Present',homework:'Partial',preparation:'Partly ready',attitude:'Responds to encouragement',participation:'Contributes with prompting',focus:'Inconsistent',learning:'Developing',success:'You connected Mrs. Birling’s choices with the idea of responsibility and listened carefully to another interpretation.',next:'Finish the reading before class and mark two passages you want to discuss.'},
  3:{attendance:'Present',homework:'Complete',preparation:'Ready',attitude:'Engaged',participation:'Contributes constructively',focus:'Sustained',learning:'Developing',success:'Your paragraph used a clear point and relevant evidence to explain Eric’s responsibility.',next:'Develop the exploration: why might Priestley want his audience to question this behavior?'},
  4:{attendance:'Present',homework:'Complete',homeworkTiming:'On time',summary:'Alex explained how the Inspector’s language encourages shared responsibility, using a clear point and relevant evidence.',preparation:'Ready',attitude:'Engaged',participation:'Contributes constructively',focus:'Sustained',learning:'Secure',success:'You explained how the Inspector’s language encourages a sense of shared responsibility. Your evidence and explanation worked together.',next:'Carry that precision into a comparison of Birling’s speech and the Inspector’s message.'}
};
let parentSource = null;
let parentWeek = 3;
const FAMILY_TIMEZONES = {'Asia/Shanghai':'Beijing / Shanghai','Asia/Bangkok':'Bangkok','UTC':'UTC'};
let parentTimezone = 'Asia/Shanghai';
try { const savedZone=localStorage.getItem('inkwire-timezone'); if(FAMILY_TIMEZONES[savedZone])parentTimezone=savedZone; } catch {}
let parentFeedbackWeek = 'all';
let parentContactLesson = 0;
let parentRead = {};
try { parentRead = JSON.parse(localStorage.getItem('inkwire-parent-read-v1') || '{}') || {}; } catch { /* Use an empty read history. */ }

function familyRecords(assessments, learner = 'Alex Lee') {
  return Object.entries(assessments || {}).flatMap(([key,value]) => {
    const [name,number,...rest] = key.split('|');
    const lesson = Number(number);
    if(name !== learner || rest.length || !Number.isInteger(lesson) || lesson < 1 || lesson > 24 || !value || typeof value !== 'object') return [];
    if(!FAMILY_FIELDS.some(field=>typeof value[field]==='string' && value[field].trim())) return [];
    const record = {lesson};
    FAMILY_FIELDS.forEach(field => { if(typeof value[field] === 'string') record[field] = value[field]; });
    return [record];
  }).sort((a,b) => b.lesson-a.lesson);
}
function familyReadKey(record, source) {
  // A changed family-visible assessment becomes unread again. Private edits do not.
  return source+'|Alex Lee|'+record.lesson+'|'+JSON.stringify(FAMILY_FIELDS.map(field=>record[field] || ''));
}
function familyMetrics(records) {
  const assigned = records.filter(r=>['Complete','Partial','Not submitted'].includes(r.homework));
  const attended = records.filter(r=>r.attendance === 'Present').length;
  const attendanceRecorded = records.filter(r=>['Present','Absent'].includes(r.attendance)).length;
  return {reviewed:records.length,assigned:assigned.length,complete:assigned.filter(r=>r.homework==='Complete').length,attended,attendanceRecorded};
}
function familyPreparation(source, lesson, data) {
  if(source==='sample') return {reading:lesson<=5 ? true : null, quiz:lesson<=4 ? {score:lesson===2?3:4} : null};
  const reading=data.preparation?.['Alex Lee|'+lesson]?.reading;
  return {reading:typeof reading==='boolean'?reading:lesson===1 ? !!data.read : null, quiz:data.quizzes?.['Alex Lee|'+lesson] || null};
}
function familySampleDate(lesson) {
  const weekIndex = Math.floor((lesson-1)/2);
  return new Date(Date.UTC(2026,9,30+weekIndex*7+(lesson%2===0?2:0),10,0));
}
function familyDate(lesson) {
  return new Intl.DateTimeFormat('en-US',{timeZone:parentTimezone,weekday:'short',month:'short',day:'numeric'}).format(familySampleDate(lesson));
}
function familyTime(lesson) {
  return new Intl.DateTimeFormat('en-US',{timeZone:parentTimezone,hour:'numeric',minute:'2-digit'}).format(familySampleDate(lesson));
}
function familyModel() {
  const saved = familyRecords(state.assessments);
  if(!parentSource) {
    parentSource = saved.length || state.read || Object.keys(state.preparation||{}).some(key=>/^Alex Lee\|([1-9]|1[0-9]|2[0-4])$/.test(key)) || state.quizzes?.['Alex Lee|1'] ? 'saved' : 'sample';
    parentWeek = parentSource==='sample' ? 3 : 1;
  }
  const records = parentSource==='sample' ? Object.entries(FAMILY_SAMPLE).map(([lesson,r])=>({lesson:Number(lesson),...r})).reverse() : saved;
  return {records,metrics:familyMetrics(records),firstLesson:(parentWeek-1)*2+1,unread:records.filter(r=>!parentRead[familyReadKey(r,parentSource)]).length};
}
function familyChip(value) {
  const positive = ['Present','Complete','Ready','Engaged','Contributes constructively','Sustained','Secure','Submitted','On time'];
  const support = ['Partial','Partly ready','Responds to encouragement','Contributes with prompting','Inconsistent','Developing','Needs support','Not submitted','Unprepared','Frequent redirection','Absent','Late'];
  const tone = positive.includes(value) ? 'good' : support.includes(value) ? 'support' : 'neutral';
  return '<span class="family-chip '+tone+'">'+esc(value || 'Not recorded')+'</span>';
}
function familyTop(title,description) {
  familyModel();
  return '<div class="family-heading"><div><h1>'+title+'</h1><p>Alex Lee · '+description+'</p></div>'+dashboardTimezone('family-timezone',parentTimezone)+'</div><div class="dashboard-demo"><span>Demo · Fictional learner · '+(parentSource==='sample'?'Illustrative records and dates':'Work saved in this browser')+'</span><details class="preview-options"><summary>Preview options</summary><label for="family-source">Show records from</label><select id="family-source"><option value="sample" '+(parentSource==='sample'?'selected':'')+'>Illustrative example</option><option value="saved" '+(parentSource==='saved'?'selected':'')+'>Work saved in this browser</option></select></details></div>';
}

function familyWeekSelect() {
  return '<label class="family-week-select">Week<select id="family-week">'+Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'" '+(parentWeek===i+1?'selected':'')+'>Week '+(i+1)+'</option>').join('')+'</select></label>';
}
function familyWeekStrip(records, compact=false) {
  return '<div class="family-weeks '+(compact?'compact':'')+'" aria-label="Choose a program week">'+Array.from({length:12},(_,i)=>{
    const n=i+1, count=records.filter(r=>Math.ceil(r.lesson/2)===n).length;
    return '<button type="button" data-family-week="'+n+'" aria-pressed="'+(parentWeek===n)+'" aria-label="Week '+n+', '+count+' lessons reviewed" class="'+(parentWeek===n?'selected':'')+'"><span>'+String(n).padStart(2,'0')+'</span><small>'+(count===2?'Reviewed':count===1?'1 review':'Planned')+'</small></button>';
  }).join('')+'</div>';
}
function familyReadButton(record) {
  const seen=!!parentRead[familyReadKey(record,parentSource)];
  return '<button type="button" class="btn secondary" data-family-read="'+record.lesson+'" '+(seen?'disabled':'')+'>'+(seen?'✓ Read':'Mark as read')+'</button>';
}
function familyReport(record, expanded=false) {
  const seen=!!parentRead[familyReadKey(record,parentSource)];
  return '<details class="family-report card" '+(expanded?'open':'')+'><summary><div><span class="eyebrow">WEEK '+Math.ceil(record.lesson/2)+' · LESSON '+((record.lesson-1)%2+1)+'</span><h3>'+esc(plan(record.lesson).title)+'</h3></div><span class="family-report-status">'+(seen?'Read':'<span class="unread-dot"></span> New feedback')+'</span></summary><div class="family-report-body">'+(record.summary?'<div class="family-note"><span class="eyebrow">LESSON RECAP</span><p>'+esc(record.summary)+'</p></div>':'')+'<dl class="family-observations">'+Object.entries(FAMILY_LABELS).map(([key,label])=>'<div><dt>'+label+'</dt><dd>'+familyChip(record[key])+'</dd></div>').join('')+'</dl><div class="family-note success"><span class="eyebrow">SUCCESS</span><p>'+esc(record.success || 'Your teacher has not added a success note yet.')+'</p></div><div class="family-note next"><span class="eyebrow">NEXT STEP</span><p>'+esc(record.next || 'Your teacher has not added a next step yet.')+'</p></div><div class="family-report-actions">'+familyReadButton(record)+'<button type="button" class="link text-button" data-family-contact="'+record.lesson+'">Ask Matthew about this lesson ↗</button></div></div></details>';
}
function familyEmpty() {
  return '<section class="card"><h2>No lesson feedback yet</h2><p class="muted">Attendance, homework and teacher feedback will appear after a lesson review.</p></section>';
}

function familyPrepCard(lesson) {
  const p=familyPreparation(parentSource,lesson,state), reading=lesson===1?'Read Act 2 through Gerald’s departure.':plan(lesson-1).reading;
  const readingLabel=p.reading===true?'Marked complete':p.reading===false?'Not marked complete':'No update yet';
  return '<section class="card"><div class="cardtop"><h2>Before the next class</h2><span class="family-chip neutral">Lesson '+lesson+'</span></div><div class="family-check-row"><span class="family-check '+(p.reading?'ready':'')+'">'+(p.reading?'✓':'1')+'</span><div><b>Reading before class</b><p>'+esc(reading)+'</p><small>'+readingLabel+(p.reading?' · student-reported':'')+'</small></div></div><div class="family-check-row"><span class="family-check '+(p.quiz?'ready':'')+'">'+(p.quiz?'✓':'2')+'</span><div><b>Preparation quiz</b><p>'+(p.quiz?'Submitted'+(Number.isFinite(p.quiz.score)?' · '+p.quiz.score+'/4':'')+'.':'A short reading check before the lesson.')+'</p><small>'+(p.quiz?'Submitted':lesson!==1?'No quiz assigned':'Awaiting submission')+'</small></div></div><p class="family-footnote">Parents can check preparation here; students complete their reading and quiz in their own workspace.</p></section>';
}
function familyLessonCard(lesson) {
  if(!lesson)return '<section class="card dashboard-next"><span class="eyebrow">NEXT CLASS</span><h2>No upcoming lesson</h2><p>There are no more lessons on the sample schedule.</p><a class="link" href="#timeline">View course timeline →</a></section>';
  const zoom=courseZoomLink(plan(lesson).zoom);
  return '<section class="card dashboard-next"><span class="eyebrow">NEXT CLASS · SAMPLE SCHEDULE</span><h2>'+familyDate(lesson)+' <span class="dashboard-time">'+familyTime(lesson)+'</span></h2><p class="dashboard-course">'+courseTopic(lesson)+'</p><p>'+esc(plan(lesson).title)+'</p><p class="dashboard-meta">'+studentLabel(lesson)+' · 90 minutes</p><div class="dashboard-actions">'+(zoom?'<a class="btn light" href="'+esc(zoom)+'" target="_blank" rel="noopener noreferrer">Join Zoom ↗</a>':'<button class="btn secondary" disabled>Zoom link not set</button>')+'<a class="link" href="#timeline">Lesson details →</a></div></section>';
}

function parentDashboard() {
  const m=familyModel(),latest=m.records[0],next=parentSource==='sample'?familyNextLesson(m.records,new Date('2026-11-09T00:00:00Z')):familyNextLesson(m.records);
  const outstanding=m.records.filter(r=>['Partial','Not submitted'].includes(r.homework));
  return familyTop('Parent dashboard','Literature & the World')+'<div class="dashboard-grid"><div><section class="card"><div class="cardtop"><h2>Last class</h2>'+(latest?'<span class="dashboard-meta">'+familyDate(latest.lesson)+'</span>':'')+'</div>'+(latest?'<p class="dashboard-course">'+courseTopic(latest.lesson)+'</p><p class="dashboard-meta">'+esc(plan(latest.lesson).title)+'</p><dl class="dashboard-facts"><div><dt>Attendance</dt><dd>'+familyChip(latest.attendance)+'</dd></div><div><dt>Learning goals</dt><dd>'+familyChip(latest.learning)+'</dd></div></dl><h3>How did Alex do?</h3><p>'+esc(latest.summary||latest.success||'The teacher has not added a lesson summary yet.')+'</p><details class="dashboard-details"><summary>Teacher feedback & next step</summary><div class="dashboard-detail-body"><h3>Success</h3><p>'+esc(latest.success||'Not recorded yet.')+'</p><h3>Next step</h3><p>'+esc(latest.next||'Not recorded yet.')+'</p>'+familyReadButton(latest)+'</div></details>':'<p class="muted">No class review yet. Attendance and feedback will appear here once recorded.</p>')+'</section>'+dashboardHomework(dashboardHomeworkRecord(m.records,next),'parent')+'</div><div>'+familyLessonCard(next)+(next?'<details class="card dashboard-disclosure"><summary>Preparation for the next class</summary><div>'+familyPrepCard(next)+'</div></details>':'')+'<section class="card dashboard-links"><h2>Course & feedback</h2><a href="#timeline"><span>Course timeline</span><span aria-hidden="true">→</span></a><a href="#parent-progress"><span>All teacher feedback <small>'+m.unread+' unread</small></span><span aria-hidden="true">→</span></a><a href="#parent-contact"><span>Contact Matthew</span><span aria-hidden="true">→</span></a></section></div></div>'+(outstanding.length?'<details id="homework-attention" class="card dashboard-disclosure"><summary>Homework needing attention <span class="family-chip support">'+outstanding.length+'</span></summary><div>'+outstanding.map(r=>dashboardHomework(r,'parent',true)).join('')+'</div></details>':'');
}

function parentWeekPlan(){return courseTimeline('parent');}
function parentProgress() {
  const m=familyModel(), filtered=m.records.filter(r=>parentFeedbackWeek==='all'||Math.ceil(r.lesson/2)===Number(parentFeedbackWeek));
  return familyTop('Progress & feedback','Teacher observations after each lesson, with specific feedback to build on.')+
    '<section class="card family-progress-overview"><div><h2>'+m.metrics.reviewed+' of 24 lessons reviewed</h2></div><div><progress max="24" value="'+m.metrics.reviewed+'" aria-label="Lessons reviewed"></progress><span class="muted">'+m.unread+' unread review'+(m.unread===1?'':'s')+'</span></div></section>'+
    '<div class="family-section-title"><h2>Lesson-by-lesson feedback</h2><label class="family-week-select">Show<select id="family-feedback-week"><option value="all" '+(parentFeedbackWeek==='all'?'selected':'')+'>All weeks</option>'+Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'" '+(String(i+1)===parentFeedbackWeek?'selected':'')+'>Week '+(i+1)+'</option>').join('')+'</select></label></div>'+
    (filtered.length?filtered.map((record,i)=>familyReport(record,i===0)).join(''):parentFeedbackWeek==='all'?familyEmpty():'<section class="card family-empty"><h2>No review for Week '+parentFeedbackWeek+' yet.</h2><p>Your teacher’s feedback will appear after a lesson review.</p><button class="btn secondary" type="button" id="family-all-feedback">Show all feedback</button></section>')+
    '<p class="family-footnote">Read markers are saved in this browser only. They are not sent to your teacher in this preview.</p>';
}
function parentContact() {
  return familyTop('Contact Matthew','Share a question or a useful update with Matthew.')+
    '<div class="family-grid"><section class="card"><h2>What would you like to discuss?</h2><form id="family-contact-form"><label class="formlabel" for="family-topic">Topic</label><select id="family-topic" name="topic"><option>Learning progress</option><option>Reading or homework</option><option>Lesson schedule</option><option>Something else</option></select><label class="formlabel" for="family-contact-lesson">Related lesson</label><select id="family-contact-lesson" name="lesson"><option value="0">General question</option>'+Array.from({length:24},(_,i)=>'<option value="'+(i+1)+'" '+(parentContactLesson===i+1?'selected':'')+'>Week '+Math.ceil((i+1)/2)+' · Lesson '+(i%2+1)+' — '+esc(plan(i+1).title)+'</option>').join('')+'</select><label class="formlabel" for="family-message">Your message</label><textarea id="family-message" name="message" required placeholder="For example: Which part of the reading would be most useful to revisit together?"></textarea><p><button class="btn" type="submit">Open email draft ↗</button></p><p class="family-footnote">Opens your email app. Nothing is sent until you send it.</p><p id="family-contact-status" class="notice" role="status" hidden></p></form></section><aside><section class="card family-contact-card"><div class="avatar">MG</div><h2>Matthew Gilfillan</h2><p>Founder & teacher<br>Ink Wire Education</p><a href="mailto:matthew@inkwire.online">matthew@inkwire.online ↗</a></section><section class="card family-home-support"><span class="eyebrow">USEFUL THINGS TO SHARE</span><ul class="goals"><li>A question about an assignment or teacher feedback.</li><li>A change to your child’s availability.</li><li>Something that helped your child engage with a book.</li></ul></section></aside></div>';
}
function bindParentEvents() {
  if(role!=='parent') return;
  document.querySelectorAll('[data-show-homework]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const details=$('#homework-attention');if(details){details.open=true;details.scrollIntoView({block:'center'});details.querySelector('summary').focus();}}));
  $('#family-source')?.addEventListener('change',event=>{
    parentSource=event.target.value;parentWeek=parentSource==='sample'?3:1;parentFeedbackWeek='all';render();document.querySelector('.preview-options').open=true;$('#family-source')?.focus();
  });
  $('#family-timezone')?.addEventListener('change',event=>{parentTimezone=event.target.value;try{localStorage.setItem('inkwire-timezone',parentTimezone);}catch{}render();$('#family-timezone')?.focus();});
  $('#family-week')?.addEventListener('change',event=>{parentWeek=Number(event.target.value);render();$('#family-week')?.focus();});
  document.querySelectorAll('[data-family-week]').forEach(button=>button.addEventListener('click',()=>{
    const target=Number(button.dataset.familyWeek);if(target<1||target>12)return;parentWeek=target;timelineExpanded.clear();timelineExpanded.add(target);
    if(location.hash!=='#timeline')location.hash='timeline';else{render();$('#family-week')?.focus();}
  }));
  $('#family-feedback-week')?.addEventListener('change',event=>{parentFeedbackWeek=event.target.value;render();$('#family-feedback-week')?.focus();});
  $('#family-all-feedback')?.addEventListener('click',()=>{parentFeedbackWeek='all';render();$('#family-feedback-week')?.focus();});
  $('#family-show-sample')?.addEventListener('click',()=>{parentSource='sample';parentWeek=3;render();});
  document.querySelectorAll('[data-family-read]').forEach(button=>button.addEventListener('click',()=>{
    const record=familyModel().records.find(r=>r.lesson===Number(button.dataset.familyRead));if(!record)return;
    const key=familyReadKey(record,parentSource), updated={...parentRead,[key]:true};
    try{localStorage.setItem('inkwire-parent-read-v1',JSON.stringify(updated));parentRead=updated;render();toast('Marked as read in this browser.');}catch{toast('Your read marker could not be saved.');}
  }));
  document.querySelectorAll('[data-family-contact]').forEach(button=>button.addEventListener('click',()=>{parentContactLesson=Number(button.dataset.familyContact);location.hash='parent-contact';}));
  $('#family-contact-form')?.addEventListener('submit',event=>{
    event.preventDefault();const data=new FormData(event.target),lesson=Number(data.get('lesson'));
    const subject='Ink Wire parent enquiry: '+data.get('topic');
    const body='Hello Matthew,\n\n'+(lesson?'About Week '+Math.ceil(lesson/2)+', Lesson '+((lesson-1)%2+1)+' — '+plan(lesson).title+':\n\n':'')+data.get('message')+'\n\nThank you';
    const status=$('#family-contact-status');status.hidden=false;status.textContent='Your draft is ready to open in your email app. If it does not open, email matthew@inkwire.online directly. Nothing has been sent from this portal.';
    location.href='mailto:matthew@inkwire.online?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
  });
}

function dashboardTimezone(id,zone) {
  return '<label class="dashboard-timezone" for="'+id+'">Time zone<select id="'+id+'">'+Object.entries(FAMILY_TIMEZONES).map(([value,label])=>'<option value="'+value+'" '+(value===zone?'selected':'')+'>'+label+'</option>').join('')+'</select></label>';
}
function familyNextLesson(records, now=new Date()) {
  const after=Math.max(0,...records.filter(r=>r.attendance==='Present').map(r=>r.lesson));
  return Array.from({length:24},(_,i)=>i+1).find(n=>n>after && familySampleDate(n).getTime()+90*60000>Number(now)) || null;
}
function dashboardHomework(record,view,compact=false) {
  const n=record?.lesson, sample=view==='parent'&&parentSource==='sample';
  const examples={2:'Finish the paragraph explaining how Mrs. Birling responds to responsibility. Include two quotations and explain each one.',4:'Write a paragraph explaining how the Inspector presents shared responsibility. Support your point with evidence.'};
  const task=n?(sample?examples[n]||'':plan(n).homework):'',timing=record?.homeworkTiming;
  const status=record?.homework;
  const instruction=task || (status==='Not assigned'?'No written homework was assigned.':status?'Assignment details have not been added.':'Written homework and its status will appear when your teacher adds them.');
  const isStudent=view==='student',outstanding=view==='parent'&&!compact?familyModel().records.filter(r=>['Partial','Not submitted'].includes(r.homework)).length:0;
  return '<section class="'+(compact?'dashboard-homework-row':'card')+'"><div class="cardtop"><h2>'+(compact?studentLabel(n):'Homework')+'</h2>'+familyChip(status)+'</div>'+(n&&!compact?'<p class="dashboard-meta">'+studentLabel(n)+' · '+esc(plan(n).title)+'</p>':'')+'<p>'+esc(instruction)+'</p>'+(status&&status!=='Not assigned'?'<p class="dashboard-timing">Submission timing: <strong>'+esc(['On time','Late'].includes(timing)?timing:'Not recorded')+'</strong></p>':'')+(outstanding?'<p><a class="link" href="#homework-attention" data-show-homework>'+outstanding+' assignment'+(outstanding===1?' needs':'s need')+' attention ↓</a></p>':'')+(isStudent&&n?studentAction(n,'notebook','Open homework page →','Homework','link text-button'):'')+'</section>';
}

function dashboardHomeworkRecord(records,next) {
  if(records[0]?.homework)return records[0];
  const assigned=Array.from({length:next||24},(_,i)=>i+1).reverse().find(n=>plan(n).homework);
  return assigned ? records.find(r=>r.lesson===assigned)||{lesson:assigned} : records[0];
}
