export function validDisplayTimeZone(value){
 if(typeof value!=='string'||!value||value.length>80)return false;
 try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}
}
export function deviceTimeZone(){
 try{const zone=new Intl.DateTimeFormat().resolvedOptions().timeZone;if(validDisplayTimeZone(zone))return zone;}catch{}
 return 'UTC';
}
export function resolveDisplayTimeZone(preference){return validDisplayTimeZone(preference)?preference:deviceTimeZone();}
let preference=null,loading;
export function currentDisplayTimeZone(){return resolveDisplayTimeZone(preference);}
export async function loadDisplayTimeZone(){
 if(!loading)loading=(async()=>{
  try{const response=await fetch('/api/account/preferences',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});if(response.ok){const data=await response.json();preference=validDisplayTimeZone(data.timeZone)?data.timeZone:null;}}
  catch{}return currentDisplayTimeZone();
 })();
 return loading;
}

if(typeof window!=='undefined')window.addEventListener('pageshow',event=>{if(event.persisted)loading=undefined;});

export function displayTimeZoneLabel(zone,at=Date.now()){
 const valid=validDisplayTimeZone(zone)?zone:'UTC';
 const offset=new Intl.DateTimeFormat('en-GB',{timeZone:valid,timeZoneName:'shortOffset'}).formatToParts(new Date(at)).find(part=>part.type==='timeZoneName')?.value||'GMT';
 const city=({'Asia/Shanghai':'Beijing','Asia/Calcutta':'Kolkata','Asia/Saigon':'Ho Chi Minh City','UTC':'UTC','Etc/UTC':'UTC'})[valid]||valid.split('/').at(-1).replaceAll('_',' ');
 return (offset==='GMT'?'GMT+0':offset)+' · '+city;
}
