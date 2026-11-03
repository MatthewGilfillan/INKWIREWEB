import {api,escape} from './workspace-shared.js';
import {shiftMonth,zonedClock} from './calendar-model.mjs';
import {calendarRequestRange,followingMonths,monthTitle,monthEvents,calendarMonthHTML} from './calendar-view.js?v=20261103-scroll-calendar';
import {currentDisplayTimeZone,loadDisplayTimeZone,displayTimeZoneLabel} from './display-time-zone.mjs';

export function createTeacherCalendar({root,getClasses,openCourse,problem,getClassId}){
 let zone=currentDisplayTimeZone(),month=zonedClock(Date.now(),zone).date.slice(0,7),mode=matchMedia('(max-width:600px)').matches?'agenda':'month',generation=0,monthChosen=false,loading=false,visible=followingMonths(month),data=new Map(),issues=[];
 root.classList.add('calendar-workspace');
 root.innerHTML=`<div class="calendar-toolbar"><div class="calendar-month-navigation"><button type="button" class="calendar-arrow" data-cal="previous" aria-label="Previous month">←</button><label class="calendar-month-heading"><strong data-cal="month-name"></strong><span data-cal="year"></span><input type="month" data-cal="month" min="2000-01" max="2100-12" aria-label="Choose month" required></label><button type="button" class="calendar-arrow" data-cal="next" aria-label="Next month">→</button></div><label class="calendar-class-filter">Class<select data-cal="class"><option value="">All classes</option></select></label><div class="calendar-view-switch" role="group" aria-label="Calendar view"><button type="button" data-calendar-mode="month">Month</button><button type="button" data-calendar-mode="agenda">Agenda</button></div></div><div class="calendar-meta"><p data-cal="status" role="status"></p><a class="calendar-zone-link" href="/account?manage=1" data-cal="zone-label"></a></div><button type="button" class="text-button" data-cal="retry" hidden>Try loading calendar again</button><div data-cal="events"></div><div class="calendar-more"><button type="button" class="teacher-button secondary" data-cal="more">Show next month</button></div><div data-cal="issues"></div><div data-cal="unscheduled"></div>`;
 const $=name=>root.querySelector(`[data-cal="${name}"]`),filter=()=>getClassId?.()||$('class').value;
 if(getClassId)$('class').closest('label').hidden=true;
 function controls(){
  const [name,year]=monthTitle(month).split(' ');$('month-name').textContent=name;$('year').textContent=year;$('month').value=month;
  $('previous').disabled=month<='2000-01';$('next').disabled=month>='2100-12';
  root.querySelectorAll('[data-calendar-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.calendarMode===mode)));
  $('zone-label').textContent='Times · '+displayTimeZoneLabel(zone);$('zone-label').title='Change display time zone in account settings';
  $('more').disabled=loading;$('more').textContent=loading?'Loading months…':'Show next month';$('more').closest('div').hidden=visible.at(-1)>='2100-12';
 }
 function render(){
  controls();$('events').innerHTML=visible.filter(value=>data.has(value)).map((value,index)=>calendarMonthHTML({month:value,events:data.get(value).events,mode,zone,classId:filter(),first:index===0})).join('');
  const current=data.get(month);if(current){const events=monthEvents(current.events,month,filter()),count=events.filter(event=>event.status!=='cancelled').length;$('status').textContent=`${count} scheduled lesson${count===1?'':'s'} in ${monthTitle(month)}.`;}
  const currentFilter=filter(),missing=(current?.unscheduled||[]).filter(row=>!currentFilter||row.classId===currentFilter);issues=(current?.issues||[]).filter(row=>!currentFilter||row.classId===currentFilter);
  $('unscheduled').innerHTML=missing.length?`<section class="calendar-unscheduled"><h3>Classes to schedule</h3>${missing.map(row=>`<div><span><strong>${escape(row.className)}</strong><small>${row.count===null?'No course plan saved yet':row.count+' lesson dates to set'}</small></span><button type="button" class="teacher-button secondary" data-schedule="${escape(row.classId)}">Schedule lessons</button></div>`).join('')}</section>`:'';
  $('issues').innerHTML=issues.length?`<section class="calendar-issues"><h3>Lesson times to check</h3>${issues.map((issue,index)=>`<p><strong>${escape(issue.className+' · '+issue.title)}</strong><br>${escape(issue.message)} <button type="button" class="text-button" data-issue="${index}">Open lesson</button></p>`).join('')}</section>`:'';
 }
 async function requestMonth(value,token){
  const result=await api('/api/classes/calendar?'+new URLSearchParams({...calendarRequestRange(value),timeZone:zone}));
  if(token===generation&&!root.hidden)data.set(value,result);
 }
 async function reload(){
  if(root.hidden)return;const token=++generation;zone=await loadDisplayTimeZone();if(token!==generation||root.hidden)return;if(!monthChosen)month=zonedClock(Date.now(),zone).date.slice(0,7);
  loading=true;data=new Map();visible=followingMonths(month);render();$('status').textContent='Loading calendar…';$('retry').hidden=true;
  try{await Promise.all(visible.map(value=>requestMonth(value,token)));if(token!==generation||root.hidden)return;loading=false;render();}
  catch(error){if(token!==generation)return;loading=false;render();$('status').textContent=error.message;$('retry').hidden=false;if(error.status===401)problem(error);}
 }
 async function more(){
  if(loading||root.hidden||!data.has(month)||$('retry').hidden===false||visible.at(-1)>='2100-12')return;
  const token=generation,next=shiftMonth(visible.at(-1),1);loading=true;controls();
  try{await requestMonth(next,token);if(token!==generation||root.hidden)return;visible.push(next);loading=false;
   // Append only the new month, keeping focus, scroll, and existing day controls.
   $('events').insertAdjacentHTML('beforeend',calendarMonthHTML({month:next,events:data.get(next).events,mode,zone,classId:filter()}));controls();
  }catch(error){if(token!==generation)return;loading=false;controls();$('status').textContent=error.message;$('more').textContent='Try loading next month again';}
 }
 function refresh(){
  const selected=$('class').value;$('class').innerHTML='<option value="">All classes</option>'+getClasses().map(row=>`<option value="${escape(row.id)}">${escape(row.name)}</option>`).join('');
  if([...$('class').options].some(option=>option.value===selected))$('class').value=selected;return reload();
 }
 $('previous').onclick=()=>{monthChosen=true;month=shiftMonth(month,-1);reload();};$('next').onclick=()=>{monthChosen=true;month=shiftMonth(month,1);reload();};
 $('month').onchange=()=>{if($('month').checkValidity()&&$('month').value){monthChosen=true;month=$('month').value;reload();}};
 $('month').onclick=()=>{try{$('month').showPicker?.();}catch{}};
 $('class').onchange=render;$('retry').onclick=reload;$('more').onclick=more;
 root.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.calendarMode){mode=button.dataset.calendarMode;render();return;}
  if(button.dataset.event){const lesson=[...data.values()].flatMap(row=>row.events).find(row=>row.id===button.dataset.event);if(lesson)openCourse(lesson.classId,button,lesson.lessonIndex);}
  if(button.dataset.schedule)openCourse(button.dataset.schedule,button);
  if(button.dataset.issue!==undefined){const issue=issues[Number(button.dataset.issue)];if(issue)openCourse(issue.classId,button,issue.lessonIndex);}
 });
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))more();},{rootMargin:'400px'}):null;
 observer?.observe($('more'));controls();
 return {refresh,reload,clear(){generation++;loading=false;data.clear();$('events').replaceChildren();$('issues').replaceChildren();$('unscheduled').replaceChildren();}};
}
