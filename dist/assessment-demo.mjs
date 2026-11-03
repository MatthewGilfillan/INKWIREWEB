// Demo IDs never enter roster, notebook, enrollment or evidence APIs.
export const assessmentDemoClasses=[
 {id:'demo-educade-5a',name:'Class 5A · EDUCADE demo'},
 {id:'demo-educade-5b',name:'Class 5B · EDUCADE demo'}
];
export const isAssessmentDemo=id=>assessmentDemoClasses.some(c=>c.id===id);
export async function loadAssessmentDemo(id){
 const classroom=assessmentDemoClasses.find(c=>c.id===id);
 if(!classroom)throw Error('Choose an available demo class.');
 const {default:source}=await import('./educade-demo-data.mjs');
 const memberIds=new Set(source.classes.find(c=>c.id===id.replace('demo-educade-','')).studentIds);
 const learners=source.students.filter(s=>memberIds.has(s.id));
 return {
  students:learners.map(s=>({id:'demo-educade-'+s.id,name:s.name,initials:s.initials,demo:true})),
  skillEvidence:learners.flatMap(s=>s.evidence.map(record=>({...record,id:'demo-educade-'+record.id,learnerId:'demo-educade-'+s.id,demo:true}))),
  course:{lessons:[],assessment:{version:1,deferred:false,frameworks:[{id:'ccss-ela',scope:'g5'}],judgmentScale:'framework',dimensions:[],understandingMode:'evidence-profile'}}
 };
}
