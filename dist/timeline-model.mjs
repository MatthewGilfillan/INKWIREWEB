const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function timelineState(lesson,now=Date.now()){
 const phase=lesson.session?.phase;
 if(phase==='running')return {tone:'live',label:'In progress',detail:'Teaching now'};
 if(phase==='ending')return {tone:'live',label:'Saving final work',detail:''};
 if(phase==='ended')return {tone:'past',label:'Taught',detail:lesson.report?'Feedback published':'Ready for feedback'};
 if(lesson.status==='cancelled')return {tone:'cancelled',label:'Cancelled',detail:''};
 if(finite(lesson.endsAt)&&lesson.endsAt<=now)return {tone:'past',label:'Past lesson',detail:lesson.report?'Feedback published':'Ready for feedback'};
 if(finite(lesson.startsAt)&&lesson.startsAt>now)return {tone:'upcoming',label:'Upcoming',detail:''};
 return {tone:'upcoming',label:'Not started',detail:finite(lesson.endsAt)&&lesson.endsAt>now?'Scheduled now':'Date or start to be confirmed'};
}
export function focusedTimeline(lessons,now=Date.now()){
 const items=lessons.map((lesson,index)=>({lesson,index})),active=items.filter(x=>['running','ending'].includes(x.lesson.session?.phase));
 const taught=items.filter(x=>x.lesson.session?.phase==='ended').sort((a,b)=>(b.lesson.session.endedAt||b.lesson.endsAt||0)-(a.lesson.session.endedAt||a.lesson.endsAt||0));
 const past=items.filter(x=>timelineState(x.lesson,now).tone==='past').sort((a,b)=>(b.lesson.endsAt||0)-(a.lesson.endsAt||0));
 const next=items.filter(x=>x.lesson.status!=='cancelled'&&!x.lesson.session?.phase&&((finite(x.lesson.startsAt)&&x.lesson.startsAt>=now)||(finite(x.lesson.endsAt)&&x.lesson.endsAt>now))).sort((a,b)=>(a.lesson.startsAt||0)-(b.lesson.startsAt||0))[0];
 const previous=taught[0]||past[0],chosen=new Set([...active.map(x=>x.index),...(previous?[previous.index]:[]),...(next?[next.index]:[])]);
 if(!chosen.size&&items.length){const candidate=items.find(x=>x.lesson.status!=='cancelled')||items[0];chosen.add(candidate.index);}
 return {indices:[...chosen].sort((a,b)=>a-b),previousIndex:previous?.index??null,nextIndex:next?.index??null};
}
