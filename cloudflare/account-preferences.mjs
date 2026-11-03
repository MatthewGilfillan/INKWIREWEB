import {validDisplayTimeZone} from '../dist/display-time-zone.mjs';
import {limitClassAction} from './classes.mjs';

// A small private, account-owned settings object; no classroom or auth records
// are modified. The existing private R2 binding avoids a schema migration.
export async function handleAccountPreferences(request,env,user,{json,fail,readJSON}){
 if(!user?.emailVerified)return fail('Please sign in.',401,'UNAUTHENTICATED');
 if(!env.WORKSHEETS)return fail('Account settings are temporarily unavailable.',503,'UNAVAILABLE');
 const key='account-preferences/'+encodeURIComponent(user.id)+'/display.json';
 if(request.method==='GET'){
  const object=await env.WORKSHEETS.get(key);
  if(!object)return json({timeZone:null});
  const data=JSON.parse(new TextDecoder().decode(await object.arrayBuffer()));
  return json({timeZone:validDisplayTimeZone(data.timeZone)?data.timeZone:null});
 }
 if(request.method!=='POST')return fail('Use GET or POST.',405,'METHOD_NOT_ALLOWED');
 if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403,'INVALID_ORIGIN');
 let input;try{input=await readJSON(request,1024);}catch{return fail('Choose a valid time zone.',400,'INVALID_INPUT');}
 if(!input||Object.keys(input).some(key=>key!=='timeZone')||!(input.timeZone===null||validDisplayTimeZone(input.timeZone)))return fail('Choose a valid time zone or automatic local time.',400,'INVALID_INPUT');
 if(!await limitClassAction(env,user.id,'save-account-preferences',60))return fail('Please wait before changing this setting again.',429,'RATE_LIMITED');
 await env.WORKSHEETS.put(key,JSON.stringify({version:1,timeZone:input.timeZone}),{httpMetadata:{contentType:'application/json'}});
 return json({timeZone:input.timeZone});
}
