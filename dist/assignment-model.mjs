export const assignmentStatus={assigned:'Not submitted',submitted:'Submitted',revision:'Revision requested',reviewed:'Reviewed'};
export function assignmentCounts(assignment,roster){
 const ids=new Set(roster.map(s=>s.id)),rows=(assignment.recipients||[]).filter(s=>ids.has(s.learnerId));
 return {total:rows.length,submitted:rows.filter(s=>['submitted','reviewed'].includes(s.status)).length,outstanding:rows.filter(s=>['assigned','revision'].includes(s.status)).length,reviewed:rows.filter(s=>s.status==='reviewed').length,unmarked:rows.filter(s=>s.status==='submitted').length};
}
export function markingQueue(recipients,filter='submitted'){
 return recipients.filter(r=>filter==='all'?true:filter==='outstanding'?['assigned','revision'].includes(r.status):filter==='reviewed'?r.status==='reviewed':['submitted','reviewed'].includes(r.status))
 .sort((a,b)=>(a.status==='submitted'?0:1)-(b.status==='submitted'?0:1)||(a.submittedAt||a.startedAt||Infinity)-(b.submittedAt||b.startedAt||Infinity)||a.name.localeCompare(b.name)||a.learnerId.localeCompare(b.learnerId));
}
export function nextUnmarked(queue,current){for(let n=1;n<=queue.length;n++){const i=(current+n)%queue.length;if(i!==current&&queue[i].status==='submitted')return i;}return -1;}
