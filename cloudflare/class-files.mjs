import {resourceAccess,reserveQuizRequest,deleteProviderFile} from './course-resources.mjs';
import {planningAvailable} from './planning-assistant.mjs';
import {limitClassAction} from './classes.mjs';

const MAX_FILE=20*1024*1024,MAX_CLASS=200*1024*1024;
const types={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',csv:'text/csv',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain',vtt:'text/vtt',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',mp3:'audio/mpeg'};
const aiTypes=new Set(['pdf','doc','docx','csv','xls','xlsx','txt','vtt']);
export async function readClassUpload(request){
  if(!request.headers.get('Content-Type')?.startsWith('multipart/form-data'))throw Error('Choose a file to upload.');
  const reader=request.body?.getReader();if(!reader)throw Error('Choose a file.');let size=0;const chunks=[];
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_FILE+65536){await reader.cancel();throw Error('Each file must be 20 MiB or smaller.');}chunks.push(value);}}finally{reader.releaseLock();}
  const form=await new Response(new Blob(chunks),{headers:{'Content-Type':request.headers.get('Content-Type')}}).formData(),file=form.get('file');
  if(!file||typeof file.arrayBuffer!=='function'||!file.size||file.size>MAX_FILE)throw Error('Choose a file between 1 byte and 20 MiB.');
  const filename=file.name.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,180),ext=filename.split('.').pop().toLowerCase(),mime=types[ext],kind=form.get('kind')||'resource';
  if(!mime)throw Error('Use PDF, Word, Excel, CSV, TXT, VTT, PNG, JPG or MP3.');
  if(!['book','unit-plan','resource'].includes(kind))throw Error('Choose a file type.');
  if(!['true','false'].includes(form.get('aiEnabled'))||!['true','false'].includes(form.get('studentDownload')))throw Error('Choose the sharing settings.');
  const aiEnabled=form.get('aiEnabled')==='true',studentDownload=form.get('studentDownload')==='true';
  if(aiEnabled&&!aiTypes.has(ext))throw Error('AI planning uses documents. Share images and audio as student downloads, or upload a PDF / transcript for AI.');
  const head=new Uint8Array(await file.slice(0,8).arrayBuffer());
  if(ext==='pdf'&&String.fromCharCode(...head.slice(0,5))!=='%PDF-')throw Error('This is not a readable PDF.');
  if(['docx','xlsx'].includes(ext)&&!(head[0]===80&&head[1]===75))throw Error('This is not a valid Office document.');
  if(['doc','xls'].includes(ext)&&!(head[0]===208&&head[1]===207))throw Error('Export the document as DOCX or XLSX and retry.');
  return {file,filename,ext,mime,kind,aiEnabled,studentDownload};
}
async function memberAccess(env,user,classId){
  return env.DB.prepare(`SELECT c.id FROM classes c WHERE c.id=? AND c.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM class_students s JOIN learners l ON l.id=s.learner_id WHERE s.class_id=c.id AND
    (l.user_id=? OR EXISTS(SELECT 1 FROM learner_parents p WHERE p.learner_id=l.id AND p.parent_id=?)))`).bind(classId,user.id,user.id).first();
}
async function sendToAI(env,row,body){
  const form=new FormData();form.append('purpose','user_data');form.append('file',body,row.filename);
  const response=await fetch('https://api.openai.com/v1/files',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:form,signal:AbortSignal.timeout(90000)});
  if(!response.ok){await response.body?.cancel();throw Error('OpenAI could not accept the file. Try again.');}
  const value=await response.json();if(typeof value.id!=='string'||!/^file-[\w-]+$/.test(value.id))throw Error('OpenAI did not confirm the file upload.');return value.id;
}
// Reserve AI capacity before the network call, including concurrent uploads.
async function reserveAI(env,row){
  const result=await env.DB.prepare(`UPDATE class_files SET ai_enabled=1 WHERE id=? AND ai_enabled=0
    AND (SELECT count(*) FROM course_resources WHERE class_id=?)+(SELECT count(*) FROM class_files WHERE class_id=? AND ai_enabled=1)<8
    AND COALESCE((SELECT sum(bytes) FROM course_resources WHERE class_id=?),0)+COALESCE((SELECT sum(bytes) FROM class_files WHERE class_id=? AND ai_enabled=1),0)+?<=41943040 RETURNING id`).bind(row.id,row.class_id,row.class_id,row.class_id,row.class_id,row.bytes).first();
  if(!result)throw Error('AI can use up to 8 files / 40 MiB per class. Turn off AI for an unused file first.');
}
export async function handleClassFiles(request,env,user,{json,fail,readJSON}){
  if(!user?.emailVerified)return fail('Please sign in.',401,'UNAUTHENTICATED');
  const match=new URL(request.url).pathname.match(/^\/api\/class-files\/classes\/([a-f0-9-]{36})(?:\/([a-f0-9-]{36})\/download)?$/);if(!match)return fail('Not found.',404);
  const classId=match[1],teacher=user.requestedRole==='teacher'&&Boolean(await resourceAccess(env,user,classId));
  if(!teacher&&!await memberAccess(env,user,classId))return fail('Class not found.',404);
  const read=id=>env.DB.prepare('SELECT * FROM class_files WHERE class_id=? AND id=?').bind(classId,id).first();
  const output=async()=>{
    const rows=(await env.DB.prepare(`SELECT * FROM class_files WHERE class_id=? AND ready=1 ${teacher?'':'AND student_download=1'} ORDER BY created_at DESC,id`).bind(classId).all()).results;
    const files=rows.map(r=>({id:r.id,filename:r.filename,bytes:r.bytes,createdAt:r.created_at,downloadURL:`/api/class-files/classes/${classId}/${r.id}/download`,...(teacher?{kind:r.kind,aiEnabled:Boolean(r.ai_enabled&&r.provider_file_id),studentDownload:Boolean(r.student_download),revision:r.revision,aiSupported:aiTypes.has(r.filename.split('.').pop().toLowerCase()),busy:r.lock_until>Date.now()}:{} )}));
    const legacy=teacher?(await env.DB.prepare('SELECT id,filename,kind,bytes FROM course_resources WHERE class_id=? AND provider_file_id IS NOT NULL ORDER BY created_at').bind(classId).all()).results:[];
    return {files,teacher,available:teacher&&planningAvailable(env),legacy};
  };
  if(request.method==='GET'){
    if(!match[2])return json(await output());
    const row=await read(match[2]);if(!row?.ready||(!teacher&&!row.student_download))return fail('File not found.',404);
    const object=await env.WORKSHEETS?.get(row.storage_key);if(!object)return fail('File not found.',404);
    return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="class-file.${row.filename.split('.').pop().replace(/[^a-z0-9]/gi,'')}"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`,'Content-Length':String(row.bytes),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cross-Origin-Resource-Policy':'same-origin'}});
  }
  if(!teacher)return fail('Teacher access required.',403);
  if(request.method!=='POST'||match[2])return fail('Use GET or POST.',405);
  if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403,'INVALID_ORIGIN');
  if(!env.WORKSHEETS)return fail('File storage is not connected.',503);
  if(!await limitClassAction(env,user.id,'class-files',60))return fail('Too many file changes. Try again in 15 minutes.',429);
  if(request.headers.get('Content-Type')?.includes('application/json')){
    let input;try{input=await readJSON(request,2000);}catch{return fail('Choose a file and sharing settings.',400);}
    if(!['sharing','remove'].includes(input.action)||!Number.isInteger(input.revision))return fail('Reload the file list before changing it.',400);
    const row=await read(input.id);if(!row?.ready)return fail('File not found.',404);
    if(input.action==='sharing'&&(typeof input.aiEnabled!=='boolean'||typeof input.studentDownload!=='boolean'))return fail('Choose the sharing settings.',400);
    if(input.action==='sharing'&&input.aiEnabled&&(!planningAvailable(env)||!aiTypes.has(row.filename.split('.').pop().toLowerCase())))return fail('AI planning is unavailable for this file.',400);
    const token=crypto.randomUUID(),lock=await env.DB.prepare('UPDATE class_files SET lock_token=?,lock_until=? WHERE id=? AND revision=? AND lock_until<? RETURNING id').bind(token,Date.now()+180000,row.id,input.revision,Date.now()).first();
    if(!lock)return fail('This file changed or is being updated. Refresh the file list.',409,'CONFLICT');
    let providerId=row.provider_file_id;
    try{
      if(input.action==='remove'){
        if(providerId){await deleteProviderFile(env,providerId);providerId=null;}
        // Revoke downloads before deleting bytes, even if storage cleanup fails.
        await env.DB.prepare('UPDATE class_files SET ready=0,ai_enabled=0,student_download=0 WHERE id=? AND lock_token=?').bind(row.id,token).run();
        await env.WORKSHEETS.delete(row.storage_key);await env.DB.prepare('DELETE FROM class_files WHERE id=? AND lock_token=?').bind(row.id,token).run();
      }else{
        if(input.aiEnabled&&!providerId){
          if(!await reserveQuizRequest(env,user.id))throw Error('The daily AI upload limit has been reached. Try again tomorrow.');
          await reserveAI(env,row);const object=await env.WORKSHEETS.get(row.storage_key);if(!object)throw Error('The file could not be read.');providerId=await sendToAI(env,row,new Blob([await object.arrayBuffer()],{type:row.mime}));
        }
        if(!input.aiEnabled&&providerId){await deleteProviderFile(env,providerId);providerId=null;}
        await env.DB.prepare('UPDATE class_files SET ai_enabled=?,provider_file_id=?,student_download=?,revision=revision+1 WHERE id=? AND lock_token=?').bind(Number(input.aiEnabled),providerId,Number(input.studentDownload),row.id,token).run();
      }
      await env.DB.prepare('UPDATE class_files SET lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?').bind(row.id,token).run();
      return json(await output());
    }catch(e){
      if(input.action==='remove')await env.DB.prepare('UPDATE class_files SET ready=1,student_download=0,revision=revision+1 WHERE id=? AND lock_token=?').bind(row.id,token).run();
      // Keep a successful provider upload addressable; a retry can finish or remove it.
      await env.DB.prepare('UPDATE class_files SET ai_enabled=?,provider_file_id=? WHERE id=? AND lock_token=?').bind(Number(Boolean(providerId)),providerId,row.id,token).run();
      return fail(e.message||'Could not update the file. Refresh and retry.',502);
    }finally{await env.DB.prepare('UPDATE class_files SET lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?').bind(row.id,token).run();}
  }
  let upload;try{upload=await readClassUpload(request);}catch(e){return fail(e.message,400,'INVALID_FILE');}
  if(upload.aiEnabled&&!planningAvailable(env))return fail('OpenAI is not connected. Turn off Use with AI to store the file privately.',503);
  const id=crypto.randomUUID(),storageKey=`class-files/${classId}/${id}`,now=Date.now();
  const row={id,class_id:classId,filename:upload.filename,bytes:upload.file.size,mime:upload.mime};
  const reserved=await env.DB.prepare(`INSERT INTO class_files(id,class_id,filename,kind,mime,bytes,storage_key,created_by,created_at,lock_until)
    SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM class_files WHERE class_id=?)<32 AND COALESCE((SELECT sum(bytes) FROM class_files WHERE class_id=?),0)+?<=? RETURNING id`).bind(id,classId,upload.filename,upload.kind,upload.mime,upload.file.size,storageKey,user.id,now,now+180000,classId,classId,upload.file.size,MAX_CLASS).first();
  if(!reserved)return fail('A class can store up to 32 files / 200 MiB. Remove an unused file first.',400);
  let providerId=null;
  try{
    if(upload.aiEnabled){if(!await reserveQuizRequest(env,user.id))throw Error('The daily AI upload limit has been reached.');await reserveAI(env,row);}
    await env.WORKSHEETS.put(storageKey,await upload.file.arrayBuffer(),{httpMetadata:{contentType:upload.mime}});
    if(upload.aiEnabled)providerId=await sendToAI(env,row,upload.file);
    if(!await resourceAccess(env,user,classId))throw Error('Class access changed during upload.');
    await env.DB.prepare('UPDATE class_files SET ready=1,ai_enabled=?,provider_file_id=?,student_download=?,lock_until=0 WHERE id=?').bind(Number(upload.aiEnabled),providerId,Number(upload.studentDownload),id).run();
    return json(await output(),201);
  }catch(e){
    if(providerId){try{await deleteProviderFile(env,providerId);}catch{await env.DB.prepare('UPDATE class_files SET ready=1,ai_enabled=1,provider_file_id=?,lock_until=0 WHERE id=?').bind(providerId,id).run();return fail('The file is stored privately. Refresh the list to finish sharing or remove it.',502);}}
    await env.WORKSHEETS.delete(storageKey);await env.DB.prepare('DELETE FROM class_files WHERE id=?').bind(id).run();return fail(e.message||'Upload failed. Try again.',502);
  }
}
