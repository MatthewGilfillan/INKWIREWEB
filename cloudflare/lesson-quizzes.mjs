import {readQuizDraft,saveTeacherQuizDraft} from './quiz-assistant.mjs';
import {planningAvailable} from './planning-assistant.mjs';
import {lessonKey} from '../dist/lesson-feedback-model.mjs';
import {validateQuiz} from './quiz-model.mjs';
export {validateQuiz} from './quiz-model.mjs';
const text=(v,max,label)=>{if(typeof v!=='string' || v.length>max)throw Error(`Check ${label}.`);return v.trim();};
const result=row=>({score:row.score,total:row.total,percentage:Math.round(row.score/row.total*100),submittedAt:row.submitted_at,durationSeconds:Math.max(0,Math.round((row.submitted_at-row.started_at)/1000))});
export function quizResult(rows){
  const finished=rows.filter(r=>r.submitted_at!==null).sort((a,b)=>b.submitted_at-a.submitted_at || b.started_at-a.started_at || b.id.localeCompare(a.id));
  const latest=finished[0],best=finished.reduce((a,b)=>!a || b.score/b.total>a.score/a.total?b:a,null);
  return {status:latest?'submitted':rows.length?'in_progress':'not_submitted',attemptCount:finished.length,inProgress:rows.some(r=>r.submitted_at===null),latest:latest?result(latest):null,best:best?result(best):null};
}
// Family queries select only the linked learner's results, never classmates' answers.
export async function quizTimeline(env,classId,{learnerId=null,roster=[]}={}){
  const quizzes=(await env.DB.prepare('SELECT lesson_id,title,revision,questions FROM lesson_quizzes WHERE class_id=?').bind(classId).all()).results;
  if(!quizzes.length)return new Map();
  const attempts=(await env.DB.prepare(`SELECT id,lesson_id,learner_id,learner_name,started_at,submitted_at,score,total FROM quiz_attempts WHERE class_id=?${learnerId===null?'':' AND learner_id=?'}`).bind(...(learnerId===null?[classId]:[classId,learnerId])).all()).results;
  return new Map(quizzes.map(q=>{
    const rows=attempts.filter(a=>a.lesson_id===q.lesson_id),quiz={title:q.title,revision:q.revision,total:JSON.parse(q.questions).length};
    if(learnerId!==null)quiz.result=quizResult(rows);
    else{
      const names=new Map(rows.map(a=>[a.learner_id,a.learner_name]));for(const s of roster)names.set(s.id,s.name);
      quiz.results=[...names].map(([id,name])=>({learnerId:id,name,...quizResult(rows.filter(a=>a.learner_id===id))})).sort((a,b)=>a.name.localeCompare(b.name));
    }
    return [q.lesson_id,quiz];
  }));
}
export async function handleLessonQuiz(request,env,user,{json,fail,readJSON}){
  if(!user?.emailVerified)return fail('Please sign in.',401,'UNAUTHENTICATED');
  const match=new URL(request.url).pathname.match(/^\/api\/lesson-quizzes\/classes\/([a-f0-9-]{36})\/lessons\/([a-zA-Z0-9-]{1,80})$/);
  if(!match)return fail('Not found.',404);
  const [,classId,lessonId]=match,teacher=user.requestedRole==='teacher';
  if(!teacher && user.requestedRole!=='student')return fail('Use your own student account to take a quiz.',403,'FORBIDDEN');
  const classroom=await env.DB.prepare(`SELECT c.id,o.content,o.revision FROM classes c JOIN course_overviews o ON o.class_id=c.id WHERE c.id=? AND c.deleted_at IS NULL AND ${teacher?'(c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))':'EXISTS(SELECT 1 FROM class_students s JOIN learners l ON l.id=s.learner_id WHERE s.class_id=c.id AND l.user_id=?)'}`).bind(...(teacher?[classId,user.id,user.id]:[classId,user.id])).first();
  if(!classroom)return fail('Class not found.',404,'NOT_FOUND');
  const course=JSON.parse(classroom.content),lesson=course.lessons.find((l,i)=>lessonKey(l,i)===lessonId);
  if(!lesson)return fail('Lesson not found. Refresh the timeline.',404,'NOT_FOUND');
  const learner=teacher?null:await env.DB.prepare('SELECT l.id,l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? AND l.user_id=?').bind(classId,user.id).first();
  const read=()=>env.DB.prepare('SELECT * FROM lesson_quizzes WHERE class_id=? AND lesson_id=?').bind(classId,lessonId).first();
  let quiz=await read();
  const attempts=()=>env.DB.prepare('SELECT * FROM quiz_attempts WHERE class_id=? AND lesson_id=? AND learner_id=? ORDER BY started_at DESC,id DESC').bind(classId,lessonId,learner.id).all();
  const output=async()=>{
    const ai=teacher?{courseRevision:classroom.revision,aiAvailable:planningAvailable(env),aiDraft:await readQuizDraft(env,classId,lessonId)}:{};
    if(!quiz)return {teacher,lessonTitle:lesson.title,quiz:null,revision:0,...ai};
    const questions=JSON.parse(quiz.questions),definition={title:quiz.title,reflectionPrompt:quiz.reflection_prompt,questions:teacher?questions:questions.map(q=>({prompt:q.prompt,options:q.options}))};
    const base={teacher,lessonTitle:lesson.title,quiz:definition,revision:quiz.revision,cancelled:lesson.status==='cancelled'};
    if(teacher)return {...base,...ai,locked:Boolean(await env.DB.prepare('SELECT 1 FROM quiz_attempts WHERE class_id=? AND lesson_id=? LIMIT 1').bind(classId,lessonId).first())};
    const rows=(await attempts()).results;
    return {...base,result:quizResult(rows),active:rows.find(r=>r.submitted_at===null)?.id || null,attempts:rows.filter(r=>r.submitted_at!==null).map(r=>({id:r.id,...result(r),answers:JSON.parse(r.answers),reflection:r.reflection})),...(rows.some(r=>r.submitted_at!==null)?{review:questions.map(q=>({correctIndex:q.correctIndex,explanation:q.explanation}))}:{})};
  };
  if(request.method==='GET')return json(await output());
  if(request.method!=='POST')return fail('Use GET or POST.',405);
  if(request.headers.get('Origin')!==env.APP_ORIGIN || request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403,'INVALID_ORIGIN');
  let input;try{input=await readJSON(request,90000);}catch{return fail('Check the quiz data.',400,'INVALID_INPUT');}
  const now=Date.now();
  if(teacher){
    if(input.action==='save-draft'){
      if(!Number.isSafeInteger(input.draftRevision) || input.draftRevision<0 || input.courseRevision!==classroom.revision || input.revision!==(quiz?.revision || 0))return fail('The course or quiz changed. Reopen it before saving a draft.',409,'CONFLICT');
      let saved;try{saved=await saveTeacherQuizDraft(env,user,classId,lessonId,classroom.revision,input.revision,input.draftRevision,input.quiz);}catch(e){return fail(e.message,400,'INVALID_INPUT');}
      if(!saved)return fail('The draft changed, or a student started the quiz. Reopen before editing.',409,'CONFLICT');
      return json(await output());
    }
    if(input.draftRevision!==undefined){
      const draft=await readQuizDraft(env,classId,lessonId);
      if(!draft || draft.revision!==input.draftRevision || draft.courseRevision!==classroom.revision || draft.quizRevision!==(quiz?.revision || 0))return fail('The AI draft or course changed. Reopen the quiz and generate a fresh draft before assigning.',409,'CONFLICT');
    }
    let definition;try{
      if(input.action!=='save' || !Number.isSafeInteger(input.revision) || input.revision<0)throw Error('Refresh the quiz before saving.');
      definition=validateQuiz(input.quiz);
    }catch(e){return fail(e.message,400,'INVALID_INPUT');}
    // A started quiz keeps a stable answer key and denominator for every attempt.
    const saved=await env.DB.prepare(`INSERT INTO lesson_quizzes(class_id,lesson_id,revision,title,questions,reflection_prompt,updated_by,updated_at)
      SELECT ?,?,1,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM course_overviews WHERE class_id=? AND revision=?) AND (?=0 OR EXISTS(SELECT 1 FROM lesson_quizzes WHERE class_id=? AND lesson_id=?))
      ON CONFLICT(class_id,lesson_id) DO UPDATE SET revision=lesson_quizzes.revision+1,title=excluded.title,questions=excluded.questions,reflection_prompt=excluded.reflection_prompt,updated_by=excluded.updated_by,updated_at=excluded.updated_at
      WHERE lesson_quizzes.revision=? AND NOT EXISTS(SELECT 1 FROM quiz_attempts WHERE class_id=? AND lesson_id=?) RETURNING revision`).bind(classId,lessonId,definition.title,JSON.stringify(definition.questions),definition.reflectionPrompt,user.id,now,classId,classroom.revision,input.revision,classId,lessonId,input.revision,classId,lessonId).first();
    if(!saved)return fail('The quiz or course changed, or a student has already started. Refresh before editing. Started quizzes keep their original questions and answer key.',409,'CONFLICT');
    if(input.draftRevision!==undefined)await env.DB.prepare('DELETE FROM quiz_drafts WHERE class_id=? AND lesson_id=? AND revision=?').bind(classId,lessonId,input.draftRevision).run();
    quiz=await read();return json(await output());
  }
  if(!quiz)return fail('No quiz has been assigned to this lesson.',404,'NOT_FOUND');
  if(input.revision!==quiz.revision)return fail('The quiz changed. Close and reopen it before starting.',409,'CONFLICT');
  if(!/^[a-f0-9-]{36}$/.test(input.attemptId || ''))return fail('Reopen the quiz and try again.',400,'INVALID_INPUT');
  if(!['start','submit'].includes(input.action))return fail('Choose a quiz action.',400,'INVALID_INPUT');
  const owned=await env.DB.prepare('SELECT * FROM quiz_attempts WHERE id=? AND class_id=? AND lesson_id=? AND learner_id=?').bind(input.attemptId,classId,lessonId,learner.id).first();
  if(owned?.submitted_at!==null && owned)return json(await output());
  if(lesson.status==='cancelled')return fail('This lesson is cancelled. Your previous quiz results are still available.',409,'LESSON_CANCELLED');
  const questions=JSON.parse(quiz.questions);
  if(input.action==='start'){
    const inserted=await env.DB.prepare(`INSERT INTO quiz_attempts(id,class_id,lesson_id,learner_id,learner_name,quiz_revision,started_at,total)
      SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM lesson_quizzes WHERE class_id=? AND lesson_id=? AND revision=?) AND EXISTS(SELECT 1 FROM course_overviews WHERE class_id=? AND revision=?)
      AND (SELECT count(*) FROM quiz_attempts WHERE class_id=? AND lesson_id=? AND learner_id=?)<20 ON CONFLICT DO NOTHING RETURNING id`).bind(input.attemptId,classId,lessonId,learner.id,learner.name,quiz.revision,now,questions.length,classId,lessonId,quiz.revision,classId,classroom.revision,classId,lessonId,learner.id).first();
    if(!inserted && !(await attempts()).results.some(r=>r.submitted_at===null))return fail('This quiz has reached 20 attempts or has changed. Refresh to see your results.',409,'ATTEMPT_LIMIT');
  }else{
    if(!owned)return fail('Start the quiz from your own student account first.',404,'NOT_FOUND');
    let answers,reflection;try{
      answers=input.answers;reflection=text(input.reflection,2000,'your reflection',true);
      if(!Array.isArray(answers) || answers.length!==questions.length || answers.some((a,i)=>!Number.isInteger(a) || a<0 || a>=questions[i].options.length))throw Error('Answer every question before submitting.');
    }catch(e){return fail(e.message,400,'INVALID_INPUT');}
    const score=answers.reduce((n,a,i)=>n+Number(a===questions[i].correctIndex),0);
    const saved=await env.DB.prepare(`UPDATE quiz_attempts SET submitted_at=?,score=?,answers=?,reflection=? WHERE id=? AND learner_id=? AND submitted_at IS NULL
      AND EXISTS(SELECT 1 FROM course_overviews WHERE class_id=? AND revision=?) RETURNING id`).bind(now,score,JSON.stringify(answers),reflection,owned.id,learner.id,classId,classroom.revision).first();
    if(!saved){const retry=await env.DB.prepare('SELECT submitted_at FROM quiz_attempts WHERE id=? AND learner_id=?').bind(owned.id,learner.id).first();if(retry?.submitted_at===null)return fail('The course changed. Reopen the quiz before submitting.',409,'CONFLICT');}
  }
  return json(await output());
}
