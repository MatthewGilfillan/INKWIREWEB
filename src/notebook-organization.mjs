import {PRINT_SECTION} from './notebook-model.mjs';
export const TEACHER_BOOK='teacher';
export const lessonSectionId=(lesson,index)=>'lesson-'+(lesson.id||'legacy-'+(index+1));
export function lessonSections(course){
 if(!course?.lessons?.length||course.autoNotebookSections===false)return [];
 return course.lessons.map((lesson,index)=>({id:lessonSectionId(lesson,index),title:(`Lesson ${index+1}`+(lesson.date?' · '+new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(lesson.date+'T12:00:00Z')):'')+' · '+lesson.title).slice(0,120),lessonId:lesson.id||'legacy-'+(index+1),position:index,automatic:true}));
}
export function organizeItems(items,metadata={}){
 const values=items.map((item,index)=>({...item,position:item.position??index,...metadata[item.id]}));
 const visible=values.filter(item=>!item.deletedAt),ids=new Set(visible.map(item=>item.id));
 for(const item of visible)if(item.parentId&&!ids.has(item.parentId))item.parentId=null;
 const byOrder=(a,b)=>(a.position??0)-(b.position??0)||a.id.localeCompare(b.id);
 const result=[],visited=new Set();function visit(parent,depth=0){for(const item of visible.filter(row=>(row.parentId||null)===parent).sort(byOrder)){if(visited.has(item.id))continue;visited.add(item.id);result.push({...item,depth:Math.min(depth,3)});visit(item.id,depth+1);}}
 visit(null);for(const item of visible)if(!visited.has(item.id))result.push({...item,parentId:null,depth:0});return result;
}
export function buildSections(course,custom,metadata={},hasNotes=false){
 const auto=lessonSections(course),all=[...auto,...custom.map((item,index)=>({...item,position:auto.length+index}))];
 // Existing lesson sections with content are retained when a plan is shortened.
 for(const [id,meta]of Object.entries(metadata))if(meta.automatic&&!all.some(item=>item.id===id))all.push({id,title:meta.title||meta.archivedTitle||'Archived lesson',automatic:true,position:all.length});
 if(!auto.length||hasNotes)all.unshift({id:PRINT_SECTION,title:'Notes',position:-1});
 return organizeItems(all,metadata);
}
export function descendants(items,id){const result=[id];for(let i=0;i<result.length;i++)for(const item of items)if(item.parentId===result[i]&&!result.includes(item.id))result.push(item.id);return result;}
