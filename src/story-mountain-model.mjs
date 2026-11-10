import {templateById} from '../dist/live-board-templates.mjs';
import {standardsPacks} from '../dist/standards-registry.mjs';
import {authorColors,authorAppearance} from './board-author-styles.mjs';
import {reactionSummary} from './board-reactions.mjs';
export const plotStages=templateById('story-mountain').sections;
export const mountainCriteria=[{id:'sequence',label:'Plot and sequence'},{id:'reasoning',label:'Stage reasoning'},{id:'evidence',label:'Textual evidence'},{id:'character',label:'Character response and change'}];
export const mountainLevels=[{id:'unobserved',label:'Not enough evidence'},{id:'beginning',label:'Beginning'},{id:'developing',label:'Developing'},{id:'secure',label:'Secure'},{id:'extending',label:'Extending'}];
export const pypThemes=['Who we are','Where we are in place and time','How we express ourselves','How the world works','How we organize ourselves','Sharing the planet'];
export const mountainStandards=[{framework:'ccss-ela',scope:'g6',code:'RL.6.3',description:'Explain how episodes develop the plot and how characters respond or change as events move toward resolution.'},{framework:'ccss-ela',scope:'g6',code:'RL.6.1',description:'Support analysis and inferences with relevant textual evidence.'}];
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max)=>typeof value==='string'&&value.trim().length<=max?value.trim():fail('Shorten the activity text and try again.');
export function cleanStorySettings(input,template='story-mountain'){
 const definition=templateById(template);if(!definition)fail('Choose a registered activity template.');
 const bookTitle=text(input.bookTitle||'',160),lessonId=text(input.lessonId||'',80),exitQuestion=text(input.exitQuestion??'Which event is the climax, and why?',500);
 if(!Array.isArray(input.standards)||input.standards.length>8)fail('Choose up to eight activity standards.');
 const standards=input.standards.map(s=>{const pack=standardsPacks.find(p=>p.id===s?.framework);if(!pack&&s?.framework!=='custom')fail('Choose a standards framework.');const scope=text(s.scope||'',80);if(pack&&scope&&!pack.scopes.some(v=>v.id===scope))fail('Choose a valid grade or stage.');const code=text(s.code||'',100),description=text(s.description||'',1200);if(!code||!description)fail('Give each standard a code and learning target.');return {framework:s.framework,scope,code,description};});
 const pypTheme=template==='ib-pyp-unit-planner'?text(input.pypTheme||'',120):'';if(pypTheme&&!pypThemes.includes(pypTheme))fail('Choose a PYP transdisciplinary theme.');return {bookTitle,lessonId,exitQuestion,standards,pypTheme};
}
export function cleanStoryEvent(input,old={},template='story-mountain'){
 const definition=templateById(template);if(!definition)fail('Choose a registered activity template.');
 const stage=input.stage??old.stage??definition.sections[0].id;if(!definition.sections.some(s=>s.id===stage))fail('Choose one of this activity’s sections.');
 return {stage,evidence:text(input.evidence??old.evidence??'',1600),reference:text(input.reference??old.reference??'',160),reasoning:text(input.reasoning??old.reasoning??'',1600),character:text(input.character??old.character??'',1600)};
}
export function moveStoryEvent(board,post,input){
 if(!templateById(board.template)?.sections.some(s=>s.id===input.stage))fail('Choose a valid activity section.');
 const rows=board.posts.filter(p=>!p.deleted&&p.id!==post.id&&(p.stage||'exposition')===input.stage).sort((a,b)=>(a.position??a.createdAt)-(b.position??b.createdAt));
 const index=input.beforeId?rows.findIndex(p=>p.id===input.beforeId):rows.length;if(index<0)fail('The target event moved. Refresh before trying again.',409);
 let left=index?rows[index-1].position??rows[index-1].createdAt:0,right=index<rows.length?rows[index].position??rows[index].createdAt:left+2048;
 if(right-left<0.0001){rows.forEach((row,i)=>{row.position=(i+1)*1024;row.version++;});left=index?rows[index-1].position:0;right=index<rows.length?rows[index].position:left+2048;}
 post.stage=input.stage;post.position=(left+right)/2;post.version++;post.updatedAt=Date.now();
}
export function cleanTeams(input,roster){
 if(!['individual','shared'].includes(input.teamMode)||!Array.isArray(input.teams)||input.teams.length>20)fail('Choose valid teams and a response mode.');
 const enrolled=new Set(roster.map(p=>p.id)),seen=new Set(),ids=new Set();
 const teams=input.teams.map(t=>{if(typeof t.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(t.id)||ids.has(t.id))fail('Choose unique team identifiers.');ids.add(t.id);const name=text(t.name||'',60);if(!name||!authorColors.some(c=>c.id===t.color)||!Array.isArray(t.members))fail('Give every team a name, colour, and members.');const members=t.members.map(id=>{if(!enrolled.has(id)||seen.has(id))fail('Assign each enrolled student to at most one team.');seen.add(id);return id;});return {id:t.id,name,color:t.color,members};});return {teams,teamMode:input.teamMode};
}
export const teamFor=(b,learnerId)=>b.teams?.find(t=>t.members.includes(learnerId));
export const contributed=(p,learnerId)=>p.learnerId===learnerId||p.contributors?.some(c=>c.learnerId===learnerId);
export function mayEditEvent(board,post,scope,user){return scope.teacher||post.authorId===user.id||board.teamMode==='shared'&&Boolean(teamFor(board,scope.learnerId)?.members.includes(post.learnerId));}
export function publicStoryPost(b,p){const {reactionCounts,reactionTotal}=reactionSummary(p,'');return {id:p.id,title:p.title,text:p.text,url:p.url,imageId:p.imageId,authorName:p.authorName,teacher:p.teacher,version:p.version,createdAt:p.createdAt,updatedAt:p.updatedAt,stage:p.stage||'exposition',position:p.position??p.createdAt,evidence:p.evidence||'',reference:p.reference||'',reasoning:p.reasoning||'',character:p.character||'',teamId:teamFor(b,p.learnerId)?.id||'',appearance:authorAppearance(b,p.authorId),reactionCounts,reactionTotal,contributors:(p.contributors||[]).map(c=>({name:c.name})),comments:p.comments.filter(c=>!c.deleted).map(c=>({text:c.text,authorName:c.authorName,teacher:c.teacher,createdAt:c.createdAt}))};}
export function captureMountain(board,user){
 const value={id:user.requestId,title:board.title,prompt:board.prompt,template:board.template,createdAt:Date.now(),sourceRevision:board.revision,bookTitle:board.bookTitle||'',pypTheme:board.pypTheme||'',standards:structuredClone(board.standards||[]),lessonId:board.lessonId||'',teams:(board.teams||[]).map(({id,name,color})=>({id,name,color})),posts:[...board.posts,...rankingEvidence(board)].filter(p=>!p.deleted).map(p=>publicStoryPost(board,p))};
 if(JSON.stringify(value).length>2000000)fail('This snapshot is too large. Shorten long entries before saving.');return value;
}
export function recordMountainReview(board,input,scope){
 if(!scope.roster.some(p=>p.id===input.learnerId))fail('Choose a student currently enrolled in this class.');
 board.reviews||=[];let row=board.reviews.find(r=>r.learnerId===input.learnerId);if(input.reviewVersion!==(row?.version||0))fail('This assessment changed. Reload the student before saving.',409);
 if(!input.ratings||mountainCriteria.some(c=>!mountainLevels.some(l=>l.id===input.ratings[c.id]))||Object.keys(input.ratings).some(k=>!mountainCriteria.some(c=>c.id===k)))fail('Choose a judgment for each criterion.');
 if(!['independent','supported','not-recorded'].includes(input.support))fail('Record the support provided.');
 if(!Array.isArray(input.evidenceIds)||input.evidenceIds.length>40||new Set(input.evidenceIds).size!==input.evidenceIds.length)fail('Choose up to forty evidence cards.');
 const evidence=input.evidenceIds.map(id=>{const p=[...board.posts,...rankingEvidence(board)].find(p=>p.id===id&&!p.deleted&&contributed(p,input.learnerId));if(!p)fail('Choose this student’s own or shared-team contributions as evidence.');return publicStoryPost(board,p);});
 const reflection=board.reflections?.find(r=>r.learnerId===input.learnerId)?.answer||'';
 if(input.action==='publish-review'&&Object.values(input.ratings).some(v=>v!=='unobserved')&&!evidence.length&&!reflection)fail('Attach evidence or an individual exit response before publishing a judgment.');
 const review={ratings:{...input.ratings},support:input.support,feedback:text(input.feedback||'',2400),evidenceIds:[...input.evidenceIds],updatedAt:Date.now()};
 if(!row){row={learnerId:input.learnerId,version:0,history:[]};board.reviews.push(row);}row.version++;row.draft=review;
 if(input.action==='publish-review'){const published={...review,id:input.requestId,publishedAt:Date.now(),title:board.title,template:board.template,bookTitle:board.bookTitle||'',pypTheme:board.pypTheme||'',standards:structuredClone(board.standards||[]),evidence,reflection,sourceRevision:board.revision,sharedTeamEvidence:evidence.some(p=>p.contributors.length>1)};if(row.published)row.history=[...(row.history||[]),row.published].slice(-12);row.published=published;}
 return row;
}

export function criteriaFor(template){return template==='story-mountain'?mountainCriteria:[{id:'sequence',label:'Organization of ideas'},{id:'reasoning',label:'Reasoning and justification'},{id:'evidence',label:'Relevant evidence'},{id:'character',label:'Reflection and transfer'}];}
export function rankingEvidence(board){if(templateById(board.template)?.layout!=='ranking')return [];return (board.rankings||[]).map(r=>({id:r.id,authorId:r.authorId,authorName:r.name,learnerId:r.learnerId,contributors:[{learnerId:r.learnerId,name:r.name}],teacher:false,version:r.version,createdAt:r.createdAt,updatedAt:r.updatedAt,title:r.name+'’s ranking',text:r.order.map((id,i)=>(i+1)+'. '+(board.rankingItems.find(item=>item.id===id)?.text||'Item')).join('\n'),reasoning:r.reasoning,character:r.reflection||'',evidence:'',reference:'',stage:templateById(board.template).sections[0].id,position:r.createdAt,comments:[],likes:[],url:'',imageId:''}));}
export function cleanRankingSettings(board,input){
 if(templateById(board.template)?.layout!=='ranking')return {};
 let rankingItems=board.rankingItems||[];if(input.rankingText!==undefined){const lines=text(input.rankingText,2600).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(lines.length<2||lines.length>15||lines.some(s=>s.length>160)||new Set(lines).size!==lines.length)fail('Use two to fifteen unique items, one per line, with up to 160 characters each.');if(lines.join('\n')!==rankingItems.map(i=>i.text).join('\n')){if(board.rankings?.length)fail('Students have submitted rankings. Create a new activity to change its items.',409);rankingItems=lines.map((label,i)=>({id:'item-'+(i+1),text:label}));}}
 if(input.revealRankings!==undefined&&typeof input.revealRankings!=='boolean')fail('Choose whether class rankings are visible.');return {rankingItems,rankingItemsVersion:(board.rankingItemsVersion||0)+(JSON.stringify(rankingItems)!==JSON.stringify(board.rankingItems||[])?1:0),revealRankings:input.revealRankings??board.revealRankings??false};
}
export function saveRanking(board,input,scope,user){
 if(templateById(board.template)?.layout!=='ranking'||scope.teacher||!scope.learnerId)fail('Use an enrolled student account for an individual ranking.',403);if(input.itemsVersion!==board.rankingItemsVersion)fail('The ranking items changed. Reload before submitting.',409);
 const items=board.rankingItems||[];if(!Array.isArray(input.order)||input.order.length!==items.length||new Set(input.order).size!==items.length||input.order.some(id=>!items.some(item=>item.id===id)))fail('Rank every item exactly once.');
 const previous=board.rankings?.find(r=>r.learnerId===scope.learnerId);if(input.version!==(previous?.version||0))fail('Your ranking changed in another window. Reload before submitting.',409);const reasoning=text(input.reasoning||'',2400),reflection=text(input.reflection||'',1600);if(!reasoning)fail('Explain your ranking before submitting.');
 const row={id:previous?.id||input.requestId,learnerId:scope.learnerId,authorId:user.id,name:scope.authorName,order:[...input.order],initialOrder:previous?.initialOrder||[...input.order],reasoning,reflection,version:(previous?.version||0)+1,createdAt:previous?.createdAt||Date.now(),updatedAt:Date.now()};board.rankings=[...(board.rankings||[]).filter(r=>r.learnerId!==scope.learnerId),row];
}
