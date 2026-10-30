// Parent-facing projections use an explicit field list. This is presentation filtering,
// not access control: production roles and private notes must be enforced on a server.
const FAMILY_FIELDS = ['attendance','homework','preparation','attitude','participation','focus','learning','success','next'];
const FAMILY_LABELS = {attendance:'Attendance',homework:'Homework',preparation:'Preparation',attitude:'Attitude',participation:'Participation',focus:'Effort & focus',learning:'Learning goals'};
const FAMILY_SAMPLE = {
  1:{attendance:'Present',homework:'Complete',preparation:'Ready',attitude:'Engaged',participation:'Contributes constructively',focus:'Sustained',learning:'Developing',success:'You noticed how Sheila’s response changes as she learns more about Gerald. You supported your interpretation with a well-chosen quotation.',next:'After each quotation, explain what the reader learns about the character.'},
  2:{attendance:'Present',homework:'Partial',preparation:'Partly ready',attitude:'Responds to encouragement',participation:'Contributes with prompting',focus:'Inconsistent',learning:'Developing',success:'You connected Mrs. Birling’s choices with the idea of responsibility and listened carefully to another interpretation.',next:'Finish the reading before class and mark two passages you want to discuss.'},
  3:{attendance:'Present',homework:'Complete',preparation:'Ready',attitude:'Engaged',participation:'Contributes constructively',focus:'Sustained',learning:'Developing',success:'Your paragraph used a clear point and relevant evidence to explain Eric’s responsibility.',next:'Develop the exploration: why might Priestley want his audience to question this behavior?'},
  4:{attendance:'Present',homework:'Complete',preparation:'Ready',attitude:'Engaged',participation:'Contributes constructively',focus:'Sustained',learning:'Secure',success:'You explained how the Inspector’s language encourages a sense of shared responsibility. Your evidence and explanation worked together.',next:'Carry that precision into a comparison of Birling’s speech and the Inspector’s message.'}
};
let parentSource = null;
let parentWeek = 3;
let parentTimezone = 'Asia/Bangkok';
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
  return {reading:lesson===1 ? !!data.read : null, quiz:data.quizzes?.['Alex Lee|'+lesson] || null};
}
function familySampleDate(lesson) {
  const weekIndex = Math.floor((lesson-1)/2);
  return new Date(Date.UTC(2026,10,5+weekIndex*7+(lesson%2===0?2:0),10,0));
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
    parentSource = saved.length || state.read || state.quizzes?.['Alex Lee|1'] ? 'saved' : 'sample';
    parentWeek = parentSource==='sample' ? 3 : 1;
  }
  const records = parentSource==='sample' ? Object.entries(FAMILY_SAMPLE).map(([lesson,r])=>({lesson:Number(lesson),...r})).reverse() : saved;
  return {records,metrics:familyMetrics(records),firstLesson:(parentWeek-1)*2+1,unread:records.filter(r=>!parentRead[familyReadKey(r,parentSource)]).length};
}
function familyChip(value) {
  const positive = ['Present','Complete','Ready','Engaged','Contributes constructively','Sustained','Secure','Submitted'];
  const support = ['Partial','Partly ready','Responds to encouragement','Contributes with prompting','Inconsistent','Developing','Needs support','Not submitted','Unprepared','Frequent redirection','Absent'];
  const tone = positive.includes(value) ? 'good' : support.includes(value) ? 'support' : 'neutral';
  return '<span class="family-chip '+tone+'">'+esc(value || 'Not recorded')+'</span>';
}
function familyTop(title,description) {
  familyModel();
  return '<div class="family-heading"><div><div class="eyebrow">A PARTNERSHIP IN LEARNING</div><h1>'+title+'</h1><p>'+description+'</p></div><div class="family-learner"><span class="avatar">AL</span><div><b>Alex Lee</b><small>Literature & the World</small></div></div></div>'+
    '<div class="family-preview"><p><strong>Parent portal preview</strong> · Fictional learner. '+(parentSource==='sample'?'Sample journey and illustrative schedule.':'Reading, quizzes, and assessments saved in this browser.')+'</p><div class="family-controls"><label>View<select id="family-source"><option value="sample" '+(parentSource==='sample'?'selected':'')+'>Sample journey</option><option value="saved" '+(parentSource==='saved'?'selected':'')+'>Saved demo work</option></select></label><label>Time zone<select id="family-timezone">'+['Asia/Bangkok','Asia/Shanghai','UTC'].map(zone=>'<option '+(zone===parentTimezone?'selected':'')+'>'+zone+'</option>').join('')+'</select></label></div></div>';
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
  return '<details class="family-report card" '+(expanded?'open':'')+'><summary><div><span class="eyebrow">WEEK '+Math.ceil(record.lesson/2)+' · LESSON '+((record.lesson-1)%2+1)+'</span><h3>'+esc(plan(record.lesson).title)+'</h3></div><span class="family-report-status">'+(seen?'Read':'<span class="unread-dot"></span> New feedback')+'</span></summary><div class="family-report-body"><dl class="family-observations">'+Object.entries(FAMILY_LABELS).map(([key,label])=>'<div><dt>'+label+'</dt><dd>'+familyChip(record[key])+'</dd></div>').join('')+'</dl><div class="family-note success"><span class="eyebrow">A SUCCESS TO CELEBRATE</span><p>'+esc(record.success || 'Your teacher has not added a success note yet.')+'</p></div><div class="family-note next"><span class="eyebrow">ONE NEXT STEP</span><p>'+esc(record.next || 'Your teacher has not added a next step yet.')+'</p></div><div class="family-report-actions">'+familyReadButton(record)+'<button type="button" class="link text-button" data-family-contact="'+record.lesson+'">Ask Matthew about this lesson ↗</button></div></div></details>';
}
function familyEmpty() {
  return '<section class="card family-empty"><span aria-hidden="true">◎</span><h2>A fresh page.</h2><p>Feedback will appear here after a lesson review. You’ll see a success, a next step, and observations about preparation and engagement.</p><button type="button" class="btn secondary" id="family-show-sample">View the sample journey</button></section>';
}
function familyPrepCard(lesson) {
  const p=familyPreparation(parentSource,lesson,state), reading=lesson===1?'Read Act 2 through Gerald’s departure.':plan(lesson-1).reading;
  const readingLabel=p.reading===true?'Marked complete':p.reading===false?'Not marked complete':'No update yet';
  return '<section class="card"><div class="cardtop"><h2>Ready for the conversation?</h2><span class="family-chip neutral">Lesson '+lesson+'</span></div><div class="family-check-row"><span class="family-check '+(p.reading?'ready':'')+'">'+(p.reading?'✓':'1')+'</span><div><b>Reading before class</b><p>'+esc(reading)+'</p><small>'+readingLabel+(p.reading?' · student-reported':'')+'</small></div></div><div class="family-check-row"><span class="family-check '+(p.quiz?'ready':'')+'">'+(p.quiz?'✓':'2')+'</span><div><b>Preparation quiz</b><p>'+(p.quiz?'Submitted'+(Number.isFinite(p.quiz.score)?' · '+p.quiz.score+'/4':'')+'. Completion is the entry ticket.':'A short reading check before the lesson.')+'</p><small>'+(p.quiz?'Ready for discussion':parentSource==='saved'&&lesson!==1?'Quiz not configured for this lesson':'Awaiting submission')+'</small></div></div><p class="family-footnote">Parents can check preparation here; students complete their reading and quiz in their own workspace.</p></section>';
}
function familyLessonCard(lesson) {
  return '<section class="card family-meeting"><div class="eyebrow">'+(parentSource==='sample'?'ILLUSTRATIVE LIVE LESSON':'LIVE LESSON')+'</div><h2>'+ (parentSource==='sample'?familyDate(lesson):'Schedule to be confirmed')+'</h2>'+(parentSource==='sample'?'<div class="family-time">'+familyTime(lesson)+'</div><p class="muted">90 minutes · '+parentTimezone+'</p>':'<p class="muted">Your confirmed date and time will appear here once the program is scheduled.</p>')+'<p>'+esc(plan(lesson).title)+'</p><button class="btn wide" disabled>Zoom link not set</button><p class="family-footnote">Your child’s individual lesson link will appear here.</p></section>';
}
function parentDashboard() {
  const m=familyModel(), latest=m.records[0],stats=m.metrics;
  return familyTop('Their next chapter. Your clear view.','The plan, the preparation, and the progress worth noticing.')+
    '<section class="family-hero"><div><span class="eyebrow">LITERATURE & THE WORLD · 12-WEEK PROGRAM</span><h2>Big ideas.<br><em>Steady progress.</em></h2><p>An Inspector Calls → Lord of the Flies<br>Reading, writing, and thoughtful conversations about the world.</p><a class="btn light" href="#timeline">Explore the weekly plan →</a></div><div class="family-course-progress"><span>LESSON REVIEWS</span><strong>'+stats.reviewed+'<small> / 24</small></strong><progress max="24" value="'+stats.reviewed+'" aria-label="Lessons reviewed"></progress><p>Two lessons a week.<br>One connected learning journey.</p></div></section>'+
    '<div class="family-stats"><section class="card"><span class="eyebrow">HOMEWORK</span><strong>'+(stats.assigned?stats.complete+' / '+stats.assigned:'—')+'</strong><p>'+(stats.assigned?'assigned tasks completed in reviewed lessons':'No homework observations yet')+'</p></section><section class="card"><span class="eyebrow">ATTENDANCE</span><strong>'+(stats.attendanceRecorded?stats.attended+' / '+stats.attendanceRecorded:'—')+'</strong><p>'+(stats.attendanceRecorded?'attended lessons with attendance recorded':'No attendance recorded yet')+'</p></section><section class="card"><span class="eyebrow">FEEDBACK TO READ</span><strong>'+m.unread+'</strong><a class="link" href="#parent-progress">View lesson feedback →</a></section></div>'+
    '<div class="family-section-title"><div><span class="eyebrow">THE WEEK IN FOCUS</span><h2>Week '+parentWeek+' · A little preparation goes a long way.</h2></div>'+familyWeekSelect()+'</div><div class="family-grid"><div>'+familyPrepCard(m.firstLesson)+'<div class="family-section-title"><h2>Latest teacher feedback</h2><a class="link" href="#parent-progress">All feedback →</a></div>'+(latest?familyReport(latest,true):familyEmpty())+'</div><aside>'+familyLessonCard(m.firstLesson)+'<section class="card family-home-support"><span class="eyebrow">A SMALL MOMENT AT HOME</span><h2>“What made you think that?”</h2><p>Invite your child to share one idea from the reading and the passage that sparked it. A curious question can open a good conversation.</p><a class="link" href="#parent-contact">Keep in touch with Matthew ↗</a></section></aside></div>'+
    '<section class="card"><div class="cardtop"><h2>The whole journey</h2><span class="muted">12 weeks · 24 lessons</span></div>'+familyWeekStrip(m.records,true)+'<p class="family-footnote">Select a week to explore its goals, readings, and lesson reviews.</p></section>';
}
function parentWeekPlan() {
  const m=familyModel();
  return familyTop('A plan you can follow.','See what’s coming, what to read, and what each lesson is working toward.')+
    '<section class="card family-plan-navigation"><div class="cardtop"><h2>Your 12-week course</h2>'+familyWeekSelect()+'</div>'+familyWeekStrip(m.records)+'</section>'+
    '<div class="family-section-title"><div><span class="eyebrow">WEEK '+String(parentWeek).padStart(2,'0')+'</span><h2>Two lessons. A shared direction.</h2></div><span class="family-chip neutral">'+(parentSource==='sample'?'Sample schedule · '+parentTimezone:'Schedule not configured')+'</span></div>'+
    '<div class="family-lesson-grid">'+[m.firstLesson,m.firstLesson+1].map(lesson=>{
      const p=plan(lesson),r=m.records.find(r=>r.lesson===lesson),prep=familyPreparation(parentSource,lesson,state);
      return '<article class="card family-plan-lesson"><div class="cardtop"><span class="eyebrow">LESSON '+((lesson-1)%2+1)+' <span class="muted">/ '+lesson+' OF 24</span></span>'+familyChip(r?'Reviewed':'Planned')+'</div><h2>'+esc(p.title)+'</h2><p class="family-lesson-time">'+(parentSource==='sample'?familyDate(lesson)+' · '+familyTime(lesson)+' · 90 min':'Date and time to be confirmed')+'</p><div class="family-plan-block"><span class="eyebrow">LEARNING GOAL</span><p>'+esc(p.goal)+'</p></div><div class="family-plan-block"><span class="eyebrow">READ BEFORE THIS LESSON</span><p>'+esc(lesson===1?'Read Act 2 through Gerald’s departure.':plan(lesson-1).reading)+'</p></div><div class="family-plan-block"><span class="eyebrow">AFTER THIS LESSON</span><p>'+esc(p.reading)+'</p><small>'+(lesson===24?'Final reflection · no new chapter reading.':'Due before the following lesson.')+'</small></div><div class="family-lesson-footer"><span>'+familyChip(prep.quiz?'Quiz submitted':parentSource==='saved'&&lesson!==1?'Quiz not configured':'Quiz pending')+'</span><button type="button" class="link text-button" data-family-contact="'+lesson+'">Ask a question ↗</button></div></article>';
    }).join('')+'</div><div class="family-plan-arrows"><button class="btn secondary" data-family-week="'+(parentWeek-1)+'" '+(parentWeek===1?'disabled':'')+'>← Previous week</button><button class="btn secondary" data-family-week="'+(parentWeek+1)+'" '+(parentWeek===12?'disabled':'')+'>Next week →</button></div>';
}
function parentProgress() {
  const m=familyModel(), filtered=m.records.filter(r=>parentFeedbackWeek==='all'||Math.ceil(r.lesson/2)===Number(parentFeedbackWeek));
  return familyTop('Notice the progress. Support the next step.','Teacher observations after each lesson, with specific feedback to build on.')+
    '<section class="card family-progress-overview"><div><span class="eyebrow">THE JOURNEY SO FAR</span><h2>'+m.metrics.reviewed+' of 24 lessons reviewed</h2><p>Observations describe a lesson, not a label for your child.</p></div><div><progress max="24" value="'+m.metrics.reviewed+'" aria-label="Lessons reviewed"></progress><span class="muted">'+m.unread+' unread review'+(m.unread===1?'':'s')+'</span></div></section>'+
    '<div class="family-section-title"><h2>Lesson-by-lesson feedback</h2><label class="family-week-select">Show<select id="family-feedback-week"><option value="all" '+(parentFeedbackWeek==='all'?'selected':'')+'>All weeks</option>'+Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'" '+(String(i+1)===parentFeedbackWeek?'selected':'')+'>Week '+(i+1)+'</option>').join('')+'</select></label></div>'+
    (filtered.length?filtered.map((record,i)=>familyReport(record,i===0)).join(''):parentFeedbackWeek==='all'?familyEmpty():'<section class="card family-empty"><h2>No review for Week '+parentFeedbackWeek+' yet.</h2><p>Your teacher’s feedback will appear after a lesson review.</p><button class="btn secondary" type="button" id="family-all-feedback">Show all feedback</button></section>')+
    '<p class="family-footnote">Read markers are saved in this browser only. They are not sent to your teacher in this preview.</p>';
}
function parentContact() {
  return familyTop('A conversation keeps us connected.','Share a question or a useful update with Matthew.')+
    '<div class="family-grid"><section class="card"><h2>What would you like to discuss?</h2><form id="family-contact-form"><label class="formlabel" for="family-topic">Topic</label><select id="family-topic" name="topic"><option>Learning progress</option><option>Reading or homework</option><option>Lesson schedule</option><option>Something else</option></select><label class="formlabel" for="family-contact-lesson">Related lesson</label><select id="family-contact-lesson" name="lesson"><option value="0">General question</option>'+Array.from({length:24},(_,i)=>'<option value="'+(i+1)+'" '+(parentContactLesson===i+1?'selected':'')+'>Week '+Math.ceil((i+1)/2)+' · Lesson '+(i%2+1)+' — '+esc(plan(i+1).title)+'</option>').join('')+'</select><label class="formlabel" for="family-message">Your message</label><textarea id="family-message" name="message" required placeholder="For example: Which part of the reading would be most useful to revisit together?"></textarea><p><button class="btn" type="submit">Open email draft ↗</button></p><p class="family-footnote">Opens your email app. Nothing is sent until you send it.</p><p id="family-contact-status" class="notice" role="status" hidden></p></form></section><aside><section class="card family-contact-card"><div class="avatar">MG</div><h2>Matthew Gilfillan</h2><p>Founder & teacher<br>Ink Wire Education</p><a href="mailto:matthew@inkwire.online">matthew@inkwire.online ↗</a></section><section class="card family-home-support"><span class="eyebrow">USEFUL THINGS TO SHARE</span><ul class="goals"><li>A question about an assignment or teacher feedback.</li><li>A change to your child’s availability.</li><li>Something that helped your child engage with a book.</li></ul></section></aside></div>';
}
function bindParentEvents() {
  if(role!=='parent') return;
  $('#family-source')?.addEventListener('change',event=>{
    parentSource=event.target.value;parentWeek=parentSource==='sample'?3:1;parentFeedbackWeek='all';render();$('#family-source')?.focus();
  });
  $('#family-timezone')?.addEventListener('change',event=>{parentTimezone=event.target.value;render();$('#family-timezone')?.focus();});
  $('#family-week')?.addEventListener('change',event=>{parentWeek=Number(event.target.value);render();$('#family-week')?.focus();});
  document.querySelectorAll('[data-family-week]').forEach(button=>button.addEventListener('click',()=>{
    const target=Number(button.dataset.familyWeek);if(target<1||target>12)return;parentWeek=target;
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
