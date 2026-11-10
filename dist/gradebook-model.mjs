// Shared validation. Automatic evidence never passes through the manual grade writer.
export const standardsLevels={unobserved:'Not enough evidence',beginning:'Beginning',approaching:'Approaching',meeting:'Meeting',exceeding:'Exceeding'};
export const evidenceStates={observed:'Evidence recorded',missing:'Missing work',absent:'Absent',exempt:'Exempt',unobserved:'Not observed yet'};
export const evidenceTypes={product:'Student work',observation:'Observation',conversation:'Conversation',exit:'Exit ticket',hinge:'Hinge question',self:'Student self-assessment',peer:'Peer feedback'};
const text=(v,max)=>{if(typeof v!=='string'||v.trim().length>max)throw Error('Check the text length.');return v.trim();};
export function validDate(value,optional=false){if(optional&&!value)return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw Error('Choose a valid date.');return value;}
export function cleanActivity(input){
 const title=text(input.title,160);if(!title)throw Error('Enter an activity title.');
 if(!['formative','summative'].includes(input.purpose))throw Error('Choose an assessment purpose.');
 if(!['none','points','percentage','letter','standards'].includes(input.format))throw Error('Choose a grading format.');
 const max=input.format==='points'?input.max:null;if(input.format==='points'&&(!Number.isFinite(max)||max<=0||max>100000))throw Error('Points need a maximum greater than zero.');
 if(!Array.isArray(input.standards)||input.standards.length>8)throw Error('Choose up to eight standards.');
 const standards=input.standards.map(s=>({code:text(s.code,100),title:text(s.title,500)}));
 if(standards.some(s=>!s.code||!s.title)||new Set(standards.map(s=>s.code)).size!==standards.length)throw Error('Each standard needs a unique code and a learning target.');
 if(input.format==='standards'&&!standards.length)throw Error('Add a standard and learning target.');
 const source=input.source||{kind:'manual',id:''};if(!['manual','lesson','quiz','assignment','notebook'].includes(source.kind))throw Error('Choose an activity source.');
 const sourceId=text(source.id||'',160);if(source.kind!=='manual'&&!sourceId)throw Error('Choose the source activity.');
 return {title,date:validDate(input.date),purpose:input.purpose,format:input.format,max,standards,successCriteria:text(input.successCriteria||'',1500),source:{kind:source.kind,id:sourceId}};
}
export function cleanEntry(input,activity){
 if(!Object.hasOwn(evidenceStates,input.state)||!Object.hasOwn(evidenceTypes,input.evidenceType)||!['independent','supported','unrecorded'].includes(input.support))throw Error('Choose evidence status, type and support.');
 const judgments=activity.standards.map(s=>({code:s.code,level:input.judgments?.find(j=>j.code===s.code)?.level||'unobserved'}));
 if(judgments.some(j=>!Object.hasOwn(standardsLevels,j.level)))throw Error('Choose a valid standards level.');
 let grade=null;
 if(input.state==='observed'&&input.grade!==null&&input.grade!==undefined&&input.grade!==''){
  if(activity.format==='points'||activity.format==='percentage'){
   if(typeof input.grade!=='number'||!Number.isFinite(input.grade)||input.grade<0||input.grade>(activity.format==='points'?activity.max:100))throw Error('Enter a score within the activity scale.');grade=input.grade;
  }else if(activity.format==='letter'){grade=text(input.grade,12);if(!/^[\p{L}\p{N} +−-]{1,12}$/u.test(grade))throw Error('Enter a short letter grade.');}
  else throw Error('This activity uses feedback or standards judgments, not a score.');
 }
 if(input.state!=='observed'&&judgments.some(j=>j.level!=='unobserved'))throw Error('Record evidence before making standards judgments.');
 return {state:input.state,evidenceType:input.evidenceType,support:input.support,grade,judgments,evidenceNote:text(input.evidenceNote||'',2000),feedback:text(input.feedback||'',2000),nextStep:text(input.nextStep||'',1000),followUp:validDate(input.followUp||'',true),followUpDone:input.followUpDone===true,privateNote:text(input.privateNote||'',2000)};
}
export function gradeLabel(entry,activity){if(!entry)return 'Not recorded';if(entry.state!=='observed')return evidenceStates[entry.state]||'Not recorded';if(entry.grade!==null&&entry.grade!==undefined)return activity.format==='points'?`${entry.grade} / ${activity.max}`:activity.format==='percentage'?`${entry.grade}%`:String(entry.grade);const rated=(entry.judgments||[]).filter(j=>j.level!=='unobserved');return rated.length?rated.map(j=>`${j.code}: ${standardsLevels[j.level]}`).join(' · '):'Feedback only';}
