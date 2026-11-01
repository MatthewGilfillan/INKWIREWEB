import {escape} from './workspace-shared.js';
export function quizScoreHTML(result){
  if(!result?.latest)return `<p class="quiz-score quiz-score-pending">${result?.inProgress?'In progress · not submitted':'Not submitted'}</p>`;
  const {latest,best,attemptCount}=result,first=result.first || latest;
  return `<div class="quiz-score"><strong>${first.score}/${first.total} <span>· ${first.percentage}%</span></strong><p>First score${attemptCount>1?` · ${attemptCount-1} replay${attemptCount>2?'s':''} · Latest: ${latest.score}/${latest.total} (${latest.percentage}%) · Best: ${best.score}/${best.total} (${best.percentage}%)`:''}${result.inProgress?' · Replay in progress':''}</p></div>`;
}
export function teacherStudentHTML(lesson,assessmentHTML){
  const students=new Map((lesson.quiz?.results || []).map(s=>[s.learnerId,{learnerId:s.learnerId,name:s.name,quiz:s}]));
  for(const a of lesson.report?.assessments || [])students.set(a.learnerId,{...students.get(a.learnerId),...a,assessment:a});
  return [...students.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(student=>`<section class="timeline-student-assessment" data-assessed-student="${escape(student.learnerId)}"><div class="timeline-heading"><h5>${escape(student.name)}</h5>${student.assessment?`<span class="class-badge">${student.attendance==='absent'?'Absent':'Present'}</span>`:''}</div>${lesson.quiz?`<div class="student-quiz-score"><h6>Pre-lesson quiz</h6>${quizScoreHTML(student.quiz)}</div>`:''}${student.assessment?assessmentHTML(student.assessment):lesson.report?'<p class="planner-hint">No individual assessment published for this lesson.</p>':''}</section>`).join('') || '<p>No student results yet.</p>';
}
