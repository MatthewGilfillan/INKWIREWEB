import {limitClassAction} from './classes.mjs';
import {validFileBytes} from './notebook-files.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const issue=(message,status=400)=>Object.assign(Error(message),{status});
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const indexKey=cid=>`class-boards/${cid}/index.json`,boardKey=(cid,id)=>`class-boards/${cid}/${id}/board.json`,assetKey=(cid,id,asset)=>`class-boards/${cid}/${id}/images/${asset}`;
const string=(value,max)=>{if(typeof value!=='string'||value.trim().length>max)throw issue('Shorten the text and try again.');return value.trim();};
function link(value){const text=string(value||'',1800);if(!text)return '';let url;try{url=new URL(text);}catch{throw issue('Enter a complete https:// link.');}if(url.protocol!=='https:'||url.username||url.password)throw issue('Use an https:// link without sign-in details.');return url.href;}
async function read(env,key){const object=await env.WORKSHEETS.get(key);return object?{value:JSON.parse(new TextDecoder().decode(await object.arrayBuffer())),etag:object.etag}:null;}
async function put(env,key,value,etag){return env.WORKSHEETS.put(key,JSON.stringify(value),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});}
async function scopeFor(env,user,cid){
 if(!user?.emailVerified)throw issue('Please sign in.',401);
 if(!['teacher','student'].includes(user.requestedRole))throw issue('Class boards are available to this class’s teachers and students.',403);
 const teacher=user.requestedRole==='teacher';const classroom=await env.DB.prepare(`SELECT c.id,c.name FROM classes c WHERE c.id=? AND c.deleted_at IS NULL AND ${teacher?'(c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))':'EXISTS(SELECT 1 FROM class_students s JOIN learners l ON l.id=s.learner_id WHERE s.class_id=c.id AND l.user_id=?)'}`).bind(cid,user.id,...(teacher?[user.id]:[])).first();
 if(!classroom)throw issue('Class board not found.',404);
 const person=teacher?await env.DB.prepare('SELECT name FROM user WHERE id=?').bind(user.id).first():await env.DB.prepare('SELECT l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? AND l.user_id=?').bind(cid,user.id).first();
 return {teacher,classroom,authorName:person?.name|| (teacher?'Teacher':'Student')};
}
function visible(board,scope){if(!board||!scope.teacher&&(!board.published||board.archived))throw issue('Class board not found.',404);return board;}
const summary=b=>({id:b.id,title:b.title,kind:'board',sectionId:'boards',version:b.settingsVersion,createdAt:b.createdAt,state:b.archived?'Archived':!b.published?'Teacher draft':b.open?'Open to class':'Read only'});
function projection(b,scope,user){
 const canWrite=scope.teacher||b.published&&b.open&&!b.archived;
 return {id:b.id,title:b.title,prompt:b.prompt,published:b.published,open:b.open,archived:b.archived,replies:b.replies,reactions:b.reactions,settingsVersion:b.settingsVersion,revision:b.revision,createdAt:b.createdAt,className:scope.classroom.name,canWrite:canWrite&&!b.archived,posts:b.posts.filter(p=>!p.deleted||scope.teacher||p.authorId===user.id).map(p=>({id:p.id,title:p.title,text:p.text,url:p.url,imageId:p.imageId,authorName:p.authorName,teacher:p.teacher,own:p.authorId===user.id,version:p.version,pinned:p.pinned,deleted:p.deleted,moderated:p.moderated||false,teacherEdited:p.teacherEdited||false,createdAt:p.createdAt,updatedAt:p.updatedAt,likes:p.likes.length,liked:p.likes.includes(user.id),comments:p.comments.filter(c=>!c.deleted||scope.teacher||c.authorId===user.id).map(c=>({id:c.id,text:c.text,authorName:c.authorName,teacher:c.teacher,own:c.authorId===user.id,deleted:c.deleted,moderated:c.moderated||false,createdAt:c.createdAt,version:c.version}))}))};
}
async function bodyJSON(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw issue('Expected JSON.');const bytes=await readBytes(request,24000);try{const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||Array.isArray(body)||typeof body!=='object')throw Error();return body;}catch{throw issue('Invalid request.');}}
async function readBytes(request,max){const reader=request.body?.getReader();if(!reader)throw issue('Choose content to send.');const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw issue('This upload is too large.',413);}chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return bytes;}
function editGate(b,scope){if(b.archived)throw issue('Restore this board before making changes.',409);if(!scope.teacher&&(!b.published||!b.open))throw issue('Your teacher has closed posting on this board.',409);}
function mutate(b,input,scope,user){
 const key=user.id+':'+input.requestId;if(b.operations.includes(key))return false;
 const action=input.action;const teacherOnly=()=>{if(!scope.teacher)throw issue('Only teachers can change board settings.',403);};
 if(action==='settings'){
  teacherOnly();if(input.settingsVersion!==b.settingsVersion)throw issue('Board settings changed. Refresh and review them before saving.',409);
  const title=string(input.title,120),prompt=string(input.prompt||'',4000);if(!title)throw issue('Enter a board title.');if(['open','published','archived','replies','reactions'].some(k=>typeof input[k]!=='boolean'))throw issue('Choose valid board settings.');
  if(b.published&&!input.published)throw issue('Use Archive to hide a published board.');if(input.open&&(!input.published||input.archived))throw issue('Only a published, active board can accept posts.');
  Object.assign(b,{title,prompt,open:input.open,published:input.published,archived:input.archived,replies:input.replies,reactions:input.reactions,settingsVersion:b.settingsVersion+1});
 }else if(action==='asset'){
  editGate(b,scope);if(b.assets.length>=300)throw issue('This board has reached its image limit.');if(!b.assets.some(a=>a.id===input.asset.id))b.assets.push({...input.asset,authorId:user.id});
 }else if(['post','edit'].includes(action)){
  editGate(b,scope);const title=string(input.title||'',160),text=string(input.text||'',4000),url=link(input.url),imageId=input.imageId||'';
  if(!title&&!text&&!url&&!imageId)throw issue('Add text, a link, or an image.');if(imageId&&(!UUID.test(imageId)||!b.assets.some(a=>a.id===imageId&&(scope.teacher||a.authorId===user.id))))throw issue('Upload an image for this post first.');
  if(action==='post'){const existing=b.posts.find(p=>p.id===input.requestId);if(existing){if(existing.authorId===user.id)return false;throw issue('Choose a new post identifier.',409);}if(b.posts.length>=300)throw issue('This board has reached its 300-post limit.');b.posts.push({id:input.requestId,title,text,url,imageId,authorId:user.id,authorName:scope.authorName,teacher:scope.teacher,version:1,createdAt:Date.now(),updatedAt:Date.now(),deleted:false,pinned:false,likes:[],comments:[]});}
  else{const p=b.posts.find(p=>p.id===input.postId);if(!p||p.deleted)throw issue('Post not found.',404);if(!scope.teacher&&p.authorId!==user.id)throw issue('You can edit only your own posts.',403);if(p.version!==input.version)throw issue('This post changed. Reopen it before editing.',409);Object.assign(p,{title,text,url,imageId,teacherEdited:p.teacherEdited||scope.teacher&&p.authorId!==user.id,version:p.version+1,updatedAt:Date.now()});}
 }else{
  editGate(b,scope);const p=b.posts.find(p=>p.id===input.postId);if(!p)throw issue('Post not found.',404);
  if(action==='delete'||action==='restore'){
   if(!scope.teacher&&p.authorId!==user.id)throw issue('You can remove only your own posts.',403);if(p.version!==input.version)throw issue('This post changed. Refresh before continuing.',409);if(action==='restore'&&!scope.teacher&&p.moderated)throw issue('Only your teacher can restore a moderated post.',403);p.deleted=action==='delete';p.moderated=action==='delete'&&scope.teacher&&p.authorId!==user.id;p.version++;
  }else if(action==='pin'){teacherOnly();if(p.deleted)throw issue('Restore this post first.',409);if(typeof input.pinned!=='boolean')throw issue('Choose a valid pin action.');p.pinned=input.pinned;p.version++;}
  else if(action==='react'){if(p.deleted)throw issue('Post not found.',404);if(!b.reactions)throw issue('Reactions are turned off.',409);if(typeof input.liked!=='boolean')throw issue('Choose a valid reaction.');p.likes=p.likes.filter(id=>id!==user.id);if(input.liked&&p.likes.length<500)p.likes.push(user.id);}
  else if(action==='comment'){
   if(p.deleted)throw issue('Post not found.',404);if(!b.replies)throw issue('Replies are turned off.',409);const existing=p.comments.find(c=>c.id===input.requestId);if(existing){if(existing.authorId===user.id)return false;throw issue('Choose a new reply identifier.',409);}const text=string(input.text||'',1200);if(!text)throw issue('Write a reply.');if(p.comments.length>=100||b.posts.reduce((n,p)=>n+p.comments.length,0)>=2000)throw issue('This board has reached its reply limit.');p.comments.push({id:input.requestId,text,authorId:user.id,authorName:scope.authorName,teacher:scope.teacher,createdAt:Date.now(),deleted:false,version:1});
  }else if(action==='delete-comment'||action==='restore-comment'){
   const c=p.comments.find(c=>c.id===input.commentId);if(!c)throw issue('Reply not found.',404);if(!scope.teacher&&c.authorId!==user.id)throw issue('You can remove only your own replies.',403);if(c.version!==input.version)throw issue('This reply changed. Refresh before continuing.',409);if(action==='restore-comment'&&!scope.teacher&&c.moderated)throw issue('Only your teacher can restore a moderated reply.',403);c.deleted=action==='delete-comment';c.moderated=action==='delete-comment'&&scope.teacher&&c.authorId!==user.id;c.version++;
  }else throw issue('Choose a valid board action.');
 }
 b.revision++;b.operations=[...b.operations,key].slice(-500);return true;
}
async function change(env,user,cid,id,input){
 for(let n=0;n<5;n++){const scope=await scopeFor(env,user,cid),stored=await read(env,boardKey(cid,id));const board=visible(stored?.value,scope);if(!mutate(board,input,scope,user))return {board,scope};await scopeFor(env,user,cid);if(await put(env,boardKey(cid,id),board,stored.etag)!==null)return {board,scope};}
 throw issue('Another post is saving. Your draft is still here; try again.',409);
}
export async function handleClassBoards(request,env,user){
 try{
  if(!user?.emailVerified)throw issue('Please sign in.',401);if(!env.WORKSHEETS)throw issue('Class board storage is temporarily unavailable.',503);
  const url=new URL(request.url),[area,cid,id,kind,assetId,...extra]=url.pathname.slice('/api/class-boards/'.length).split('/').filter(Boolean);if(area!=='classes'||!UUID.test(cid||'')||id&&!UUID.test(id)||extra.length)throw issue('Class board not found.',404);
  const scope=await scopeFor(env,user,cid);
  if(!id&&request.method==='GET'){
   const manifest=await read(env,indexKey(cid));const stored=await Promise.all((manifest?.value.ids||[]).map(id=>read(env,boardKey(cid,id))));const boards=stored.filter(Boolean).map(r=>r.value).filter(b=>scope.teacher||b.published&&!b.archived);
   return json({userId:user.id,role:user.requestedRole,learnerName:'Live Boards',classBoards:true,sections:[{id:'boards',title:'Shared boards',automatic:true}],pages:boards.map(summary)});
  }
  if(request.method==='GET'&&id){
   const stored=await read(env,boardKey(cid,id)),b=visible(stored?.value,scope);
   if(kind==='images'&&UUID.test(assetId||'')){
    const asset=b.assets.find(a=>a.id===assetId),post=b.posts.find(p=>p.imageId===assetId&&(!p.deleted||scope.teacher||p.authorId===user.id));if(!asset||!post&&asset.authorId!==user.id&&!scope.teacher)throw issue('Image not found.',404);
    const object=await env.WORKSHEETS.get(assetKey(cid,id,assetId));if(!object)throw issue('Image not found.',404);return new Response(object.body,{headers:{'Content-Type':asset.mime,'Content-Disposition':'inline; filename="board-image"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
   }
   if(kind)throw issue('Not found.',404);const identity=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.id+':'+user.requestedRole)),tag='"'+stored.etag+'-'+[...new Uint8Array(identity)].slice(0,8).map(v=>v.toString(16).padStart(2,'0')).join('')+'"';
   if(request.headers.get('If-None-Match')===tag)return new Response(null,{status:304,headers:{ETag:tag,'Cache-Control':'no-store'}});return json({board:projection(b,scope,user),userId:user.id,teacher:scope.teacher},200,{ETag:tag});
  }
  if(request.method!=='POST')throw issue('Not found.',404);if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')throw issue('Invalid origin.',403);
  if(id&&kind==='images'&&UUID.test(assetId||'')){
   if(request.headers.get('X-Expected-User')!==user.id)throw issue('Your account changed. Reload the notebook.',401);
   if(!await limitClassAction(env,user.id,'class-board-image',20))throw issue('Please wait before uploading more images.',429);
   const stored=await read(env,boardKey(cid,id)),b=visible(stored?.value,scope);editGate(b,scope);const existing=b.assets.find(a=>a.id===assetId);if(existing){if(existing.authorId!==user.id)throw issue('Choose a new image.',409);return json({id:assetId,userId:user.id});}
   const mime=request.headers.get('Content-Type'),ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'})[mime];if(!ext)throw issue('Choose a PNG, JPEG, GIF, or WebP image.');const bytes=await readBytes(request,5*1024*1024);if(!validFileBytes(bytes,ext))throw issue('This is not a valid image.');
   await env.WORKSHEETS.put(assetKey(cid,id,assetId),bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:mime}});
   await change(env,user,cid,id,{action:'asset',requestId:assetId,asset:{id:assetId,mime,size:bytes.length}});return json({id:assetId,userId:user.id},201);
  }
  if(kind)throw issue('Not found.',404);if(!await limitClassAction(env,user.id,'class-board-action',240))throw issue('Please wait before posting again.',429);
  const input=await bodyJSON(request);if(input.expectedUserId!==user.id)throw issue('Your account changed. Reload the notebook.',401);if(!UUID.test(input.requestId||''))throw issue('Refresh the notebook and try again.');
  if(input.action==='asset')throw issue('Use the image upload control.',400);
  if(!id&&input.action==='create'){
   if(!scope.teacher)throw issue('Only teachers can create shared boards.',403);const title=string(input.title||'Untitled board',120),prompt=string(input.prompt||'',4000);if(!title)throw issue('Enter a board title.');const boardId=input.requestId;
   const previous=await read(env,boardKey(cid,boardId));if(previous&&previous.value.authorId!==user.id)throw issue('Choose a new board.',409);
   const manifestBefore=await read(env,indexKey(cid));if(!manifestBefore?.value.ids.includes(boardId)&&(manifestBefore?.value.ids.length||0)>=40)throw issue('This class has reached its 40-board limit.');
   if(!previous)await put(env,boardKey(cid,boardId),{id:boardId,title,prompt,createdAt:Date.now(),authorId:user.id,published:false,open:false,archived:false,replies:true,reactions:true,settingsVersion:1,revision:1,posts:[],assets:[],operations:[]},null);
   for(let n=0;n<5;n++){const manifest=await read(env,indexKey(cid))||{value:{ids:[]},etag:null};if(manifest.value.ids.includes(boardId))return json({id:boardId,userId:user.id});if(manifest.value.ids.length>=40)throw issue('This class has reached its 40-board limit.');manifest.value.ids.push(boardId);await scopeFor(env,user,cid);if(await put(env,indexKey(cid),manifest.value,manifest.etag)!==null)return json({id:boardId,userId:user.id},201);}
   throw issue('Another board is being created. Try again.',409);
  }
  if(!id)throw issue('Not found.',404);const result=await change(env,user,cid,id,input);return json({board:projection(result.board,result.scope,user),userId:user.id,teacher:result.scope.teacher});
 }catch(error){return json({message:error.message||'Class boards are temporarily unavailable.'},error.status||500);}
}
export function classBoardBooks(classes){return classes.map(c=>({id:c.id+'.boards',classId:c.id,className:c.name,learnerId:'boards',learnerName:'Live Boards',title:'Live Boards',classBoards:true}));}
