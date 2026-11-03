import {escape} from './workspace-shared.js';
import {calendarGrid,zonedClock,shiftMonth} from './calendar-model.mjs';
export const monthTitle=month=>new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
export const dayLabel=day=>new Intl.DateTimeFormat('en-GB',{dateStyle:'full',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
export function calendarRequestRange(month){
 const days=calendarGrid(month),end=new Date(days.at(-1)+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+1);
 return {from:days[0],to:end.toISOString().slice(0,10)};
}
export function followingMonths(month,count=2){return Array.from({length:count},(_,i)=>shiftMonth(month,i)).filter(value=>value>='2000-01'&&value<='2100-12');}
export function monthEvents(events,month,classId=''){
 return events.filter(event=>(!classId||event.classId===classId)&&(event.dates||[event.date]).some(day=>day.startsWith(month)));
}
function eventLabel(event,zone,day){
 const start=zonedClock(event.startsAt,zone),end=zonedClock(event.endsAt,zone);
 if(day>start.date)return 'Until '+end.time+' · continued';
 return `${start.time}–${end.time}${end.date!==start.date?' (ends '+end.date+')':''}`;
}
function eventButton(event,zone,day){
 const label=eventLabel(event,zone,day);
 return `<button type="button" class="calendar-event ${event.status==='cancelled'?'is-cancelled':''}" data-event="${escape(event.id)}" aria-label="${escape(label+' · '+event.className+' · '+event.title+(event.status==='cancelled'?' · Cancelled':''))}"><time datetime="${escape(event.startsAt)}">${escape(label)}</time><strong>${escape(event.className)}</strong><span>${escape(event.title)}</span>${event.status==='cancelled'?'<span>Cancelled</span>':''}${event.billing?`<small>${escape(event.billing)}</small>`:''}</button>`;
}
export function calendarMonthHTML({month,events,mode,zone,classId='',first=false,now=Date.now()}){
 const selected=monthEvents(events,month,classId),today=zonedClock(now,zone).date;
 const heading=`<div class="calendar-section-heading ${first?'calendar-first-heading':''}"><h2>${monthTitle(month)}</h2><span>${selected.filter(e=>e.status!=='cancelled').length} scheduled${selected.some(e=>e.status==='cancelled')?' · '+selected.filter(e=>e.status==='cancelled').length+' cancelled':''}</span></div>`;
 const body=mode==='month'?`<div class="calendar-weekdays" aria-hidden="true">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-month">${calendarGrid(month).map(day=>{const inside=day.startsWith(month);return `<section class="calendar-day ${inside?'':'outside-month'} ${day===today?'is-today':''}" ${inside?`aria-label="${dayLabel(day)}"`:'aria-hidden="true"'}><h3><time datetime="${day}" ${day===today?'aria-current="date"':''}>${Number(day.slice(-2))}</time></h3>${inside?selected.filter(event=>(event.dates||[event.date]).includes(day)).map(event=>eventButton(event,zone,day)).join(''):''}</section>`;}).join('')}</div>`:
 selected.length?`<div class="calendar-agenda">${[...new Set(selected.flatMap(event=>event.dates||[event.date]).filter(day=>day.startsWith(month)))].sort().map(day=>`<section aria-label="${dayLabel(day)}"><h3>${dayLabel(day)}</h3>${selected.filter(event=>(event.dates||[event.date]).includes(day)).map(event=>eventButton(event,zone,day)).join('')}</section>`).join('')}</div>`:'<p class="calendar-empty">No lessons scheduled this month.</p>';
 return `<section class="calendar-month-section" data-calendar-month="${month}" aria-label="${monthTitle(month)}">${heading}${body}</section>`;
}
