import {planningAvailable} from './planning-assistant.mjs';
export const resourceAccess=(env,user,classId)=>env.DB.prepare(`SELECT c.id,o.content,o.revision FROM classes c LEFT JOIN course_overviews o ON o.class_id=c.id WHERE c.id=? AND c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))`).bind(classId,user.id,user.id).first();
export const resourceRows=async(env,classId)=>(await env.DB.prepare(`SELECT id,class_id,filename,kind,bytes,provider_file_id,created_by,created_at,'legacy' AS source FROM course_resources WHERE class_id=? AND provider_file_id IS NOT NULL
  UNION ALL SELECT id,class_id,filename,kind,bytes,provider_file_id,created_by,created_at,'class-files' AS source FROM class_files WHERE class_id=? AND ready=1 AND ai_enabled=1 AND provider_file_id IS NOT NULL AND lock_until=0 ORDER BY created_at,id`).bind(classId,classId).all()).results;
const MAX_FILE=20*1024*1024,MAX_COURSE=40*1024*1024;
const types={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',csv:'text/csv',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain',vtt:'text/vtt'};
export async function reserveQuizRequest(env,userId){
  const now=Date.now(),day=Math.floor(now/86400000);
  for(const [key,max] of [[`quiz-teacher:${userId}:${day}`,40],[`quiz-site:${day}`,160]]){
    const row=await env.DB.prepare(`INSERT INTO ai_planning_limits(key,count,next_at,expires_at) VALUES(?,1,0,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count`).bind(key,(day+2)*86400000,max).first();
    if(!row)return false;
  }
  return true;
}
async function boundedForm(request){
  if(!request.headers.get('Content-Type')?.startsWith('multipart/form-data'))throw Error('Choose a file to upload.');
  const reader=request.body?.getReader();if(!reader)throw Error('Choose a file to upload.');
  let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_FILE+65536){await reader.cancel();throw Error('Each file must be 20 MiB or smaller.');}chunks.push(value);}}
  finally{reader.releaseLock();}
  return new Response(new Blob(chunks),{headers:{'Content-Type':request.headers.get('Content-Type')}}).formData();
}
export async function deleteProviderFile(env,id){
  const response=await fetch('https://api.openai.com/v1/files/'+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(20000)});
  await response.body?.cancel();if(!response.ok && response.status!==404)throw Error('The resource could not be removed from OpenAI. Try again.');
}
export async function handleCourseResources(request,env,user,{json,fail,readJSON}){
  if(!user?.emailVerified)return fail('Please sign in.',401,'UNAUTHENTICATED');
  if(user.requestedRole!=='teacher')return fail('Teacher access required.',403,'FORBIDDEN');
  const match=new URL(request.url).pathname.match(/^\/api\/course-resources\/classes\/([a-f0-9-]{36})$/);
  if(!match)return fail('Not found.',404);
  const classId=match[1];if(!await resourceAccess(env,user,classId))return fail('Class not found.',404,'NOT_FOUND');
  const output=async()=>({available:planningAvailable(env),resources:(await resourceRows(env,classId)).map(({id,filename,kind,bytes,created_at,source})=>({id,filename,kind,bytes,createdAt:created_at,source}))});
  if(request.method==='GET')return json(await output());
  if(request.method!=='POST')return fail('Use GET or POST.',405);
  if(request.headers.get('Origin')!==env.APP_ORIGIN || request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403,'INVALID_ORIGIN');
  if(!planningAvailable(env))return fail('OpenAI is not connected. Your existing course is unchanged.',503,'AI_UNAVAILABLE');
  if(request.headers.get('Content-Type')?.includes('application/json')){
    let input;try{input=await readJSON(request,2000);}catch{return fail('Choose a resource.',400);}
    if(input.action!=='remove' || typeof input.id!=='string')return fail('Choose a resource to remove.',400);
    const row=await env.DB.prepare('SELECT * FROM course_resources WHERE class_id=? AND id=?').bind(classId,input.id).first();
    if(!row)return fail('Resource not found.',404);
    try{if(row.provider_file_id)await deleteProviderFile(env,row.provider_file_id);await env.DB.prepare('DELETE FROM course_resources WHERE id=? AND class_id=?').bind(row.id,classId).run();return json(await output());}
    catch(e){return fail(e.message,502,'RESOURCE_REMOVE_FAILED');}
  }
  let file,kind,filename,mime;
  try{
    const form=await boundedForm(request);file=form.get('file');kind=form.get('kind');
    if(!file || typeof file.arrayBuffer!=='function' || file.size<1 || file.size>MAX_FILE)throw Error('Choose a file between 1 byte and 20 MiB.');
    filename=file.name.replace(/[\x00-\x1f/\\]/g,'_').slice(0,180);const ext=filename.split('.').pop().toLowerCase();mime=types[ext];
    if(!mime)throw Error('Use PDF, Word (.doc or .docx), CSV, Excel (.xls or .xlsx), TXT or VTT.');
    if(!['book','unit-plan','resource'].includes(kind))throw Error('Choose a resource type.');
    const head=new Uint8Array(await file.slice(0,8).arrayBuffer());
    if(ext==='pdf' && String.fromCharCode(...head.slice(0,5))!=='%PDF-')throw Error('This file is not a readable PDF. Export it again and retry.');
    if(['docx','xlsx'].includes(ext) && !(head[0]===80 && head[1]===75))throw Error('This file is not a valid Office document. Export it again and retry.');
    if(['doc','xls'].includes(ext) && !(head[0]===208 && head[1]===207))throw Error('Export this document as DOCX or XLSX and retry.');
  }catch(e){return fail(e.message || 'Could not read the upload.',400,'INVALID_FILE');}
  if(!await reserveQuizRequest(env,user.id))return fail('The daily AI resource and quiz limit has been reached. Try again tomorrow.',429,'AI_RATE_LIMITED');
  const id=crypto.randomUUID(),now=Date.now();
  await env.DB.prepare('DELETE FROM course_resources WHERE provider_file_id IS NULL AND created_at<?').bind(now-300000).run();
  const reserved=await env.DB.prepare(`INSERT INTO course_resources(id,class_id,filename,kind,bytes,created_by,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM course_resources WHERE class_id=?)+(SELECT count(*) FROM class_files WHERE class_id=? AND ai_enabled=1)<8 AND COALESCE((SELECT sum(bytes) FROM course_resources WHERE class_id=?),0)+COALESCE((SELECT sum(bytes) FROM class_files WHERE class_id=? AND ai_enabled=1),0)+?<=? RETURNING id`).bind(id,classId,filename,kind,file.size,user.id,now,classId,classId,classId,classId,file.size,MAX_COURSE).first();
  if(!reserved)return fail('A course can hold up to 8 resources totalling 40 MiB. Remove an unused resource or upload a smaller chapter excerpt.',400,'RESOURCE_LIMIT');
  let providerId;
  try{
    const form=new FormData();form.append('purpose','user_data');form.append('file',new Blob([file],{type:mime}),filename);
    const response=await fetch('https://api.openai.com/v1/files',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:form,signal:AbortSignal.timeout(90000)});
    if(!response.ok){await response.body?.cancel();throw Error('OpenAI could not accept this file. Check the file and try again.');}
    const uploaded=await response.json();if(typeof uploaded.id!=='string' || !/^file-[\w-]+$/.test(uploaded.id))throw Error('OpenAI did not confirm the upload. Try again.');providerId=uploaded.id;
    if(!await resourceAccess(env,user,classId))throw Error('Class access changed during upload.');
    await env.DB.prepare('UPDATE course_resources SET provider_file_id=? WHERE id=?').bind(providerId,id).run();
    return json(await output());
  }catch(e){
    if(providerId){try{await deleteProviderFile(env,providerId);}catch{await env.DB.prepare('UPDATE course_resources SET provider_file_id=? WHERE id=?').bind(providerId,id).run();return fail('Upload could not finish. Refresh the resource list and remove the file if it is no longer needed.',502,'RESOURCE_UPLOAD_FAILED');}}
    await env.DB.prepare('DELETE FROM course_resources WHERE id=?').bind(id).run();
    return fail(e.message?.startsWith('OpenAI')?e.message:'Upload could not finish. Refresh the resource list before trying again.',502,'RESOURCE_UPLOAD_FAILED');
  }
}
