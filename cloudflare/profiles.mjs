import {avatarSVG,placeholderSVG,validAvatar} from '../dist/avatar-model.mjs';
import {limitClassAction} from './classes.mjs';

// Accept the browser's small, square JPEG export only. Strip APP/COM metadata,
// including EXIF, and reject extra scans, trailing payloads and enormous dimensions.
export function cleanProfileJPEG(encoded) {
  if(typeof encoded!=='string'||encoded.length>273068||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('INVALID_PHOTO');
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  if(bytes.length>204800||bytes[0]!==255||bytes[1]!==216)throw Error('INVALID_PHOTO');
  let at=2,frame=false;const parts=[bytes.slice(0,2)];
  while(at<bytes.length) {
    const start=at;
    if(bytes[at++]!==255)throw Error('INVALID_PHOTO');
    const marker=bytes[at++],length=bytes[at]*256+bytes[at+1];
    if(length<2||at+length>bytes.length)throw Error('INVALID_PHOTO');
    if(marker===192) {
      if(frame||length<8||bytes[at+2]!==8||bytes[at+3]*256+bytes[at+4]!==512||bytes[at+5]*256+bytes[at+6]!==512)throw Error('INVALID_PHOTO');
      frame=true;
    } else if(![196,219,221,218,254].includes(marker)&&!(marker>=224&&marker<=239))throw Error('INVALID_PHOTO');
    if(marker===218) {
      if(!frame)throw Error('INVALID_PHOTO');
      let scan=at+length;
      while(scan<bytes.length-1) {
        if(bytes[scan++]!==255)continue;
        const code=bytes[scan++];
        if(code===0||(code>=208&&code<=215))continue;
        if(code!==217||scan!==bytes.length)throw Error('INVALID_PHOTO');
        parts.push(bytes.slice(start));
        const out=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;
      }
      throw Error('INVALID_PHOTO');
    }
    if(marker<224&&marker!==254)parts.push(bytes.slice(start,at+length));
    at+=length;
  }
  throw Error('INVALID_PHOTO');
}
const getProfile=(env,id)=>env.DB.prepare('SELECT kind,avatar_json,revision FROM member_profiles WHERE user_id=?').bind(id).first();
const projection=p=>({kind:p?.kind||'none',avatar:p?.kind==='avatar'?JSON.parse(p.avatar_json):null,revision:p?.revision||0});
async function visibleLearner(env,user,id) {
  return env.DB.prepare(`SELECT l.user_id FROM learners l WHERE l.id=? AND (
    l.user_id=? OR EXISTS(SELECT 1 FROM learner_parents p WHERE p.learner_id=l.id AND p.parent_id=?)
    OR (?='teacher' AND EXISTS(SELECT 1 FROM class_students s JOIN classes c ON c.id=s.class_id WHERE s.learner_id=l.id AND c.deleted_at IS NULL
      AND (c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?)))))`)
    .bind(id,user.id,user.id,user.requestedRole,user.id,user.id).first();
}
export async function handleProfile(request,env,user,{json,fail,readJSON}) {
  if(!user?.emailVerified)return fail('Please sign in.',401,'UNAUTHENTICATED');
  const path=new URL(request.url).pathname;
  if(request.method==='GET') {
    if(path==='/api/profiles/me')return json(projection(await getProfile(env,user.id)));
    const learner=path.match(/^\/api\/profiles\/learners\/([a-zA-Z0-9-]{1,80})\/image$/);
    let id=user.id;
    if(learner){const row=await visibleLearner(env,user,learner[1]);if(!row)return fail('Not found.',404,'NOT_FOUND');id=row.user_id;}
    else if(path!=='/api/profiles/me/image')return fail('Not found.',404,'NOT_FOUND');
    const p=id?await env.DB.prepare('SELECT kind,avatar_json,photo FROM member_profiles WHERE user_id=?').bind(id).first():null;
    const headers={'Content-Type':p?.kind==='photo'?'image/jpeg':'image/svg+xml','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'};
    return new Response(p?.kind==='photo'?new Uint8Array(p.photo):p?.kind==='avatar'?avatarSVG(JSON.parse(p.avatar_json)):placeholderSVG,{headers});
  }
  if(request.method!=='POST'||path!=='/api/profiles/me')return fail('Not found.',404,'NOT_FOUND');
  if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403,'INVALID_ORIGIN');
  let input;try{input=await readJSON(request,280000);}catch{return fail('Choose a smaller photo and try again.',400,'INVALID_INPUT');}
  if(!Number.isSafeInteger(input.revision)||input.revision<0||!['avatar','photo','none'].includes(input.kind))return fail('Invalid profile choice.',400,'INVALID_INPUT');
  let avatar=null,photo=null;
  if(input.kind==='avatar'){if(!validAvatar(input.avatar))return fail('Choose the avatar parts again.',400,'INVALID_AVATAR');avatar=JSON.stringify(input.avatar);}
  if(input.kind==='photo'){try{photo=cleanProfileJPEG(input.photo);}catch{return fail('This photo could not be saved. Choose a JPG, PNG or WebP image and try again.',400,'INVALID_PHOTO');}}
  if(!await limitClassAction(env,user.id,'save-profile',60))return fail('You have saved a lot of changes. Please try again in 15 minutes.',429,'RATE_LIMITED');
  const result=await env.DB.prepare(`INSERT INTO member_profiles(user_id,kind,avatar_json,photo,revision,updated_at)
    SELECT ?,?,?,?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM member_profiles WHERE user_id=?)
    ON CONFLICT(user_id) DO UPDATE SET kind=excluded.kind,avatar_json=excluded.avatar_json,photo=excluded.photo,revision=member_profiles.revision+1,updated_at=excluded.updated_at
    WHERE member_profiles.revision=? RETURNING revision`)
    .bind(user.id,input.kind,avatar,photo?.buffer||null,Date.now(),input.revision,user.id,input.revision).first();
  if(!result)return fail('Your picture changed in another tab. Reload your saved picture before saving again.',409,'PROFILE_CONFLICT');
  return json({kind:input.kind,avatar:input.kind==='avatar'?input.avatar:null,revision:result.revision});
}
