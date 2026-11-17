import {cleanClassPalette} from '../dist/class-palettes.mjs';
import {limitClassAction} from './classes.mjs';
export async function handleClassPalette(request,env,user,cid,{json,fail,readJSON}){
 const row=await env.DB.prepare('SELECT c.name,o.content,o.revision FROM classes c LEFT JOIN course_overviews o ON o.class_id=c.id WHERE c.id=? AND c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))').bind(cid,user.id,user.id).first();
 if(!row)return fail('Class not found.',404);
 const course=row.content?JSON.parse(row.content):null;
 if(request.method==='GET')return json({classId:cid,className:row.name,classPalette:course?.classPalette||null,revision:row.revision||0,userId:user.id});
 if(request.method!=='POST')return fail('Use GET or POST.',405);
 if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403);
 let input,palette;try{input=await readJSON(request,4000);palette=cleanClassPalette(input.classPalette);}catch(error){return fail(error.message||'Choose a class palette.',400);}
 if(input.expectedUserId!==user.id)return fail('Your account changed. Reopen class colours.',401);
 if(!course)return fail('Save the class timetable before choosing its colours.',409);
 if(!Number.isInteger(input.revision)||input.revision!==row.revision)return fail('The class changed. Reopen class colours before saving.',409);
 if(!await limitClassAction(env,user.id,'class-palette',60))return fail('Please wait before changing colours again.',429);
 if(palette)course.classPalette=palette;else delete course.classPalette;
 const saved=await env.DB.prepare('UPDATE course_overviews SET content=?,revision=revision+1,updated_by=?,updated_at=? WHERE class_id=? AND revision=? RETURNING revision').bind(JSON.stringify(course),user.id,Date.now(),cid,input.revision).first();
 if(!saved)return fail('The class changed. Reopen class colours before saving.',409);
 return json({classPalette:palette,revision:saved.revision,userId:user.id});
}
