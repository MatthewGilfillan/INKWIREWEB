export const sessionKey=(classId,lessonId)=>`lesson-sessions/${classId}/${lessonId}.json`;
export async function readLessonSession(env,classId,lessonId){
 if(!env.WORKSHEETS||!lessonId)return null;
 const object=await env.WORKSHEETS.get(sessionKey(classId,lessonId));
 return object?{value:JSON.parse(new TextDecoder().decode(await object.arrayBuffer())),etag:object.etag}:null;
}
export const publicLessonSession=row=>row?{phase:row.phase,revision:row.revision,startedAt:row.startedAt,endedAt:row.endedAt||null,snapshots:row.snapshots||[],pending:row.pending||0}:null;
