import ccss from './ccss-ela.mjs';
import {cleanActivity,cleanEntry,standardsLevels,validDate} from './gradebook-model.mjs';

export const reportingFormats={standards:'Standards levels',points:'Points',percentage:'Percentage',letter:'Letter grades'};
export const normalizeCode=value=>String(value||'').trim().toUpperCase().replace(/^CCSS\.ELA-LITERACY\./,'').replace(/^CCSS\./,'').replace(/(\d)([A-Z])$/,'$1.$2');
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.trim().length>max||required&&!value.trim())throw Error('Check the reporting text.');return value.trim();};
export function cleanReportingPlan(input){
 if(!input||!Array.isArray(input.targets)||input.targets.length>100)throw Error('Choose up to 100 teaching targets.');
 const title=text(input.title,160,true),period=text(input.period||'',100),framework=text(input.framework||'ccss-ela',80,true),grade=text(input.grade||'',10);
 const startDate=validDate(input.startDate||'',true),endDate=validDate(input.endDate||'',true);if(startDate&&endDate&&endDate<startDate)throw Error('The reporting end date must follow its start date.');
 if(!Object.hasOwn(reportingFormats,input.format))throw Error('Choose a reporting scale.');
 const max=input.format==='points'?input.max:null;if(input.format==='points'&&(!Number.isFinite(max)||max<=0||max>100000))throw Error('Enter the maximum points.');
 const letters=input.format==='letter'?text(input.letters||'A,B,C,D,E',120,true).split(',').map(s=>s.trim()):[];if(letters.length>16||letters.some(s=>!s||s.length>12)||new Set(letters).size!==letters.length)throw Error('Enter distinct comma-separated letter grades.');
 const targets=input.targets.map(t=>{
  const code=normalizeCode(text(t.code,100,true)),official=framework==='ccss-ela'?ccss.standards.find(s=>normalizeCode(s.code)===code&&s.grade===grade):null;
  if(framework==='ccss-ela'&&(!official||!official.applicable))throw Error('Choose an applicable standard for the selected Common Core grade.');
  const report=t.report===true,assess=report||t.assess===true,teach=assess||t.teach===true;
  const rubric=Object.fromEntries(Object.keys(standardsLevels).filter(k=>k!=='unobserved').map(k=>[k,text(t.rubric?.[k]||'',1000)]));
  return {code,label:text(t.label||official?.description||code,160,true),description:official?.description||text(t.description||'',5000,true),teach,assess,report,rubric};
 });
 if(new Set(targets.map(t=>t.code)).size!==targets.length)throw Error('Each reporting target must have a unique code.');
 if(targets.filter(t=>t.report).length>12)throw Error('Choose up to twelve reporting outcomes. Six is a useful starting point.');
 const links=(input.links||[]);if(!Array.isArray(links)||links.length>100)throw Error('Choose up to 100 evidence links.');
 const cleanLinks=links.map(l=>{if(!['quiz','notebook','activity','assignment'].includes(l.kind)||!Array.isArray(l.codes)||!l.codes.length)throw Error('Choose an evidence source and its standards.');const codes=[...new Set(l.codes.map(normalizeCode))];if(codes.some(code=>!targets.some(t=>t.code===code&&t.assess)))throw Error('Link evidence only to assessed standards.');return {kind:l.kind,id:text(l.id,160,true),learnerId:l.kind==='notebook'?text(l.learnerId,100,true):'',codes};});
 return {title,period,framework,grade,startDate,endDate,format:input.format,max,letters,targets,links:cleanLinks,managed:input.managed===true};
}
export function reportingSignature(plan){return JSON.stringify({format:plan.format,max:plan.max,letters:plan.letters,framework:plan.framework,grade:plan.grade,targets:plan.targets.filter(t=>t.report).map(({code,label,description,rubric})=>({code,label,description,rubric}))});}
export function reportingActivity(plan,target){return cleanActivity({title:(plan.title+' · '+target.label).slice(0,160),date:plan.endDate||new Intl.DateTimeFormat('en-CA',{timeZone:plan.timeZone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now()),purpose:'summative',format:plan.format,max:plan.max,standards:[{code:target.code,title:target.label}],successCriteria:target.description.slice(0,1300)+'\nFull criterion and shared rubric are retained with the reporting judgment.',source:{kind:'manual',id:''}});}
export function reportingEntry(input,plan,target){const activity=reportingActivity(plan,target),entry=cleanEntry(input,activity);if(plan.format==='letter'&&entry.grade!==null&&!plan.letters.includes(entry.grade))throw Error('Choose a letter from the reporting scale.');return entry;}
export function blankReportingEntry(){return {state:'unobserved',evidenceType:'product',support:'unrecorded',grade:null,judgments:[],evidenceNote:'',feedback:'',nextStep:'',privateNote:'',followUp:''};}
export function validateGradeSuggestion(value,plan,target,evidence){
 if(!value||!['sufficient','insufficient'].includes(value.readiness)||!Object.hasOwn(standardsLevels,value.level))throw Error('The assistant returned an invalid judgment.');
 if(!Array.isArray(value.evidenceIds)||new Set(value.evidenceIds).size!==value.evidenceIds.length||value.evidenceIds.some(id=>!evidence.some(e=>e.id===id&&e.codes.includes(target.code))))throw Error('The assistant cited evidence outside this student and standard.');
 const cited=evidence.filter(e=>value.evidenceIds.includes(e.id)),enough=value.readiness==='sufficient'&&cited.some(e=>e.usable===true);
 const entry=reportingEntry({...blankReportingEntry(),state:enough?'observed':'unobserved',grade:enough?value.grade:null,judgments:[{code:target.code,level:enough?value.level:'unobserved'}],evidenceNote:text(value.reason||'',2000,true),feedback:text(value.feedback||'',2000),nextStep:text(value.nextStep||'',1000)},plan,target);
 if(enough&&(plan.format==='standards'?entry.judgments[0].level==='unobserved':entry.grade===null))throw Error('The assistant omitted the proposed grade.');
 return {entry,evidenceIds:value.evidenceIds,limitations:text(value.limitations||'',1500),readiness:enough?'sufficient':'insufficient'};
}
