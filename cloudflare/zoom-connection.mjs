const encoder=new TextEncoder();
export const zoomEnabled=env=>env.ZOOM_ENABLED==='true';
export const zoomConfigured=env=>zoomEnabled(env)&&!!env.ZOOM_CLIENT_ID&&!!env.ZOOM_CLIENT_SECRET&&/^[a-f0-9]{64}$/i.test(env.ZOOM_TOKEN_KEY||'');
export function zoomError(message,status=400){throw Object.assign(Error(message),{status});}
const bytesTo64=bytes=>btoa(String.fromCharCode(...bytes));
const from64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export async function digestState(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function tokenKey(env){if(!zoomConfigured(env))zoomError('Zoom connection has not been configured.',503);return crypto.subtle.importKey('raw',Uint8Array.from(env.ZOOM_TOKEN_KEY.match(/../g),s=>parseInt(s,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function encryptZoomTokens(env,userId,tokens){const iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(userId)},await tokenKey(env),encoder.encode(JSON.stringify(tokens)));return JSON.stringify({iv:bytesTo64(iv),data:bytesTo64(new Uint8Array(data))});}
async function decryptTokens(env,row){const value=JSON.parse(row.credentials);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(value.iv),additionalData:encoder.encode(row.user_id)},await tokenKey(env),from64(value.data))));}
export async function zoomTokenExchange(env,body){
 const response=await fetch('https://zoom.us/oauth/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Basic '+btoa(env.ZOOM_CLIENT_ID+':'+env.ZOOM_CLIENT_SECRET),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
 if(!response.ok){await response.body?.cancel();zoomError('Zoom authorization could not complete. Reconnect Zoom and try again.',502);}
 const value=await response.json();if(typeof value.access_token!=='string'||typeof value.refresh_token!=='string'||!Number.isFinite(value.expires_in))zoomError('Zoom returned incomplete authorization. Reconnect and try again.',502);
 return {accessToken:value.access_token,refreshToken:value.refresh_token,expiresAt:Date.now()+value.expires_in*1000};
}
export async function zoomAccessToken(env,userId){
 let row=await env.DB.prepare('SELECT * FROM zoom_connections WHERE user_id=?').bind(userId).first();if(!row)zoomError('Connect the hosting teacher’s Zoom account first.',409);
 const token=await decryptTokens(env,row);if(token.expiresAt>Date.now()+60000)return token.accessToken;
 // A rotating refresh token must be used once, even across simultaneous tabs.
 const lock=await env.DB.prepare('UPDATE zoom_connections SET refresh_until=? WHERE user_id=? AND revision=? AND refresh_until<=? RETURNING revision').bind(Date.now()+30000,userId,row.revision,Date.now()).first();if(!lock)zoomError('Zoom authorization is refreshing. Try again in a moment.',409);
 try{const next=await zoomTokenExchange(env,{grant_type:'refresh_token',refresh_token:token.refreshToken}),credentials=await encryptZoomTokens(env,userId,next);const saved=await env.DB.prepare('UPDATE zoom_connections SET credentials=?,revision=revision+1,refresh_until=0 WHERE user_id=? AND revision=? RETURNING revision').bind(credentials,userId,row.revision).first();if(!saved)zoomError('The Zoom connection changed. Reconnect before continuing.',409);return next.accessToken;}
 catch(error){await env.DB.prepare('UPDATE zoom_connections SET refresh_until=0 WHERE user_id=? AND revision=?').bind(userId,row.revision).run();throw error;}
}
export async function zoomAPI(env,userId,path,{method='GET',body}={}){
 const token=await zoomAccessToken(env,userId),response=await fetch('https://api.zoom.us/v2'+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok){await response.body?.cancel();zoomError(response.status===401?'Your Zoom authorization expired. Reconnect Zoom.':response.status===429?'Zoom is busy. Wait a moment and try again.':'Zoom could not complete this request. Check the meeting and account permissions.',response.status===429?429:502);}
 return response.status===204?null:response.json();
}
export async function handleZoomConnection(request,env,user,{readJSON}){try{
 if(!user?.emailVerified)zoomError('Please sign in.',401);if(user.requestedRole!=='teacher')zoomError('Teacher access required.',403);
 const url=new URL(request.url),callback=url.pathname==='/api/zoom/callback';if(!callback&&url.pathname!=='/api/zoom/connection')zoomError('Not found.',404);const status=async()=>{const row=zoomEnabled(env)?await env.DB.prepare('SELECT display_name FROM zoom_connections WHERE user_id=?').bind(user.id).first():null;return {enabled:zoomEnabled(env),configured:zoomConfigured(env),connected:!!row,displayName:row?.display_name||'',userId:user.id};};
 if(request.method==='GET'&&!callback)return Response.json(await status(),{headers:{'Cache-Control':'no-store'}});
 if(!zoomConfigured(env))zoomError('Zoom connection has not been configured.',503);
 if(callback){
  if(request.method!=='GET')zoomError('Use GET.',405);const state=url.searchParams.get('state');if(!/^[a-f0-9]{64}$/.test(state||''))zoomError('The Zoom authorization link expired. Connect again.',400);
  const saved=await env.DB.prepare('DELETE FROM zoom_oauth_states WHERE state_hash=? AND user_id=? AND expires_at>? RETURNING user_id').bind(await digestState(state),user.id,Date.now()).first();if(!saved)zoomError('The Zoom authorization link expired or belongs to another account. Connect again.',400);
  if(url.searchParams.get('error'))return Response.redirect(env.APP_ORIGIN+'/teacher?zoom=cancelled',303);
  const code=url.searchParams.get('code');if(!code||code.length>4096)zoomError('Zoom authorization code is missing. Connect again.');
  const tokens=await zoomTokenExchange(env,{grant_type:'authorization_code',code,redirect_uri:env.APP_ORIGIN+'/api/zoom/callback'}),profileResponse=await fetch('https://api.zoom.us/v2/users/me',{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+tokens.accessToken}});if(!profileResponse.ok){await profileResponse.body?.cancel();zoomError('Zoom profile access was not granted. Check the app permissions.',502);}const profile=await profileResponse.json();if(!profile.id||!profile.account_id)zoomError('Zoom returned an incomplete profile.',502);
  const credentials=await encryptZoomTokens(env,user.id,tokens);await env.DB.prepare('INSERT INTO zoom_connections(user_id,zoom_user_id,account_id,display_name,credentials) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET zoom_user_id=excluded.zoom_user_id,account_id=excluded.account_id,display_name=excluded.display_name,credentials=excluded.credentials,revision=zoom_connections.revision+1,refresh_until=0').bind(user.id,profile.id,profile.account_id,String(profile.display_name||profile.first_name||'Zoom host').slice(0,120),credentials).run();return Response.redirect(env.APP_ORIGIN+'/teacher?zoom=connected',303);
 }
 if(request.method!=='POST')zoomError('Use GET or POST.',405);if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')zoomError('Invalid origin.',403);
 const input=await readJSON(request,2000);if(input.expectedUserId!==user.id)zoomError('Your account changed. Reload before connecting Zoom.',401);
 if(input.action==='connect'){
  await env.DB.prepare('DELETE FROM zoom_oauth_states WHERE expires_at<? OR user_id=?').bind(Date.now(),user.id).run();const state=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');await env.DB.prepare('INSERT INTO zoom_oauth_states VALUES(?,?,?)').bind(await digestState(state),user.id,Date.now()+600000).run();const target=new URL('https://zoom.us/oauth/authorize');target.search=new URLSearchParams({response_type:'code',client_id:env.ZOOM_CLIENT_ID,redirect_uri:env.APP_ORIGIN+'/api/zoom/callback',state});return Response.json({url:target.href},{headers:{'Cache-Control':'no-store'}});
 }
 if(input.action==='disconnect'){
  const row=await env.DB.prepare('SELECT * FROM zoom_connections WHERE user_id=?').bind(user.id).first();if(row){const token=await decryptTokens(env,row),response=await fetch('https://zoom.us/oauth/revoke',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Basic '+btoa(env.ZOOM_CLIENT_ID+':'+env.ZOOM_CLIENT_SECRET),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:token.accessToken})});if(!response.ok){await response.body?.cancel();zoomError('Zoom could not revoke this connection. Try again or remove Ink Wire in Zoom Marketplace.',502);}await env.DB.prepare('DELETE FROM zoom_connections WHERE user_id=? AND revision=?').bind(user.id,row.revision).run();}return Response.json(await status(),{headers:{'Cache-Control':'no-store'}});
 }
 zoomError('Unknown Zoom connection action.');
 }catch(error){return Response.json({message:error.status?error.message:'Zoom connection could not complete. Please try again.'},{status:error.status||502,headers:{'Cache-Control':'no-store'}});}}
