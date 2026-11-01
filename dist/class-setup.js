import {escape} from './workspace-shared.js';
import {addDays} from './course-model.mjs';
import {weekdays,scheduleCandidates,slotKey} from './schedule-model.mjs';
import {buildScheduledCourse,scheduleSelection,sessionName,teachingWeek} from './class-setup-model.mjs';

// Embedded in the new-class form and in the existing class's schedule screen.
export function createClassSetup({root,onChange=()=>{},onReady=()=>{}}){
  root.classList.add('class-setup');let base=null,skipped=new Set(),preview=null,dirty=false;
  root.innerHTML=`<div class="setup-heading"><span class="class-badge">1 · Timetable</span><h3>When does this class meet?</h3><p>Set the teaching days first. Your calendar and timeline will be ready as soon as you save.</p></div>
  <div class="setup-fields"><label>Course format<select data-setup="format"><option value="full">Full course · 15 classes · 120 min</option><option value="summer">Summer · 10 classes · 90 min</option><option value="upper-primary">Upper primary · 15 classes · 50 min</option><option value="custom">Custom</option></select></label><label>Number of classes<input data-setup="lessonCount" type="number" min="1" max="156" required></label><label>Default duration (minutes)<input data-setup="lessonMinutes" type="number" min="15" max="240" required></label></div>
  <fieldset class="setup-days"><legend>Teaching days &amp; times</legend><p>Choose each day, then set its time and duration.</p>${[1,2,3,4,5,6,0].map(day=>`<div class="setup-day" data-setup-day="${day}"><label class="setup-day-check"><input type="checkbox" data-day="${day}"> ${weekdays[day]}</label><label>Time<input type="time" data-day-time value="16:00" required disabled aria-label="${weekdays[day]} lesson time"></label><label>Minutes<input type="number" data-day-minutes min="15" max="240" value="120" required disabled aria-label="${weekdays[day]} duration"></label></div>`).join('')}</fieldset>
  <div class="setup-fields"><label>Start date<input type="date" data-setup="startDate" min="2000-01-01" max="2100-12-31" required></label><label>Finish date<input type="date" data-setup="endDate" min="2000-01-01" max="2100-12-31" required></label><label>Time zone<select data-setup="timeZone"><option value="Asia/Shanghai">Beijing / Shanghai (UTC+8)</option><option value="Asia/Bangkok">Bangkok (UTC+7)</option><option value="Europe/London">London</option><option value="America/New_York">New York</option><option value="UTC">UTC</option></select></label></div>
  <div class="teacher-actions"><button type="button" class="text-button" data-suggest-end>Suggest finish date</button><button type="button" class="teacher-button secondary" data-preview-schedule>Review calendar</button></div>
  <div class="setup-review" hidden><span class="class-badge">2 · Choose teaching dates</span><h3>Cross out holidays &amp; breaks</h3><p>Click a lesson date to cross it out. Use “Skip week” for a whole week. Crossed-out dates do not use a class or a lesson-pack credit. Week numbers follow the teaching sequence.</p><p class="setup-count" role="status" data-setup-count></p><div class="setup-calendar-scroll" tabindex="0" role="region" aria-label="Choose teaching dates"><div class="setup-calendar" data-setup-calendar></div></div></div>
  <details class="setup-billing"><summary>Billing</summary><div class="setup-fields"><label>Billing arrangement<select data-setup="billingMode"><option value="none">No billing labels</option><option value="monthly">Monthly hours</option><option value="packs">8-lesson packs</option></select></label><label>Client / billed to (optional)<input data-setup="billTo" maxlength="120" placeholder="e.g. Rivendell"></label></div><p>Cancelled lessons do not count by default. You can mark a cancellation as chargeable in the lesson editor.</p></details><p data-setup-message role="status"></p>`;
  const $=s=>root.querySelector(s),field=k=>$(`[data-setup="${k}"]`),message=t=>$('[data-setup-message]').textContent=t;
  function settings(){return {format:field('format').value,lessonCount:Number(field('lessonCount').value),lessonMinutes:Number(field('lessonMinutes').value),startDate:field('startDate').value,endDate:field('endDate').value,timeZone:field('timeZone').value,billingMode:field('billingMode').value,billTo:field('billTo').value,weeklySlots:[...root.querySelectorAll('[data-day]:checked')].map(el=>{const row=el.closest('[data-setup-day]');return {day:Number(el.dataset.day),startTime:row.querySelector('[data-day-time]').value,lessonMinutes:Number(row.querySelector('[data-day-minutes]').value)};})};}
  function invalidate(){preview=null;$('[data-setup-calendar]').replaceChildren();$('.setup-review').hidden=true;dirty=true;onReady(false);onChange();message('Review the calendar after changing the timetable.');}
  function draw(){
    preview=scheduleSelection(settings(),[...skipped]);const {candidates,chosen,extra}=preview,teachingDays=new Set(settings().weeklySlots.map(s=>s.day));$('[data-setup-calendar]').dataset.teachingDays=String(teachingDays.size);
    $('.setup-review').hidden=false;$('[data-setup-count]').textContent=`${chosen.length} of ${field('lessonCount').value} classes selected. `+(extra>0?`Cross out ${extra} more ${extra===1?'class':'classes'}.`:extra<0?`Select ${-extra} more ${extra===-1?'class':'classes'}, or extend the finish date.`:'Ready to save your timetable.');
    const byDate=new Map();for(const slot of candidates){if(!byDate.has(slot.date))byDate.set(slot.date,[]);byDate.get(slot.date).push(slot);}
    const labels=new Map(chosen.map((s,i)=>[slotKey(s),sessionName(i,settings().weeklySlots.length)]));
    const first=teachingWeek(settings().startDate),last=teachingWeek(settings().endDate);let rows='';
    for(let monday=first;monday<=last;monday=addDays(monday,7)){
      const week=candidates.filter(s=>teachingWeek(s.date)===monday),allSkipped=week.length&&week.every(s=>skipped.has(slotKey(s)));
      rows+=`<div class="setup-week"><div class="setup-week-action">${week.length?`<button type="button" data-skip-week="${monday}" aria-pressed="${Boolean(allSkipped)}" aria-label="${allSkipped?'Restore':'Skip'} week of ${monday}">${allSkipped?'Restore week':'Skip week'}</button>`:''}</div>${Array.from({length:7},(_,n)=>{
        const date=addDays(monday,n),label=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
        return `<div class="setup-calendar-day ${teachingDays.has(new Date(date+'T12:00:00Z').getUTCDay())?'is-teaching-day':''}"><span>${escape(label)}</span>${(byDate.get(date)||[]).map(s=>{const key=slotKey(s),off=skipped.has(key);return `<button type="button" data-skip-date="${key}" class="${off?'is-skipped':''}" aria-pressed="${off}" aria-label="${off?'Restore':'Cross out'} ${date} at ${s.startTime}"><strong>${s.startTime}</strong><small>${s.lessonMinutes} min</small><span>${off?'Crossed out':escape(labels.get(key))}</span></button>`;}).join('')}</div>`;
      }).join('')}</div>`;
    }
    $('[data-setup-calendar]').innerHTML=`<div class="setup-calendar-days"><span>Week</span>${[1,2,3,4,5,6,0].map(d=>`<span class="setup-weekday ${teachingDays.has(d)?'is-teaching-day':''}">${weekdays[d].slice(0,3)}</span>`).join('')}</div>${rows}`;
    message('');onReady(extra===0);
  }
  function review(){try{draw();}catch(e){preview=null;onReady(false);message(e.message);}}
  root.addEventListener('change',event=>{
    const el=event.target;
    if(el.matches('[data-day]')){const row=el.closest('[data-setup-day]');row.querySelectorAll('[data-day-time],[data-day-minutes]').forEach(i=>i.disabled=!el.checked);}
    if(el===field('format')){const format={full:[15,120],summer:[10,90],'upper-primary':[15,50]}[el.value];if(format){field('lessonCount').value=format[0];field('lessonMinutes').value=format[1];root.querySelectorAll('[data-day-minutes]').forEach(i=>i.value=format[1]);}}
    if(el===field('lessonMinutes'))root.querySelectorAll('[data-day-minutes]').forEach(i=>i.value=el.value);
    if(el===field('billingMode')||el===field('billTo')){dirty=true;onChange();return;}
    invalidate();
  });
  root.addEventListener('input',event=>{if(event.target===field('lessonCount')||event.target===field('lessonMinutes'))field('format').value='custom';if(event.target.matches('input:not([type=checkbox])')){if(event.target===field('billTo')){dirty=true;onChange();}else invalidate();}});
  $('[data-preview-schedule]').onclick=review;
  $('[data-suggest-end]').onclick=()=>{try{const s=settings(),rows=scheduleCandidates({...s,endDate:'',lessonCount:s.lessonCount});field('endDate').value=rows.at(-1).date;skipped.clear();dirty=true;onChange();review();}catch(e){message(e.message);}};
  root.addEventListener('click',event=>{const day=event.target.closest('[data-skip-date]'),week=event.target.closest('[data-skip-week]');if(!day&&!week)return;
    const keys=day?[day.dataset.skipDate]:preview.candidates.filter(s=>teachingWeek(s.date)===week.dataset.skipWeek).map(slotKey),restore=keys.every(k=>skipped.has(k));keys.forEach(k=>restore?skipped.delete(k):skipped.add(k));dirty=true;onChange();draw();
    const replacement=day?$(`[data-skip-date="${day.dataset.skipDate}"]`):$(`[data-skip-week="${week.dataset.skipWeek}"]`);replacement?.focus();
  });
  function fill(value=null){
    base=value;skipped=new Set(value?.skippedSlots||[]);preview=null;dirty=false;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const initial={format:'full',lessonCount:15,lessonMinutes:120,startDate:today,endDate:'',timeZone:'Asia/Shanghai',billingMode:'none',billTo:'',...value};
    initial.lessonCount=value?.lessonCount||value?.lessons.length||15;
    initial.startDate=value?.startDate||value?.lessons.find(l=>l.date)?.date||today;
    const slots=value?.weeklySlots?.length?value.weeklySlots:[{day:new Date(initial.startDate+'T12:00:00Z').getUTCDay(),startTime:value?.startTime||'16:00',lessonMinutes:initial.lessonMinutes}];
    for(const key of ['format','lessonCount','lessonMinutes','startDate','endDate','timeZone','billingMode','billTo']){if(key==='timeZone'&&![...field(key).options].some(o=>o.value===initial[key]))field(key).add(new Option(initial[key],initial[key]));field(key).value=initial[key]??'';}
    for(const row of root.querySelectorAll('[data-setup-day]')){const slot=slots.find(s=>s.day===Number(row.dataset.setupDay));row.querySelector('[data-day]').checked=Boolean(slot);row.querySelector('[data-day-time]').value=slot?.startTime||'16:00';row.querySelector('[data-day-minutes]').value=slot?.lessonMinutes||initial.lessonMinutes;row.querySelectorAll('[data-day-time],[data-day-minutes]').forEach(i=>i.disabled=!slot);}
    if(!field('endDate').value)field('endDate').value=addDays(initial.startDate,(Math.ceil(initial.lessonCount/slots.length)-1)*7+6);
    $('.setup-review').hidden=true;$('[data-setup-calendar]').replaceChildren();message('Choose your dates, then review the calendar.');onReady(false);
  }
  fill();
  return {fill,review,isDirty:()=>dirty,isReady:()=>Boolean(preview&&preview.extra===0),build(title){if(!preview||preview.extra!==0)throw Error('Review the calendar and select exactly the requested number of classes.');return buildScheduledCourse({...settings(),title:title||base?.title,skippedSlots:[...skipped]},base);}};
}
