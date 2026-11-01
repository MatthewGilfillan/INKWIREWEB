import {api,escape,requestId} from './workspace-shared.js';
import {createResourceLibrary} from './course-resources.js';
import {createGoogleFormsImport} from './google-forms-import.js';
import {createQuizPlayer,createFlashcards} from './quiz-player.js';
import {courseIcon} from './course-overview.js';

const blank=()=>({prompt:'',options:['',''],correctIndex:0,explanation:''});
const emptyQuiz=()=>({title:'Pre-lesson reading check',reflectionPrompt:'What would you like to discuss in class?',questions:[blank()]});
const editor=(q,i)=>`<fieldset class="quiz-edit-question"><legend>Question ${i+1}</legend><div class="quiz-card-meta"><span>MULTIPLE CHOICE · 1 POINT</span><div><button type="button" data-move="-1" aria-label="Move question ${i+1} up">↑</button><button type="button" data-move="1" aria-label="Move question ${i+1} down">↓</button><button type="button" data-duplicate aria-label="Duplicate question ${i+1}">Duplicate</button></div></div><label>Question<textarea data-question-prompt maxlength="1000" required rows="2">${escape(q.prompt)}</textarea></label><div class="quiz-editor-columns"><label>Answer choices <small>2–4 choices, one per line</small><textarea data-question-options rows="4" required>${escape(q.options.join('\n'))}</textarea></label><label>Correct choice<select data-question-correct><option value="-1" ${q.correctIndex<0?'selected':''}>Choose an answer</option>${[0,1,2,3].map(n=>`<option value="${n}" ${q.correctIndex===n?'selected':''}>Choice ${n+1} (${'ABCD'[n]})</option>`).join('')}</select><small>Check this again if you reorder choices.</small></label></div><label>Answer explanation <small>Optional; shown after submission</small><textarea data-question-explanation maxlength="1500" rows="2">${escape(q.explanation)}</textarea></label><button type="button" class="text-button danger-text" data-remove-question>Remove question</button></fieldset>`;

export function createQuizWorkbench({root,classId,lessonId,data:initial,onBusy,onDirty,onChanged,onStatus,onError}){
  let data=initial,usingDraft=data.aiDraft?.courseRevision===data.courseRevision && data.aiDraft?.quizRevision===data.revision?data.aiDraft:null;
  let mode=usingDraft || !data.quiz?'edit':'review',quiz=usingDraft?.quiz || data.quiz || emptyQuiz(),dirty=false,busy=false,alive=true,library=null,forms=null,player=null,showAnswers=true;
  const route=`/api/lesson-quizzes/classes/${classId}/lessons/${lessonId}`,$=s=>root.querySelector(s),events=new AbortController();
  const listen=(type,fn)=>root.addEventListener(type,fn,{signal:events.signal});
  function markDirty(value=true){dirty=value;onDirty(value);}
  function setBusy(value){busy=value;onBusy(value);}
  function readQuiz(){return {title:$('#quiz-title').value,reflectionPrompt:$('#quiz-reflection-prompt').value,questions:[...root.querySelectorAll('.quiz-edit-question')].map(q=>({prompt:q.querySelector('[data-question-prompt]').value,options:q.querySelector('[data-question-options]').value.split('\n').map(x=>x.trim()).filter(Boolean),correctIndex:Number(q.querySelector('[data-question-correct]').value),explanation:q.querySelector('[data-question-explanation]').value}))};}
  function valid(requireKeys=true){
    quiz=readQuiz();
    if(!quiz.title.trim() || !quiz.questions.length || quiz.questions.some(q=>!q.prompt.trim() || q.options.length<2 || q.options.length>4 || q.options.some(o=>o.length>500) || new Set(q.options).size!==q.options.length || q.correctIndex>=q.options.length || requireKeys && q.correctIndex<0)){onError('Add a title, question text, 2–4 different choices, and '+(requireKeys?'a correct answer for every question.':'check each answer choice.'));return false;}return true;
  }
  function refreshCards(){
    $('[data-quiz-questions]').innerHTML=quiz.questions.map(editor).join('');
    $('[data-question-count]').textContent=`${quiz.questions.length} questions · ${quiz.questions.length} points`;
  }
  function reviewHTML(){return `<div class="quiz-review-toolbar"><strong>${quiz.questions.length} questions · ${quiz.questions.length} points</strong><label class="quiz-answer-switch"><input type="checkbox" data-show-answers ${showAnswers?'checked':''}> Show answers</label></div>${quiz.questions.map((q,i)=>`<article class="quiz-review-card"><p class="quiz-card-meta">${i+1}. MULTIPLE CHOICE · 1 POINT</p><h3>${escape(q.prompt)}</h3><div class="quiz-review-options">${q.options.map((o,n)=>`<div class="${showAnswers && q.correctIndex===n?'is-correct':''}"><span>${showAnswers && q.correctIndex===n?'✓':'ABCD'[n]}</span>${escape(o)}</div>`).join('')}</div>${showAnswers && q.correctIndex<0?'<p class="quiz-notice">Choose the correct answer before assigning.</p>':''}${showAnswers && q.explanation?`<p class="quiz-explanation">${escape(q.explanation)}</p>`:''}</article>`).join('')}`;}
  function setMode(next){
    quiz=readQuiz();if(['play','flashcards'].includes(next) && !valid())return;
    onError('');player?.destroy();player=null;mode=next;$('.quiz-workbench').classList.toggle('is-game-mode',['play','flashcards'].includes(mode));
    root.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));
    $('[data-quiz-editor]').hidden=mode!=='edit';$('[data-quiz-review]').hidden=mode!=='review';$('[data-quiz-play]').hidden=mode!=='play';$('[data-quiz-flashcards]').hidden=mode!=='flashcards';$('[data-quiz-sidebar]').hidden=['play','flashcards'].includes(mode);
    $('.quiz-workspace-grid').classList.toggle('is-playing',['play','flashcards'].includes(mode));
    if(mode==='review')$('[data-quiz-review]').innerHTML=reviewHTML();
    if(mode==='play')player=createQuizPlayer({root:$('[data-quiz-play]'),quiz,preview:true});
    if(mode==='flashcards'){$('[data-quiz-flashcards]').replaceChildren();const holder=document.createElement('div');$('[data-quiz-flashcards]').append(holder);createFlashcards({root:holder,quiz});}
  }
  function render(){
    library?.reset();forms?.destroy();player?.destroy();library=null;forms=null;player=null;
    const stale=data.aiDraft && (data.aiDraft.courseRevision!==data.courseRevision || data.aiDraft.quizRevision!==data.revision),teacherDraft=data.aiDraft?.source==='Teacher draft';
    root.innerHTML=`<div class="quiz-workbench"><div class="quiz-studio-heading"><div class="quiz-studio-symbol">${courseIcon('quiz')}</div><div><p class="teacher-eyebrow">QUIZ STUDIO</p><h3>${escape(quiz.title)}</h3><p>${escape(data.lessonTitle)} <span class="quiz-draft-badge">${usingDraft?'Private draft':data.quiz?'Assigned':'New quiz'}</span></p></div></div><div class="quiz-toolbar"><div class="quiz-mode-buttons" aria-label="Quiz views"><button type="button" data-mode="edit">${courseIcon('pencil')} Edit</button><button type="button" data-mode="review">${courseIcon('checklist')} Questions</button><button type="button" data-mode="play">${courseIcon('video')} Preview game</button><button type="button" data-mode="flashcards">${courseIcon('book')} Flashcards</button></div><div class="quiz-save-buttons"><button type="button" class="teacher-button secondary" data-save-draft ${data.locked?'disabled':''}>Save draft</button><button type="button" class="teacher-button" data-assign ${data.locked?'disabled':''}>Save &amp; assign quiz</button></div></div><p class="planner-hint">Save draft keeps your quiz private. Save &amp; assign makes it available to students in this lesson.</p>${data.locked?'<p class="quiz-notice">A student has started this quiz. Its questions and answer key are locked to keep all saved scores comparable.</p>':`<div class="quiz-source-cards"><button type="button" data-source="upload"><span>${courseIcon('document')}</span><strong>Upload resources</strong><small>PDF, Word, Excel, CSV</small></button><button type="button" data-source="text"><span>${courseIcon('pencil')}</span><strong>Paste text &amp; use AI</strong><small>Passages, notes or a transcript</small></button><button type="button" data-source="forms"><span>${courseIcon('checklist')}</span><strong>Google Forms</strong><small>Import your existing questions</small></button><button type="button" data-source="scratch"><span>${courseIcon('quiz')}</span><strong>Write questions</strong><small>Build a reading check yourself</small></button></div><section class="quiz-forms-panel" data-import-panel hidden><div data-google-forms></div></section>`}<div class="quiz-workspace-grid"><aside data-quiz-sidebar>${!data.locked?`<section class="quiz-ai-tools"><h3>Make it your own</h3><p>Draft a reading check from your course materials, then review the answers.</p><details class="planner-source" data-upload-section><summary>Upload / manage course resources</summary><div data-quiz-library></div></details><label>Questions<select data-ai-question-count>${[3,5,8,10].map(n=>`<option ${n===5?'selected':''}>${n}</option>`).join('')}</select></label><label>Quiz brief or pasted source text<textarea data-ai-quiz-brief rows="5" maxlength="3000" placeholder="Paste source text or describe the reading and vocabulary to check."></textarea></label><button type="button" class="teacher-button secondary" data-draft-quiz ${data.aiAvailable?'':'disabled'}>Suggest questions with AI</button>${data.aiAvailable?'':'<p>OpenAI is not connected.</p>'}${data.aiDraft?`<div class="ai-review-notes"><h4>${teacherDraft?'Saved teacher draft':'AI draft · teacher review'}</h4>${stale?'<p>The course or quiz changed. Review the draft against the current lesson before saving.</p>':!usingDraft?'<button type="button" class="text-button" data-load-draft>Load saved draft</button>':'<p>Review and edit, then assign when ready.</p>'}<p>${escape(data.aiDraft.reviewNotes)}</p><details><summary>Source hints to check</summary><ol>${data.aiDraft.sources.map(s=>`<li>${escape(s)}</li>`).join('')}</ol></details></div>`:''}</section>`:'<p>Preview the game or use flashcards to review this quiz.</p>'}</aside><main class="quiz-editor-main"><form data-quiz-editor><fieldset ${data.locked?'disabled':''}><div class="quiz-editor-heading"><strong data-question-count>${quiz.questions.length} questions · ${quiz.questions.length} points</strong><span>Single-answer multiple choice</span></div><label>Quiz title<input id="quiz-title" maxlength="160" required value="${escape(quiz.title)}"></label><div data-quiz-questions>${quiz.questions.map(editor).join('')}</div><button type="button" class="teacher-button secondary" data-add-question>Add question</button><label>Reflection question <small>Optional; not scored</small><input id="quiz-reflection-prompt" maxlength="500" value="${escape(quiz.reflectionPrompt)}"></label></fieldset></form><section data-quiz-review hidden></section><section data-quiz-play hidden></section><section data-quiz-flashcards hidden></section></main></div></div>`;
    if(!data.locked){
      library=createResourceLibrary({root:$('[data-quiz-library]'),getClassId:()=>classId,onBusy:setBusy});library.load();
      forms=createGoogleFormsImport({root:$('[data-google-forms]'),onBusy:setBusy,onImport:imported=>{
        if(dirty && !confirm('Replace your unsaved questions with the selected Google Forms questions?'))return;
        quiz=imported;usingDraft=null;mode='edit';render();markDirty();onStatus('Imported into the editor. Review the questions and answer keys, then save a draft or assign.');
      }});
    }
    setMode(mode);
  }
  async function run(message,work){
    if(busy)return;setBusy(true);onError('');onStatus(message);const controls=[...root.querySelectorAll('button,input,select,textarea')],disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
    try{await work();}catch(e){if(alive){onError(e.message);onStatus('Your entries are still here. Nothing new has been assigned.');}}
    finally{if(alive){setBusy(false);controls.forEach((c,i)=>c.disabled=disabled[i]);}}
  }
  async function save(action){
    if(data.locked || !valid(action==='save'))return;
    await run(action==='save'?'Assigning quiz…':'Saving private draft…',async()=>{
      const result=await api(route,{action,revision:data.revision,courseRevision:data.courseRevision,quiz,...(action==='save-draft'?{draftRevision:data.aiDraft?.revision || 0}:usingDraft?{draftRevision:usingDraft.revision}:{})});if(!alive)return;
      data=result;usingDraft=action==='save-draft'?data.aiDraft:null;quiz=usingDraft?.quiz || data.quiz;markDirty(false);onChanged();mode='review';render();onStatus(action==='save'?'Quiz assigned to this lesson.':'Draft saved privately. Students cannot see it until you assign it.');
    });
  }
  async function generate(){
    if(readQuiz().questions.some(q=>q.prompt.trim()) && !confirm('Replace the question fields with a new AI draft? The assigned quiz stays unchanged until you save.'))return;
    const body={requestId:requestId(),courseRevision:data.courseRevision,lessonIds:[lessonId],questionCount:Number($('[data-ai-question-count]').value),brief:$('[data-ai-quiz-brief]').value};
    await run('Drafting questions from your course resources… This may take up to 2½ minutes.',async()=>{
      const result=await api(`/api/quiz-assistant/classes/${classId}`,body,{timeoutMs:155000});if(!alive)return;
      if(!result.saved.includes(lessonId))throw Error(result.notes || 'No draft saved. Refresh the course or add more source material.');
      data=await api(route);if(!alive)return;usingDraft=data.aiDraft;quiz=usingDraft.quiz;mode='edit';markDirty(false);onChanged();render();onStatus('AI draft saved privately. Check the questions, source hints and correct answers, then assign when ready.');
    });
  }
  listen('input',e=>{if(e.target.closest('[data-quiz-editor]')){markDirty();onError('');$('.quiz-draft-badge').textContent='Unsaved edits';}if(e.target.id==='quiz-title')$('.quiz-studio-heading h3').textContent=e.target.value;if(e.target.matches('[data-question-options]'))e.target.closest('fieldset').querySelector('[data-question-correct]').value='-1';});
  listen('change',e=>{
    if(e.target.matches('[data-show-answers]')){showAnswers=e.target.checked;$('[data-quiz-review]').innerHTML=reviewHTML();}
  });
  listen('submit',e=>e.preventDefault());
  listen('click',e=>{
    const b=e.target.closest('button');if(!b || busy || !alive)return;
    if(b.hasAttribute('data-mode'))setMode(b.dataset.mode);
    if(b.hasAttribute('data-save-draft'))save('save-draft');
    if(b.hasAttribute('data-assign'))save('save');
    if(b.hasAttribute('data-draft-quiz'))generate();
    if(b.hasAttribute('data-load-draft')){if(dirty && !confirm('Replace your unsaved questions with the saved draft?'))return;usingDraft=data.aiDraft;quiz=usingDraft.quiz;mode='edit';markDirty(false);render();}
    if(b.hasAttribute('data-source')){
      const source=b.dataset.source;setMode('edit');$('[data-import-panel]').hidden=source!=='forms';
      if(source==='forms'){$('[data-import-panel]').scrollIntoView({block:'start'});$('[data-forms-link]').focus();}
      if(source==='upload'){$('[data-upload-section]').open=true;$('[data-resource-files]').focus();}
      if(source==='text')$('[data-ai-quiz-brief]').focus();
      if(source==='scratch')$('[data-question-prompt]').focus();
    }
    if(b.matches('[data-add-question],[data-duplicate],[data-remove-question],[data-move]') && !data.locked){
      quiz=readQuiz();const card=b.closest('.quiz-edit-question'),i=[...root.querySelectorAll('.quiz-edit-question')].indexOf(card);
      if(b.matches('[data-add-question],[data-duplicate]')){if(quiz.questions.length>=20){onError('Use up to 20 questions.');return;}b.hasAttribute('data-duplicate')?quiz.questions.splice(i+1,0,structuredClone(quiz.questions[i])):quiz.questions.push(blank());}
      if(b.hasAttribute('data-remove-question')){if(quiz.questions.length===1){onError('Keep at least one question.');return;}quiz.questions.splice(i,1);}
      if(b.hasAttribute('data-move')){const to=i+Number(b.dataset.move);if(to<0 || to>=quiz.questions.length)return;[quiz.questions[i],quiz.questions[to]]=[quiz.questions[to],quiz.questions[i]];}
      refreshCards();markDirty();onError('');
    }
  });
  render();
  return {destroy(){alive=false;events.abort();library?.reset();forms?.destroy();player?.destroy();}};
}
