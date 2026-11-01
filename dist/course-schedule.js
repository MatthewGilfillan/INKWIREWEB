import {escape} from './workspace-shared.js';
import {weekdays,scheduleCandidates,slotKey,applySchedule,billingSchedule,billingMonths} from './schedule-model.mjs';
export function createCourseSchedule({root,getCourse,apply,onChange,onFrequency}){
 let slots=[],skipped=[],preview=[];
 root.innerHTML=`<details class="schedule-editor"><summary>Weekly lesson days & times</summary><p>Set a separate time and duration for each weekly class. Preview every date between the start and end dates, then cross out holidays or extra dates.</p><div data-weekly-slots></div><button type="button" class="text-button" data-add-slot>+ Add weekly lesson time</button><div class="teacher-actions"><button type="button" class="teacher-button secondary" data-preview-dates>Preview lesson dates</button></div><p data-schedule-message role="status"></p><div class="schedule-dates" data-schedule-dates></div><button type="button" class="teacher-button" data-apply-dates hidden>Apply selected dates</button></details>
 <div class="planner-grid billing-settings"><div><label for="course-billing">Billing</label><select id="course-billing" name="billingMode"><option value="none">Not set</option><option value="monthly">Monthly hours · client billing</option><option value="packs">Parent lesson packs · 8 lessons</option></select></div><div data-bill-to hidden><label for="course-bill-to">Bill to <span>(optional)</span></label><input id="course-bill-to" name="billTo" maxlength="120" placeholder="e.g. Rivendell"></div></div><p class="planner-hint" data-billing-help></p><div data-billing-summary></div><button type="button" class="text-button" data-billing-export hidden>Download billing schedule (CSV)</button>`;
 const $=s=>root.querySelector(s);
 function drawSlots(){
  $('[data-weekly-slots]').innerHTML=slots.map((s,i)=>`<div class="weekly-slot" data-weekly-slot="${i}"><label>Day<select data-slot-field="day">${weekdays.map((d,n)=>`<option value="${n}" ${s.day===n?'selected':''}>${d}</option>`).join('')}</select></label><label>Time<input type="time" data-slot-field="startTime" value="${escape(s.startTime)}" required></label><label>Minutes<input type="number" data-slot-field="lessonMinutes" min="15" max="240" value="${s.lessonMinutes}" required></label><button type="button" class="text-button" data-remove-slot="${i}" aria-label="Remove weekly lesson time ${i+1}">Remove</button></div>`).join('');
  $('[data-add-slot]').disabled=slots.length>=7;
 }
 function invalidate(){preview=[];$('[data-schedule-dates]').replaceChildren();$('[data-apply-dates]').hidden=true;$('[data-schedule-message]').textContent='Preview the dates, then apply them to the lesson plan.';}
 function drawDates(){
  const count=preview.filter(s=>!skipped.includes(slotKey(s))).length,target=getCourse().lessons.length;
  $('[data-schedule-message]').textContent=`${count} selected dates for ${target} lessons. ${count===target?'Ready to apply.':count>target?`Cross out ${count-target} extra date${count-target===1?'':'s'}.`:`Add ${target-count} dates by extending the end date or changing the weekly times.`}`;
  $('[data-apply-dates]').hidden=false;$('[data-apply-dates]').disabled=count!==target;
  $('[data-schedule-dates]').innerHTML=preview.map(s=>`<label class="schedule-date ${skipped.includes(slotKey(s))?'is-skipped':''}"><input type="checkbox" data-schedule-skip="${escape(slotKey(s))}" ${skipped.includes(slotKey(s))?'checked':''}><span>${escape(s.date)} · ${weekdays[s.day]} · ${escape(s.startTime)} · ${s.lessonMinutes} min</span><small>Cross out</small></label>`).join('');
 }
 function previewDates(){try{preview=scheduleCandidates({...getCourse(),weeklySlots:slots});drawDates();}catch(error){$('[data-schedule-message]').textContent=error.message;$('[data-apply-dates]').hidden=true;}}
 function renderBilling(course){
  const mode=$('#course-billing').value;course={...course,billingMode:mode};$('[data-bill-to]').hidden=mode!=='monthly';
  $('[data-billing-help]').textContent=mode==='packs'?'Each scheduled, chargeable class uses one of eight lessons. Cancelled classes do not use a lesson unless you mark them chargeable. Pack numbers follow lesson dates; rescheduling does not add another lesson.':mode==='monthly'?'Monthly totals show scheduled billable hours for your records. Review them against lessons actually delivered before submitting hours to your client. This does not create invoices or charge anyone.':'';
  $('[data-billing-export]').hidden=mode==='none';
  $('[data-billing-summary]').innerHTML=mode==='monthly'?`<div class="billing-months">${billingMonths(course).map(m=>`<div><strong>${escape(m.month)}</strong><span>${Number((m.minutes/60).toFixed(2))} scheduled hours · ${m.lessons} chargeable lessons</span></div>`).join('')||'<p>No dated lessons yet.</p>'}</div>`:'';
 }
 root.addEventListener('input',event=>{const input=event.target;if(input.dataset.slotField){const index=Number(input.closest('[data-weekly-slot]').dataset.weeklySlot);slots[index][input.dataset.slotField]=input.dataset.slotField==='startTime'?input.value:Number(input.value);invalidate();onChange();}});
 root.addEventListener('change',event=>{
  const input=event.target;if(input.dataset.scheduleSkip){const key=input.dataset.scheduleSkip;skipped=input.checked?[...new Set([...skipped,key])]:skipped.filter(s=>s!==key);drawDates();onChange();}
  if(input.id==='course-billing'){renderBilling(getCourse());onChange();}
 });
 root.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-add-slot')){const c=getCourse();slots.push({day:slots.length?(slots.at(-1).day+1)%7:c.startDate?new Date(c.startDate+'T12:00:00Z').getUTCDay():5,startTime:c.startTime,lessonMinutes:c.lessonMinutes});drawSlots();onFrequency(slots.length);invalidate();onChange();}
  if(button.dataset.removeSlot!==undefined){slots.splice(Number(button.dataset.removeSlot),1);drawSlots();if(slots.length)onFrequency(slots.length);invalidate();onChange();}
  if(button.hasAttribute('data-preview-dates'))previewDates();
  if(button.hasAttribute('data-apply-dates')){try{const next=applySchedule({...getCourse(),weeklySlots:slots},skipped);apply(next);$('[data-schedule-message]').textContent=`Applied ${next.lessons.length} dates. Save course overview to publish the schedule.`;}catch(e){$('[data-schedule-message]').textContent=e.message;}}
  if(button.hasAttribute('data-billing-export')){
   const course=getCourse(),billing=billingSchedule(course),cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
   const rows=[['Bill to','Date','Time','Time zone','Lesson','Status','Minutes','Billable minutes','Pack'],...course.lessons.map((l,i)=>{const b=billing.get(l.id||`legacy-${i+1}`);return [course.billTo||'',b.date,b.startTime,course.timeZone,l.title,b.status,b.lessonMinutes,b.minutes,course.billingMode==='packs'?b.label:''];})];
   // Prefix spreadsheet formula characters in editable text cells.
   const csv=rows.map(row=>row.map(v=>cell(/^[=+@\-\t\r]/.test(String(v))?"'"+v:v)).join(',')).join('\r\n');
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='inkwire-billing-schedule.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
 });
 return {
  fill(course){slots=structuredClone(course.weeklySlots||[]);skipped=[...(course.skippedSlots||[])];drawSlots();invalidate();$('#course-billing').value=course.billingMode||'none';$('#course-bill-to').value=course.billTo||'';renderBilling(course);},
  settings:()=>({weeklySlots:structuredClone(slots),skippedSlots:[...skipped],billingMode:$('#course-billing').value,billTo:$('#course-bill-to').value}),
  refresh:renderBilling,preview:previewDates,invalidate,
  setWeekly(weekly){$('.schedule-editor').hidden=!weekly;}
 };
}
