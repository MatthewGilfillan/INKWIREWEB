import {limitClassAction} from './classes.mjs';
import {lessonKey} from '../dist/lesson-feedback-model.mjs';

async function seenIds(env,userId){
 const object=await env.WORKSHEETS?.get('account-preferences/'+encodeURIComponent(userId)+'/notifications.json');
 if(!object)return [];
 const value=JSON.parse(new TextDecoder().decode(await object.arrayBuffer()));
 return Array.isArray(value.ids)?value.ids:[];
}
export async function teacherNotifications(env,user){
 if(user.requestedRole!=='teacher')return [];
 const classes=(await env.DB.prepare(`SELECT c.id,c.name,o.content,o.updated_at FROM classes c LEFT JOIN course_overviews o ON o.class_id=c.id
  WHERE c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))`).bind(user.id,user.id).all()).results;
 const submissions=(await env.DB.prepare(`SELECT a.id,a.class_id,a.lesson_id,a.learner_name,a.submitted_at,q.title,c.name FROM quiz_attempts a
  JOIN classes c ON c.id=a.class_id JOIN lesson_quizzes q ON q.class_id=a.class_id AND q.lesson_id=a.lesson_id
  JOIN class_students s ON s.class_id=a.class_id AND s.learner_id=a.learner_id
  WHERE a.submitted_at IS NOT NULL AND c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))
  ORDER BY a.submitted_at DESC LIMIT 50`).bind(user.id,user.id).all()).results;
 const courseFor=id=>{const content=classes.find(c=>c.id===id)?.content;return content?JSON.parse(content):null;};
 const items=submissions.map(row=>({id:'quiz:'+row.id,type:'submission',title:row.learner_name+' submitted a quiz',detail:row.name+' · '+row.title,at:row.submitted_at,classId:row.class_id,lessonIndex:courseFor(row.class_id)?.lessons.findIndex((lesson,index)=>lessonKey(lesson,index)===row.lesson_id)??-1}));
 for(const classroom of classes){
  const course=classroom.content?JSON.parse(classroom.content):null;
  course?.lessons.forEach((lesson,index)=>{if(lesson.status==='cancelled')items.push({id:'cancelled:'+classroom.id+':'+lessonKey(lesson,index),type:'cancellation',title:'Lesson cancelled',detail:classroom.name+' · '+lesson.title,at:classroom.updated_at,classId:classroom.id,lessonIndex:index});});
 }
 return items.sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id)).slice(0,100);
}
export async function handleNotifications(request,env,user,{json,fail,readJSON}){
 if(!user?.emailVerified)return fail('Please sign in.',401,'UNAUTHENTICATED');
 if(request.method==='GET'){
  const [items,seen]=await Promise.all([teacherNotifications(env,user),seenIds(env,user.id)]);
  return json({items:items.map(item=>({...item,read:seen.includes(item.id)}))});
 }
 if(request.method!=='POST')return fail('Use GET or POST.',405,'METHOD_NOT_ALLOWED');
 if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403,'INVALID_ORIGIN');
 let input;try{input=await readJSON(request,24000);}catch{return fail('Reload notifications and try again.',400,'INVALID_INPUT');}
 if(!input||Object.keys(input).some(key=>key!=='ids')||!Array.isArray(input.ids)||input.ids.length>100||input.ids.some(id=>typeof id!=='string'||id.length>180))return fail('Reload notifications and try again.',400,'INVALID_INPUT');
 if(!env.WORKSHEETS)return fail('Notifications are temporarily unavailable.',503,'UNAVAILABLE');
 if(!await limitClassAction(env,user.id,'read-notifications',300))return fail('Please try again shortly.',429,'RATE_LIMITED');
 const previous=await seenIds(env,user.id),ids=[...new Set([...input.ids,...previous])].slice(0,200);
 await env.WORKSHEETS.put('account-preferences/'+encodeURIComponent(user.id)+'/notifications.json',JSON.stringify({ids}),{httpMetadata:{contentType:'application/json'}});
 return json({success:true});
}
