import {api,escape} from './workspace-shared.js';
const FOLDER='application/vnd.google-apps.folder',MAX=20*1024*1024;
const exportsByType={
  'application/vnd.google-apps.document':['application/pdf','.pdf'],
  'application/vnd.google-apps.presentation':['application/pdf','.pdf'],
  'application/vnd.google-apps.spreadsheet':['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.xlsx'],
};
export function parseDriveFolder(value){
  const url=new URL(value);if(url.protocol!=='https:' || url.hostname!=='drive.google.com')throw Error('Paste a Google Drive folder link.');
  const id=url.pathname.match(/\/folders\/([\w-]+)(?:\/|$)/)?.[1];if(!id)throw Error('Paste a folder link, not a file link.');
  return {id,resourceKey:url.searchParams.get('resourcekey') || ''};
}
export async function boundedDriveBlob(response){
  if(!response.ok)throw Error(response.status===401?'Google access expired. Connect again.':'Google could not download this document. Check its sharing and download permissions.');
  if(Number(response.headers.get('Content-Length'))>MAX){await response.body?.cancel();throw Error('A Drive file is larger than 20 MiB. Use a smaller excerpt.');}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX){await reader.cancel();throw Error('A Drive file is larger than 20 MiB. Use a smaller excerpt.');}chunks.push(value);}}finally{reader.releaseLock();}
  return new Blob(chunks);
}
let scriptPromise;
function loadGoogle(){
  if(window.google?.accounts?.oauth2)return Promise.resolve();
  if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>{scriptPromise=null;script.remove();reject(Error('Google sign-in could not load. Check your connection and retry.'));};document.head.append(script);});
  return scriptPromise;
}
export function createDriveCourseImport({root,getClassId,getResources,onImported,onBusy}){
  root.innerHTML=`<details class="planner-source"><summary>Import a private Google Drive folder</summary><p data-drive-setup>Checking Google Drive connection…</p><div data-drive-controls hidden><label>Google Drive folder link<input type="url" data-drive-link placeholder="https://drive.google.com/drive/folders/…"></label><p>Google’s folder-reading permission allows viewing and downloading your Drive files. Ink Wire reads only the folder you choose and its subfolders. You select which documents to copy into this course and send to OpenAI. Access is temporary in this tab; no Google token is saved.</p><button type="button" class="teacher-button secondary" data-drive-connect disabled>Connect Google Drive</button><button type="button" class="text-button" data-drive-disconnect hidden>Disconnect</button><div data-drive-list></div><button type="button" class="teacher-button secondary" data-drive-import hidden>Import selected resources</button></div><p data-drive-status role="status"></p></details>`;
  const $=s=>root.querySelector(s);let clientId='',token='',files=[],busy=false,epoch=0;
  const message=s=>$('[data-drive-status]').textContent=s;
  const request=async(path,params={},key='')=>fetch('https://www.googleapis.com/drive/v3/'+path+'?'+new URLSearchParams(params),{headers:{Authorization:'Bearer '+token,...(key?{'X-Goog-Drive-Resource-Keys':key}:{})},credentials:'omit',signal:AbortSignal.timeout(45000)});
  const read=async(path,params,key)=>{const response=await request(path,params,key);if(!response.ok){await response.body?.cancel();throw Error(response.status===401?'Google access expired. Connect again.':'Google could not read this folder. Check the link, sharing permissions and Drive API setup.');}return response.json();};
  async function run(work){if(busy)return;busy=true;onBusy(true);const version=epoch;root.querySelectorAll('button,input').forEach(el=>el.disabled=true);try{await work(version);}catch(e){if(version===epoch)message(e.message);}finally{if(version===epoch){busy=false;onBusy(false);root.querySelectorAll('button,input').forEach(el=>el.disabled=false);for(const el of root.querySelectorAll('[data-drive-file]'))el.disabled=!files[Number(el.dataset.driveFile)]?.allowed;}}}
  async function scan(version){
    const folder=parseDriveFolder($('[data-drive-link]').value.trim()),rootKey=folder.resourceKey?folder.id+'/'+folder.resourceKey:'';
    const meta=await read('files/'+folder.id,{fields:'id,name,mimeType,capabilities(canListChildren)',supportsAllDrives:'true'},rootKey);
    if(meta.mimeType!==FOLDER || meta.capabilities?.canListChildren===false)throw Error('This folder cannot be listed with this Google account.');
    let scanned=0;const queue=[{id:folder.id,path:meta.name,key:rootKey}],found=[],seen=new Set();
    while(queue.length){
      const next=queue.shift();if(seen.has(next.id))continue;seen.add(next.id);if(seen.size>50)throw Error('This folder has more than 50 subfolders. Choose a smaller course folder.');
      let pageToken='';do{
        const result=await read('files',{q:`'${next.id}' in parents and trashed = false`,fields:'nextPageToken,files(id,name,mimeType,size,resourceKey,capabilities(canDownload,canListChildren))',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(pageToken?{pageToken}:{})},next.key);
        if(version!==epoch)return;
        for(const file of result.files || []){
          if(++scanned>500)throw Error('This folder has more than 500 items. Choose a smaller course folder.');
          const key=file.resourceKey?file.id+'/'+file.resourceKey:next.key;
          if(file.mimeType===FOLDER){if(file.capabilities?.canListChildren===false)throw Error('A subfolder is not accessible. Choose a folder where all course materials can be read.');queue.push({id:file.id,path:next.path+'/'+file.name,key});}
          else if(exportsByType[file.mimeType] || /\.(pdf|docx?|csv|xlsx?|txt|vtt)$/i.test(file.name))found.push({...file,path:next.path+'/'+file.name,key,allowed:file.capabilities?.canDownload!==false && (!file.size || Number(file.size)<=MAX)});
        }
        pageToken=result.nextPageToken || '';
      }while(pageToken);
    }
    files=found;const free=Math.max(0,8-getResources().length);let checked=0;
    $('[data-drive-list]').innerHTML=files.map((f,i)=>`<label class="planner-checkbox"><input type="checkbox" data-drive-file="${i}" ${f.allowed && checked++<free?'checked':''} ${f.allowed?'':'disabled'}><span>${escape(f.path)}${f.allowed?'':' (too large or download disabled)'}</span></label>`).join('');
    $('[data-drive-import]').hidden=!files.some(f=>f.allowed);$('[data-drive-disconnect]').hidden=false;
    message(`${files.length} supported documents found. Select up to ${free} to add to this course. Shortcuts and other file types are not followed.`);
  }
  $('[data-drive-connect]').onclick=()=>{
    try{parseDriveFolder($('[data-drive-link]').value.trim());}catch(e){message(e.message);return;}
    // Keep the OAuth popup directly inside the user gesture.
    window.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/drive.readonly',include_granted_scopes:false,error_callback:()=>message('Google connection cancelled or blocked. You can use Upload a resource folder instead.'),callback:response=>{
      if(response.error || !window.google.accounts.oauth2.hasGrantedAllScopes(response,'https://www.googleapis.com/auth/drive.readonly')){message('Google folder access was not granted.');return;}
      token=response.access_token;run(scan);
    }}).requestAccessToken({prompt:'consent'});
  };
  $('[data-drive-import]').onclick=()=>run(async version=>{
    const selected=[...root.querySelectorAll('[data-drive-file]:checked')].map(el=>files[Number(el.dataset.driveFile)]).filter(f=>f?.allowed);
    if(!selected.length || selected.length+getResources().length>8)throw Error('Choose resources within the eight-file course limit.');
    for(const file of selected){
      message('Importing '+file.name+'…');const conversion=exportsByType[file.mimeType];
      const response=await request('files/'+file.id+(conversion?'/export':''),conversion?{mimeType:conversion[0]}:{alt:'media',supportsAllDrives:'true'},file.key);
      const blob=await boundedDriveBlob(response);if(version!==epoch)return;
      const name=file.name+(conversion?conversion[1]:'');const form=new FormData();form.append('file',blob,name);form.append('kind',/unit[ -]?plan|overview/i.test(file.name)?'unit-plan':'resource');
      const result=await api(`/api/course-resources/classes/${getClassId()}`,form,{timeoutMs:110000});if(version!==epoch)return;onImported(result.resources);
      const checkbox=root.querySelector(`[data-drive-file="${files.indexOf(file)}"]`);checkbox.checked=false;checkbox.disabled=true;file.allowed=false;
    }
    message('Resources imported. Choose Prepare whole course to build the unit and quizzes.');
  });
  $('[data-drive-disconnect]').onclick=()=>{if(token)window.google.accounts.oauth2.revoke(token,()=>{});token='';files=[];$('[data-drive-list]').replaceChildren();$('[data-drive-import]').hidden=true;$('[data-drive-disconnect]').hidden=true;message('Disconnected. Imported course resources are kept until you remove them in the editor.');};
  return {isBusy:()=>busy,reset(){epoch++;token='';files=[];busy=false;$('[data-drive-list]').replaceChildren();$('[data-drive-link]').value='';$('[data-drive-import]').hidden=true;$('[data-drive-disconnect]').hidden=true;message('');},async load(){try{const config=await api('/api/drive-config');clientId=config.clientId || '';$('[data-drive-controls]').hidden=!clientId;$('[data-drive-setup]').textContent=clientId?'Read course materials from your private Drive folder.':'Google Drive connection needs administrator setup. You can upload files or choose a synced Drive folder above now.';if(clientId){await loadGoogle();$('[data-drive-connect]').disabled=false;}}catch{message('Drive connection is unavailable. File and folder uploads are still available.');}}};
}
