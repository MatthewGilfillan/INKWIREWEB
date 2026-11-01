import {quizTimeline} from './lesson-quizzes.mjs';
import {lessonTiming,billingSchedule} from '../dist/schedule-model.mjs';
import { lessonKey, lessonEnd, validateAssessment } from '../dist/lesson-feedback-model.mjs';
import { formatSummaryText } from '../dist/summary-format.mjs';
import { planningAvailable, reserveRequest } from './planning-assistant.mjs';
import { validateTranscript } from './transcript-summary.mjs';
import { generateLessonFeedback } from './lesson-feedback-ai.mjs';

const access = (env,user,classId) => env.DB.prepare(`SELECT c.id, o.content, o.revision FROM classes c LEFT JOIN course_overviews o ON o.class_id=c.id
 WHERE c.id=? AND c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))`).bind(classId,user.id,user.id).first();
const getRoster = async(env,classId) => (await env.DB.prepare(`SELECT l.id, l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? ORDER BY l.id`).bind(classId).all()).results;
const read = (env,classId,lessonId) => env.DB.prepare('SELECT * FROM lesson_feedback WHERE class_id=? AND lesson_id=?').bind(classId,lessonId).first();
const view = row => ({revision:row?.revision || 0,draft:row?JSON.parse(row.draft):null,published:row?.published?JSON.parse(row.published):null,busy:!!row && row.job_until>Date.now()});
const personal = (draft,extras={},roster=[]) => Object.fromEntries(draft.assessments.map(a=>[a.learnerId,{name:roster.find(s=>s.id===a.learnerId)?.name,attendance:a.attendance,ratings:a.ratings,quote:a.attendance==='present'?(extras[a.learnerId]?.quote || null):null,parentComment:a.parentNote || extras[a.learnerId]?.parentComment || null}]));

async function familyOverview(request,env,user,classId,{json,fail},teacherTimeline=false) {
  if(request.method!=='GET')return fail('Use GET.',405);
  const demo=user.requestedRole==='teacher' && new URL(request.url).searchParams.get('demo')==='1';
  if(!['student','parent'].includes(user.requestedRole) && !demo && !teacherTimeline)return fail('This overview is for students and parents.',403,'FORBIDDEN');
  if((demo || teacherTimeline) && !await access(env,user,classId))return fail('Class not found.',404,'NOT_FOUND');
  const learnerId=new URL(request.url).searchParams.get('learnerId') || '';
  const linked=teacherTimeline?await env.DB.prepare('SELECT c.name AS className,o.content FROM classes c LEFT JOIN course_overviews o ON o.class_id=c.id WHERE c.id=?').bind(classId).first():await env.DB.prepare(`SELECT l.id,l.display_name AS name,c.name AS className,o.content FROM learners l
    JOIN class_students s ON s.learner_id=l.id JOIN classes c ON c.id=s.class_id LEFT JOIN course_overviews o ON o.class_id=c.id
    WHERE c.id=? AND c.deleted_at IS NULL AND ${demo?'l.id=? AND EXISTS (SELECT 1 FROM demo_parent_profiles d WHERE d.class_id=c.id AND d.learner_id=l.id)':user.requestedRole==='student'?'l.user_id=?': 'l.id=? AND EXISTS (SELECT 1 FROM learner_parents p WHERE p.learner_id=l.id AND p.parent_id=?)'}`)
    .bind(...(demo?[classId,learnerId]:user.requestedRole==='student'?[classId,user.id]:[classId,learnerId,user.id])).first();
  if(!linked)return fail('Class not found.',404,'NOT_FOUND');
  if(!linked.content)return json({demo,teacher:teacherTimeline,serverNow:Date.now(),className:linked.className,learnerName:linked.name,course:null});
  const course=JSON.parse(linked.content), rows=(await env.DB.prepare('SELECT lesson_id,published FROM lesson_feedback WHERE class_id=? AND published IS NOT NULL').bind(classId).all()).results;
  const reports=new Map(rows.map(r=>[r.lesson_id,JSON.parse(r.published)])),billing=billingSchedule(course);
  const roster=teacherTimeline?await getRoster(env,classId):[],names=new Map(roster.map(s=>[s.id,s.name]));
  const quizzes=await quizTimeline(env,classId,teacherTimeline?{roster}:{learnerId:linked.id});
  return json({demo,teacher:teacherTimeline,canTakeQuiz:user.requestedRole==='student',serverNow:Date.now(),className:linked.className,learnerName:linked.name,course:{title:course.title,description:course.description,timeZone:course.timeZone,startTime:course.startTime,lessonMinutes:course.lessonMinutes,
    lessons:course.lessons.map((lesson,i)=>{
      const report=reports.get(lessonKey(lesson,i)), own=report?.students[linked.id];
      // Project fields on the server: never send roster, drafts, speaker labels,
      // private planning notes, or another learner's assessment to a family.
      let endsAt=null;try{endsAt=lessonEnd(course,lesson);}catch{}
      return {quiz:quizzes.get(lessonKey(lesson,i)) || null,endsAt,...lessonTiming(course,lesson),status:lesson.status || 'scheduled',rescheduledFrom:lesson.rescheduledFrom || null,billing:teacherTimeline || course.billingMode==='packs'?billing.get(lessonKey(lesson,i))?.label || '':'',id:lessonKey(lesson,i),number:i+1,title:lesson.title,date:lesson.date,section:lesson.section || '',goal:lesson.goal,reading:lesson.reading,
        homework:report?.homework ?? lesson.homework,homeworkUpdated:report?.homework!==null && report?.homework!==undefined,
        report:report?{summary:report.summary,publishedAt:report.publishedAt,assessment:own?{attendance:own.attendance,ratings:own.ratings,quote:own.quote,...(user.requestedRole==='parent' || demo?{parentComment:own.parentComment}:{})}:null,
          ...(teacherTimeline?{assessments:Object.entries(report.students || {}).map(([learnerId,assessment])=>({learnerId,name:assessment.name || names.get(learnerId) || 'Former student',attendance:assessment.attendance,ratings:assessment.ratings})).sort((a,b)=>a.name.localeCompare(b.name))}:{})}:null};
    })}});
}

export async function handleLessonFeedback(request,env,user,helpers) {
  const {json,fail,readJSON}=helpers;
  if(!user?.emailVerified)return fail('Please sign in.',401,'UNAUTHENTICATED');
  const path=new URL(request.url).pathname;
  const family=path.match(/^\/api\/lesson-feedback\/classes\/([a-f0-9-]{36})\/overview$/);
  const timeline=path.match(/^\/api\/lesson-feedback\/classes\/([a-f0-9-]{36})\/timeline$/);
  if(timeline){if(user.requestedRole!=='teacher')return fail('Teacher access required.',403,'FORBIDDEN');return familyOverview(request,env,user,timeline[1],helpers,true);}
  const demoParents=path.match(/^\/api\/lesson-feedback\/classes\/([a-f0-9-]{36})\/demo-parents$/);
  if(demoParents){
    if(user.requestedRole!=='teacher' || !await access(env,user,demoParents[1]))return fail('Class not found.',404,'NOT_FOUND');
    if(request.method!=='POST')return fail('Use POST.',405);
    if(request.headers.get('Origin')!==env.APP_ORIGIN || request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403,'INVALID_ORIGIN');
    await env.DB.prepare(`INSERT OR IGNORE INTO demo_parent_profiles(class_id,learner_id,created_by,created_at) SELECT class_id,learner_id,?,? FROM class_students WHERE class_id=?`).bind(user.id,Date.now(),demoParents[1]).run();
    return json({created:true});
  }
  if(family)return familyOverview(request,env,user,family[1],helpers);
  const match=path.match(/^\/api\/lesson-feedback\/classes\/([a-f0-9-]{36})\/lessons\/([a-zA-Z0-9-]{1,80})$/);
  if(!match)return fail('Not found.',404);
  if(user.requestedRole!=='teacher')return fail('Teacher access required.',403,'FORBIDDEN');
  const [,classId,lessonId]=match, classroom=await access(env,user,classId);
  if(!classroom || !classroom.content)return fail('Save a course overview first.',404,'NOT_FOUND');
  const course=JSON.parse(classroom.content), lesson=course.lessons.find((l,i)=>lessonKey(l,i)===lessonId);
  if(!lesson)return fail('Lesson not found. Reopen the course outline.',404,'NOT_FOUND');
  let endsAt=null;try{endsAt=lessonEnd(course,lesson);}catch{}
  const roster=await getRoster(env,classId), row=await read(env,classId,lessonId), state=view(row);
  if(request.method==='GET')return json({...state,roster,lesson:{title:lesson.title,homework:lesson.homework},endsAt,timeZone:course.timeZone,serverNow:Date.now(),courseRevision:classroom.revision,aiAvailable:planningAvailable(env)});
  if(request.method!=='POST')return fail('Use GET or POST.',405);
  if(request.headers.get('Origin')!==env.APP_ORIGIN || request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403,'INVALID_ORIGIN');
  if(endsAt===null || Date.now()<endsAt)return fail('Summary & Feedback opens at the scheduled end of this lesson. Save a valid lesson date and time first.',409,'LESSON_NOT_ENDED');
  let input,draft,file;
  try {
    input=await readJSON(request,770000);
    if(!['save','publish','correct'].includes(input.action) || !Number.isInteger(input.revision) || input.revision<0 || input.courseRevision!==classroom.revision)throw Error('The course changed. Close and reopen Summary & Feedback.');
    draft=validateAssessment(input.draft,roster,input.action!=='save');
    if(input.action==='publish'){
      if(!draft.assessments.length)throw Error('Add students to this class before publishing feedback.');
      file=validateTranscript(input);
      if(!/^[a-f0-9-]{36}$/.test(input.requestId || ''))throw Error('Reload the feedback form before publishing.');
    }
    if(input.action==='correct' && (!state.published || typeof input.summary!=='string' || !input.summary.trim() || input.summary.length>14000 || typeof input.homework!=='string' || input.homework.length>4000))throw Error('Check the summary and homework corrections.');
    if(input.action==='correct' && input.extras!==undefined){
      if(!Array.isArray(input.extras) || input.extras.length!==roster.length || new Set(input.extras.map(x=>x.learnerId)).size!==roster.length || input.extras.some(x=>!roster.some(s=>s.id===x.learnerId) || typeof x.quote!=='string' || x.quote.length>500 || typeof x.parentComment!=='string' || x.parentComment.length>1500))throw Error('Check each student’s quote and parent note.');
    }
  }catch(error){return fail(error.message==='BODY_TOO_LARGE'?'Choose a transcript smaller than 512 KiB.':error.message,400,'INVALID_INPUT');}
  if(input.action==='publish' && state.published?.requestToken===input.requestId)return json(state);
  if(input.action==='publish' && !planningAvailable(env))return fail('OpenAI is not connected. You can save ratings as a draft.',503,'AI_UNAVAILABLE');
  const now=Date.now(), token=input.action==='publish'?input.requestId:null;
  const updated=input.revision===0
    ? await env.DB.prepare(`INSERT INTO lesson_feedback(class_id,lesson_id,revision,draft,job_token,job_until,updated_by,updated_at)
        SELECT ?,?,1,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM course_overviews WHERE class_id=? AND revision=?) ON CONFLICT(class_id,lesson_id) DO NOTHING RETURNING revision`)
      .bind(classId,lessonId,JSON.stringify(draft),token,token?now+120000:0,user.id,now,classId,classroom.revision).first()
    : await env.DB.prepare(`UPDATE lesson_feedback SET revision=revision+1,draft=?,job_token=?,job_until=?,updated_by=?,updated_at=? WHERE class_id=? AND lesson_id=? AND revision=? AND job_until<=? AND EXISTS(SELECT 1 FROM course_overviews WHERE class_id=? AND revision=?) RETURNING revision`)
      .bind(JSON.stringify(draft),token,token?now+120000:0,user.id,now,classId,lessonId,input.revision,now,classId,classroom.revision).first();
  if(!updated)return fail('Another teacher changed this feedback or a report is still being generated. Close and reopen to load the latest version.',409,'CONFLICT');
  if(input.action==='save')return json(view(await read(env,classId,lessonId)));
  let report;
  try{
    if(input.action==='publish'){
      if(!await reserveRequest(env,user.id))throw Error('AI request limit reached. Your ratings are saved. Allow one minute between requests; up to 5 requests per teacher per UTC day.');
      const result=await generateLessonFeedback(env,file,draft,roster,lesson);
      report={summary:result.summary,homework:result.homework,students:personal(draft,result.extras,roster),provider:result.provider,model:result.model,requestId:result.requestId,requestToken:token};
    }else{
      const extras=input.extras?Object.fromEntries(input.extras.map(x=>[x.learnerId,{quote:x.quote.trim() || null,parentComment:x.parentComment.trim() || null}])):state.published.students;
      const corrected=input.extras?{...draft,assessments:draft.assessments.map(a=>({...a,parentNote:extras[a.learnerId].parentComment || ''}))}:draft;
      report={...state.published,summary:formatSummaryText(input.summary),homework:input.homework.trim(),students:personal(corrected,extras,roster)};
    }
    const current=await access(env,user,classId), newRoster=await getRoster(env,classId);
    if(!current || current.revision!==classroom.revision || JSON.stringify(newRoster)!==JSON.stringify(roster))throw Error('The schedule, course or roster changed during generation. Your ratings are saved; reopen the lesson before publishing.');
    report.publishedAt=Date.now();
    const saved=await env.DB.prepare(`UPDATE lesson_feedback SET published=?,revision=revision+1,job_token=NULL,job_until=0,updated_at=?
      WHERE class_id=? AND lesson_id=? AND revision=? AND (job_token=? OR (? IS NULL AND job_token IS NULL))
      AND EXISTS(SELECT 1 FROM course_overviews WHERE class_id=? AND revision=?)
      AND EXISTS(SELECT 1 FROM classes c WHERE c.id=? AND c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))) RETURNING revision`)
      .bind(JSON.stringify(report),report.publishedAt,classId,lessonId,updated.revision,token,token,classId,classroom.revision,classId,user.id,user.id).first();
    if(!saved)throw Error('The lesson changed before publication. Reopen it to see the latest report.');
    return json(view(await read(env,classId,lessonId)));
  }catch(error){
    await env.DB.prepare('UPDATE lesson_feedback SET job_token=NULL,job_until=0 WHERE class_id=? AND lesson_id=? AND revision=?').bind(classId,lessonId,updated.revision).run();
    return fail(error.message,502,'REPORT_NOT_PUBLISHED');
  }
}
