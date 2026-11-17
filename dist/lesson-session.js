import {api,requestId} from './workspace-shared.js';
export function lessonStatus(lesson){
 if(lesson.session?.phase==='ending')return 'Saving final work';
 if(lesson.session?.phase==='ended')return 'Taught';
 if(lesson.session?.phase==='running')return 'In progress';
 return lesson.status==='cancelled'?'Cancelled':lesson.startsAt>Date.now()?'Upcoming':'Not started';
}
export function lessonSessionControls({root,classId,lesson,onChanged,onError}){
 const session=lesson.session,phase=session?.phase,button=document.createElement('button');button.type='button';button.className='teacher-button secondary';button.dataset.lessonSession=lesson.id;
 button.textContent=phase==='running'?'End lesson & save work':phase==='ending'?'Retry saving final work':phase==='ended'?'Start lesson again':'Start lesson';button.disabled=lesson.status==='cancelled'&&phase!=='running'&&phase!=='ending';root.prepend(button);
 if(phase==='ending'&&session.pendingIssues?.length){const note=document.createElement('p');note.className='planner-hint';note.textContent=session.pendingIssues.map(issue=>issue.title+': '+issue.message).join(' ');button.after(note);}
 let pendingId='';button.onclick=async()=>{
  const action=phase==='running'||phase==='ending'?'end':'start';
  if(!pendingId&&phase!=='ending'&&!confirm(action==='end'?'End this lesson? Posting will close and final Live Board versions will be saved in student notebooks and on this timeline.'+(lesson.zoom?.managed&&endZoom.checked?' The connected Zoom meeting will end too.':''):phase==='ended'?'Start this lesson again? Earlier final versions will stay saved.':'Start this lesson now? Actual teaching status is separate from the timetable.'))return;
  const retry=!!pendingId;pendingId||=requestId();button.disabled=true;
  try{const result=await api(`/api/lesson-sessions/classes/${classId}/lessons/${lesson.id}`);if(!retry&&(result.session?.revision||0)!==(session?.revision||0))throw Error('This lesson changed. Refresh the timeline before continuing.');await api(`/api/lesson-sessions/classes/${classId}/lessons/${lesson.id}`,{action,endZoom:action==='end'&&!!endZoom?.checked,revision:retry?(result.session?.revision||0):(session?.revision||0),expectedUserId:result.userId,requestId:pendingId});await onChanged();}
  catch(error){onError(error.message);button.disabled=false;}
 };
 let endZoom;if(phase==='running'&&lesson.zoom?.managed){const label=document.createElement('label');endZoom=document.createElement('input');endZoom.type='checkbox';endZoom.checked=true;label.append(endZoom,' End connected Zoom meeting too');button.after(label);}
 return button;
}
