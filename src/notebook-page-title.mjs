const title=value=>value.trim()||'Untitled page';
export function formatPageCreatedAt(value){
 if(!Number.isFinite(value)||value<=0)return '';
 return new Intl.DateTimeFormat(undefined,{dateStyle:'full',timeStyle:'short',calendar:'gregory'}).format(new Date(value));
}
// Keep title saves in order, including when a teacher keeps typing during a request.
export function pageTitleSession({initial,save,cache,onDraft=()=>{},onStatus=()=>{},onError=()=>{}}){
 let saved=initial,draft=initial==='Untitled page'?'':initial,timer,inflight,local=false,error='';
 try{const restored=cache?.read();if(restored?.expected===saved&&typeof restored.value==='string')draft=restored.value.slice(0,120);}catch{}
 const dirty=()=>title(draft)!==saved;
 function persist(){try{if(dirty())cache?.write({value:draft,expected:saved});else cache?.clear();local=!!cache;}catch{local=false;}}
 function status(){onStatus();}
 async function flush(){
  clearTimeout(timer);if(inflight)return inflight;if(!dirty())return;
  inflight=(async()=>{try{while(dirty()){const next=title(draft);await save(next,saved);saved=next;error='';persist();status();}}catch(e){error=e.message;onError(e);}finally{inflight=null;status();}})();status();return inflight;
 }
 function change(value){draft=String(value).slice(0,120);error='';persist();onDraft(title(draft));clearTimeout(timer);if(dirty())timer=setTimeout(flush,500);status();}
 const session={get value(){return draft;},get saved(){return saved;},get dirty(){return dirty();},get saving(){return !!inflight;},get locallySaved(){return local;},get error(){return error;},change,flush,cancel(){change(saved==='Untitled page'?'':saved);},release(){clearTimeout(timer);if(dirty())flush();}};
 persist();onDraft(title(draft));if(dirty())timer=setTimeout(flush,500);return session;
}
