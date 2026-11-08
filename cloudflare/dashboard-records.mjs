import {limitClassAction} from './classes.mjs';
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fail=(message,status=400)=>json({message},status);
const text=(value,max)=>typeof value==='string'&&value.trim().length<=max?value.trim():null;
export async function handleDashboardRecords(request,env,user,{readJSON}){
 if(!user?.emailVerified)return fail('Please sign in.',401);
 if(user.requestedRole!=='teacher')return fail('Teacher access is required.',403);
 if(!env.WORKSHEETS)return fail('Dashboard records are temporarily unavailable.',503);
 const prefix='dashboard-records/'+encodeURIComponent(user.id)+'/',read=async key=>{const object=await env.WORKSHEETS.get(key);return object?JSON.parse(new TextDecoder().decode(await object.arrayBuffer())):null;};
 const classes=(await env.DB.prepare('SELECT c.id,c.name FROM classes c WHERE c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))').bind(user.id,user.id).all()).results,allowed=new Map(classes.map(c=>[c.id,c]));
 if(request.method==='GET'){
  const records=[];let cursor;
  do{const page=await env.WORKSHEETS.list({prefix,limit:100,cursor});for(const object of page.objects){const row=await read(object.key);if(row&&allowed.has(row.classId))records.push({...row,className:allowed.get(row.classId).name});}cursor=page.truncated?page.cursor:undefined;}while(cursor);
  return json({records:records.sort((a,b)=>b.createdAt-a.createdAt)});
 }
 if(request.method!=='POST')return fail('Use GET or POST.',405);
 if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403);
 let input;try{input=await readJSON(request,8192);}catch{return fail('Check the record details.');}
 if(!input||!ID.test(input.id||'')||Object.keys(input).some(key=>!['id','action','kind','classId','learnerId','title','notes','reviewDate','status','suggestionKey'].includes(key)))return fail('Check the record details.');
 if(!await limitClassAction(env,user.id,'dashboard-records',60))return fail('Please wait before saving another record.',429);
 const key=prefix+input.id+'.json';let record;
 if(input.action==='create'){
  const title=text(input.title,160),notes=text(input.notes??'',1200),reviewDate=input.reviewDate||'',suggestionKey=input.suggestionKey??'';
  if(typeof suggestionKey!=='string'||suggestionKey.length>320||suggestionKey&&!/^[a-zA-Z0-9:._-]+$/.test(suggestionKey))return fail('Check the suggestion reference.');
  if(!['intervention','award'].includes(input.kind)||!allowed.has(input.classId)||!title||notes===null||typeof input.learnerId!=='string'||input.learnerId.length>80||typeof reviewDate!=='string'||reviewDate&&!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate))return fail('Choose a learner and enter a title.');
  if(reviewDate&&(!Number.isFinite(Date.parse(reviewDate+'T12:00:00Z'))||new Date(reviewDate+'T12:00:00Z').toISOString().slice(0,10)!==reviewDate))return fail('Choose a valid review date.');
  const learner=await env.DB.prepare('SELECT l.id,l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? AND l.id=?').bind(input.classId,input.learnerId).first();
  if(!learner)return fail('This learner is no longer in that class.',404);
  const existing=await read(key);if(existing)return allowed.has(existing.classId)?json({record:existing}):fail('Record not found.',404);
  record={id:input.id,...(suggestionKey?{suggestionKey}:{}),kind:input.kind,classId:input.classId,learnerId:learner.id,learnerName:learner.name,title,notes,reviewDate:input.kind==='intervention'?reviewDate:'',status:input.kind==='intervention'?'active':'awarded',createdAt:Date.now(),updatedAt:Date.now()};
  const saved=await env.WORKSHEETS.put(key,JSON.stringify(record),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  if(saved===null)return json({record:await read(key)});
 }else if(input.action==='status'){
  record=await read(key);if(!record||!allowed.has(record.classId))return fail('Record not found.',404);
  if(record.kind!=='intervention'||!['active','resolved'].includes(input.status))return fail('Choose a valid intervention status.');
  record={...record,status:input.status,updatedAt:Date.now()};await env.WORKSHEETS.put(key,JSON.stringify(record),{httpMetadata:{contentType:'application/json'}});
 }else return fail('Choose a supported action.');
 return json({record:{...record,className:allowed.get(record.classId).name}});
}
