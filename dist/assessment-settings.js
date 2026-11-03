import {standardsPacks,packById,validateStandardsSelection,schoolProgressScale} from './standards-registry.mjs';
import {escape} from './workspace-shared.js';

export function createAssessmentSettings({root,onChange=()=>{},required=false}) {
 let rows=[],later=false,scale='framework',notes='',scaleTouched=false;
 root.classList.add('assessment-settings');
 const options=(chosen,exclude=[])=>'<option value="">Choose assessment standards…</option>'+standardsPacks.filter(p=>!exclude.includes(p.id)||p.id===chosen).map(p=>`<option value="${p.id}" ${p.id===chosen?'selected':''}>${escape(p.name)}</option>`).join('');
 function render(){
  root.innerHTML=`<div class="standards-setting-heading"><h3>Assessment standards</h3><p>Choose the framework and level for this course. You can combine a curriculum with a writing scale.</p></div><label class="standards-primary">Main framework<select data-standards-primary ${required?'required':''}>${options(rows[0]?.id)}<option value="later" ${later?'selected':''}>Decide later</option></select></label><div data-standards-rows>${rows.map((row,i)=>{
   const pack=packById(row.id);
   return `<div class="standards-setting-row" data-standards-row="${i}">${i?`<label>Additional framework<select data-standards-pack>${options(row.id,rows.map(r=>r.id))}</select></label>`:''}<label>Year, stage or qualification<select data-standards-scope required><option value="">Choose level…</option>${pack.scopes.map(s=>`<option value="${s.id}" ${row.scope===s.id?'selected':''}>${escape(s.label)}</option>`).join('')}</select></label>${i?'<button type="button" class="text-button" data-standards-remove aria-label="Remove additional framework">Remove</button>':''}<p class="standards-setting-source">${escape(pack.edition)} · <a href="${escape(pack.source)}" target="_blank" rel="noopener noreferrer">Source ↗</a></p></div>`;
  }).join('')}</div>${rows.length&&rows.length<4?'<button type="button" class="text-button" data-standards-add>+ Add another framework</button>':''}<div class="standards-scale-setting" ${!rows.length?'hidden':''}><label>Teacher judgment scale<select data-standards-scale><option value="framework" ${scale==='framework'?'selected':''}>Framework / task-specific rubric</option><option value="b-m-plus" ${scale==='b-m-plus'?'selected':''}>B → M+ · school progress scale</option></select></label><p data-standards-scale-note>${scaleNote()}</p></div>${rows.some(row=>['ib-pyp','ipc'].includes(row.id))?'<div class="standards-dimensions"><strong>Assess separately</strong><span>Knowledge</span><span>Skills</span></div><p class="standards-understanding-note">Understanding: plan enduring understandings, then gather observations of explanation, connections, application and later recall. No percentage or B → M+ grade is assigned to understanding.</p>':''}<details class="standards-custom"><summary>School criteria &amp; assessment notes</summary><label>Criteria or rubric notes<textarea data-standards-notes rows="3" maxlength="4000" placeholder="Add your school’s agreed descriptors, licensed criterion references or task-specific expectations.">${escape(notes)}</textarea></label></details>`;
 }
 function scaleNote(){return scale==='b-m-plus'?schoolProgressScale.map(level=>level.code+' · '+level.label).join('   /   ')+' — school-defined progression; not a percentage conversion.':'Use the selected framework’s current task and level descriptors when recording a judgment.';}
 const captureNotes=()=>{notes=root.querySelector('[data-standards-notes]')?.value ?? notes;};
 function changed(){onChange();}
 root.addEventListener('change',event=>{
  event.stopPropagation();const el=event.target;captureNotes();
  if(el.matches('[data-standards-primary]')){later=el.value==='later';rows=el.value&&!later?[{id:el.value,scope:packById(el.value).scopes.length===1?packById(el.value).scopes[0].id:''}]:[];if(!scaleTouched)scale=['ib-pyp','ipc'].includes(el.value)?'b-m-plus':'framework';render();}
  if(el.matches('[data-standards-pack]')){const i=Number(el.closest('[data-standards-row]').dataset.standardsRow);if(el.value)rows[i]={id:el.value,scope:packById(el.value).scopes.length===1?packById(el.value).scopes[0].id:''};render();}
  if(el.matches('[data-standards-scope]'))rows[Number(el.closest('[data-standards-row]').dataset.standardsRow)].scope=el.value;
  if(el.matches('[data-standards-scale]')){scale=el.value;scaleTouched=true;root.querySelector('[data-standards-scale-note]').textContent=scaleNote();}
  changed();
 });
 root.addEventListener('input',event=>{event.stopPropagation();if(event.target.matches('[data-standards-notes]')){notes=event.target.value;changed();}});
 root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;captureNotes();
  if(b.matches('[data-standards-add]')){const next=standardsPacks.find(p=>!rows.some(r=>r.id===p.id));rows.push({id:next.id,scope:''});render();changed();}
  if(b.matches('[data-standards-remove]')){rows.splice(Number(b.closest('[data-standards-row]').dataset.standardsRow),1);render();changed();}
 });
 function value(){captureNotes();if(!rows.length&&!later){if(required)throw Error('Choose assessment standards or decide later.');return undefined;}return validateStandardsSelection({version:1,deferred:later,frameworks:rows,judgmentScale:scale,notes});}
 return {fill(selection){rows=structuredClone(selection?.frameworks || []);later=selection?.deferred===true;scale=selection?.judgmentScale || (rows.some(r=>['ib-pyp','ipc'].includes(r.id))?'b-m-plus':'framework');notes=selection?.notes || '';scaleTouched=Boolean(selection?.judgmentScale);render();},value,isReady(){try{value();return true;}catch{return false;}}};
}
