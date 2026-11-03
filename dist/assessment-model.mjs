// EDUCADE keeps skill identity, curriculum alignment and teacher judgment separate.
export const achievementLevels = {
  beginning: {name:'Beginning',description:'Important components are emerging; the learning goal is not yet demonstrated consistently.'},
  approaching: {name:'Approaching',description:'Some components are secure; the full learning goal remains inconsistent or depends on instructional prompts.'},
  meeting: {name:'Meeting',description:'The learning goal is demonstrated consistently across suitable tasks and independently, with permitted accommodations.'},
  exceeding: {name:'Exceeding',description:'The learning goal is secure and the agreed extension criteria demonstrate greater depth, complexity or transfer.'}
};

export function learnerEvidence(lessons, learnerId) {
  return lessons.flatMap(lesson=>{
    const quiz=lesson.quiz?.results?.find(result=>result.learnerId===learnerId);
    const assessment=lesson.report?.assessments?.find(result=>result.learnerId===learnerId);
    return quiz?.latest || assessment ? [{lesson,quiz,assessment}] : [];
  });
}

export function evidenceSummary(records) {
  const firstAttempts=records.flatMap(record=>record.quiz?.latest?[record.quiz.first || record.quiz.latest]:[]);
  const scored=firstAttempts.filter(attempt=>Number.isFinite(attempt.score)&&Number.isFinite(attempt.total)&&attempt.total>0);
  const total=scored.reduce((sum,attempt)=>sum+attempt.total,0);
  return {quizzes:firstAttempts.length,feedback:records.filter(record=>record.assessment).length,
    present:records.filter(record=>record.assessment?.attendance==='present').length,
    accuracy:total?Math.round(scored.reduce((sum,attempt)=>sum+attempt.score,0)/total*100):null};
}

// Producer-independent envelope for future game adapters. No browser-posted
// envelope is trusted for authorization or achievement judgments.
export function validateGameEvidence(input, catalogue) {
  const text=(value,max)=>typeof value==='string' && value.trim().length>0 && value.length<=max;
  if(!input || input.version!==1 || !text(input.sourceId,100) || !text(input.eventId,160) || !text(input.activityId,160) || !text(input.classId,100) || !text(input.learnerId,100))throw Error('Check the evidence version, source, event, activity, class and learner IDs.');
  const skills=new Set(catalogue.groups.flatMap(group=>group.skills.map(skill=>skill.id)));
  if(!skills.has(input.skillId))throw Error('Use a registered skill ID, not a curriculum code.');
  if(!['independent','supported'].includes(input.support))throw Error('Record whether the response was independent or supported.');
  if(!Number.isFinite(input.score) || !Number.isFinite(input.total) || input.total<=0 || input.score<0 || input.score>input.total)throw Error('Check the response score and total.');
  if(!Number.isInteger(input.attempt) || input.attempt<1 || !text(input.occurredAt,40) || !/^\d{4}-\d\d-\d\dT.*Z$/.test(input.occurredAt) || !Number.isFinite(Date.parse(input.occurredAt)))throw Error('Include an attempt number and UTC response time.');
  return {version:1,sourceId:input.sourceId,eventId:input.eventId,activityId:input.activityId,classId:input.classId,learnerId:input.learnerId,skillId:input.skillId,score:input.score,total:input.total,support:input.support,attempt:input.attempt,occurredAt:input.occurredAt};
}
