import {api,escape} from './workspace-shared.js';
import {currentDisplayTimeZone,loadDisplayTimeZone,displayTimeZoneLabel} from './display-time-zone.mjs';
import {nextDashboardLesson,dashboardTime} from './teacher-today-model.mjs';
import {courseIcon} from './course-overview.js';
import {unitMeter} from './learning-workspace.js';
import {lessonInstant} from './calendar-model.mjs';
import {lessonTiming} from './schedule-model.mjs';

export function createTeacherToday({root,getClasses,openClass,prepareClass,problem}) {
  let generation=0,records=[],timer;
  let zone=currentDisplayTimeZone();
  const studentCount=r=>r.count===null?'Student count unavailable':`${r.count} student${r.count===1?'':'s'}`;
  const link=id=>'/notebooks?classId='+encodeURIComponent(id);
  function render(){
    const now=Date.now(),rows=records.map(r=>({...r,next:nextDashboardLesson(r.course,now)}));
    const next=rows.filter(r=>r.next).sort((a,b)=>a.next.startsAt-b.next.startsAt)[0];
    const noClasses=!rows.length;
    const card=next?`<p class="today-eyebrow">${escape(dashboardTime(next.next,now,zone))}</p><h2>${escape(next.classroom.name)}</h2><p class="today-topic">${escape(next.next.title)}</p><p class="today-meta">${escape(studentCount(next))} <span aria-hidden="true">·</span> Lesson ${next.next.index+1}</p><div class="today-actions"><button type="button" class="teacher-button" data-today-prepare="${escape(next.classroom.id)}" data-lesson="${next.next.index}">Prepare class</button><a class="teacher-button secondary" href="${link(next.classroom.id)}">Open notebooks</a></div>`:
      `<p class="today-eyebrow">${noClasses?'YOUR TEACHING DAY':'A LITTLE ROOM TO PREPARE'}</p><h2>${noClasses?'Your first class starts here.':rows.some(r=>r.failed)?'Your classes are ready.':'No upcoming lesson scheduled.'}</h2><p class="today-topic today-empty-copy">${noClasses?'Create a class to bring your lesson plans and student notebooks together.':rows.some(r=>r.failed)?'Some lesson schedules could not be loaded. You can still open a class or review its notebooks.':'Open a class to prepare its lesson plan or set the next lesson date.'}</p><div class="today-actions">${noClasses?'<button type="button" class="teacher-button" data-today-create>Create class</button>':`<button type="button" class="teacher-button" data-today-prepare="${escape(rows[0].classroom.id)}">Open course plan</button><button type="button" class="teacher-button secondary" data-today-classes>View classes</button>`}</div>`;
    const classRows=rows.map((r,i)=>`<button class="today-class-row" type="button" data-today-class="${escape(r.classroom.id)}" aria-label="Open ${escape(r.classroom.name)}"><span class="today-class-initial tone-${i%3}" aria-hidden="true">${escape(Array.from(r.classroom.name)[0]||'C')}</span><span class="today-class-copy"><strong>${escape(r.classroom.name)}</strong><small>${escape(studentCount(r))}</small></span><span class="today-class-time">${escape(r.next?dashboardTime(r.next,now,zone):r.failed?'Schedule unavailable':'No upcoming date')}<small>${r.next?'Lesson '+(r.next.index+1):r.course?'Open course plan':'Course plan to set up'}</small></span><span class="today-chevron" aria-hidden="true">›</span></button>`).join('');
    const upcoming=rows.flatMap(r=>(r.course?.lessons || []).flatMap((lesson,index)=>{
      if(lesson.status==='cancelled')return [];
      try{const t=lessonTiming(r.course,lesson);if(!t.date)return [];const startsAt=lessonInstant(t.date,t.startTime,r.course.timeZone),endsAt=startsAt+t.lessonMinutes*60000;return endsAt>now?[{...r,index,title:lesson.title,startsAt,endsAt}]:[];}catch{return [];}
    })).sort((a,b)=>a.startsAt-b.startsAt).slice(0,5);
    const extended=`<div class="today-extended"><section class="today-panel"><div class="today-panel-heading"><h2>Coming up</h2><button class="text-button" type="button" data-today-calendar>View calendar →</button></div>${upcoming.map(r=>`<button type="button" class="upcoming-row" data-today-prepare="${escape(r.classroom.id)}" data-lesson="${r.index}"><span class="upcoming-icon">${courseIcon('calendar')}</span><span><strong>${escape(r.classroom.name)}</strong><small>${escape(r.title)}</small></span><span>${escape(dashboardTime(r,now,zone))}</span><span aria-hidden="true">›</span></button>`).join('') || '<p class="today-panel-empty">New lesson dates will appear here when scheduled.</p>'}</section><section class="today-panel"><h2>Where we are in each unit</h2>${rows.map(r=>`<div class="unit-overview-row"><strong>${escape(r.classroom.name)}</strong>${r.course?unitMeter(r.course,now):'<p class="learning-muted">Course plan not yet available.</p>'}</div>`).join('') || '<p class="today-panel-empty">Your unit timelines will appear here.</p>'}</section></div>`;
    root.innerHTML=`<div class="today-grid"><div class="today-left"><section class="today-next" aria-label="Next class">${card}</section><section class="today-panel today-class-panel" aria-labelledby="today-classes-heading"><div class="today-panel-heading"><h2 id="today-classes-heading">My classes</h2><button type="button" class="text-button" data-today-join>Join a class</button></div>${classRows||'<p class="today-panel-empty">Your classes will appear here.</p>'}</section></div><div class="today-right"><section class="today-panel today-review" aria-labelledby="today-review-heading"><h2 id="today-review-heading">Review work</h2><p>Choose a class to review student notebooks and assigned work.</p>${rows.map(r=>`<div class="today-review-row"><strong>${escape(r.classroom.name)}</strong><a class="teacher-button secondary" href="${link(r.classroom.id)}" aria-label="Review ${escape(r.classroom.name)} notebooks">Review</a></div>`).join('')||'<p class="today-panel-empty">Add a class and its students to start reviewing work.</p>'}</section><a class="today-master" href="/notebooks"><span class="today-master-icon">${courseIcon('book')}</span><span><strong>Master notebooks</strong><small>Access student notebooks across all your classes.</small></span><span class="today-chevron" aria-hidden="true">›</span></a></div></div>${extended}<p class="today-zone">Lesson times shown in ${escape(displayTimeZoneLabel(zone))}.</p>${rows.some(r=>r.failed)?'<p class="today-data-note" role="status">Some dashboard details could not be loaded. <button type="button" class="text-button" data-today-retry>Try again</button></p>':''}`;
  }
  async function refresh(){
    const token=++generation,classes=getClasses();
    zone=await loadDisplayTimeZone();if(token!==generation)return;
    if(!records.length&&classes.length)root.innerHTML='<p class="today-loading" role="status">Getting your teaching day ready…</p>';
    if(!classes.length){records=[];render();return;}
    const loaded=await Promise.all(classes.map(async classroom=>{
      const results=await Promise.allSettled([api('/api/classes/'+classroom.id+'/overview'),api('/api/enrollment/classes/'+classroom.id+'/roster')]);
      for(const r of results)if(r.status==='rejected'&&r.reason.status===401){if(token===generation)problem(r.reason);}
      return {classroom,course:results[0].status==='fulfilled'?results[0].value.course:null,count:results[1].status==='fulfilled'?results[1].value.students.length:null,failed:results.some(r=>r.status==='rejected')};
    }));
    if(token!==generation)return;records=loaded;render();clearInterval(timer);timer=setInterval(()=>{if(!root.hidden&&!root.contains(document.activeElement))render();},60000);
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.todayPrepare){const index=button.dataset.lesson;prepareClass(button.dataset.todayPrepare,button,index===undefined?undefined:Number(index));}
    if(button.dataset.todayClass)openClass(button.dataset.todayClass,button);
    if(button.hasAttribute('data-today-calendar'))document.querySelector('[data-teacher-view="calendar"]').click();
    if(button.hasAttribute('data-today-classes'))document.querySelector('[data-teacher-view="classes"]').click();
    if(button.hasAttribute('data-today-create'))document.querySelector('[data-open="create-class"]').click();
    if(button.hasAttribute('data-today-join'))document.querySelector('[data-open="join-class"]').click();
    if(button.hasAttribute('data-today-retry'))refresh();
  });
  return {refresh,clear(){generation++;clearInterval(timer);records=[];root.replaceChildren();}};
}
