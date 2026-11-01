import {escape} from './workspace-shared.js';

// User-supplied looping soundtrack and separate, quiet synthesised effects.
// Music starts only after the student enables it.
function createAudio(onMusicError){
  let context=null,music=false,effects=true,closed=false,musicRevision=0;
  const track=new Audio('/assets/quiz-lofi-chill.mp3');track.dataset.quizMusic='';track.hidden=true;track.preload='none';track.loop=true;track.volume=.2;
  const failed=()=>{if(closed || !music)return;music=false;track.pause();onMusicError();};
  track.addEventListener('error',failed);
  const visibility=()=>{if(document.hidden)track.pause();else if(music && !closed)track.play().catch(failed);};
  document.addEventListener('visibilitychange',visibility);
  function ready(){
    if(closed)return false;
    try{context ||= new (window.AudioContext || window.webkitAudioContext)();context.resume().catch(()=>{});return true;}catch{return false;}
  }
  function tone(frequency,duration=.14,volume=.045,delay=0){
    if(!context || document.hidden || context.state==='closed')return;
    const start=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.value=frequency;
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.02);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain);gain.connect(context.destination);osc.start(start);osc.stop(start+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  return {
    element:track,
    effect(success=false){if(effects && ready()){if(success==='incorrect'){tone(293.66,.2,.035);tone(261.63,.24,.03,.15);}else{tone(success?523.25:392);if(success){tone(659.25,.18,.04,.12);tone(783.99,.25,.04,.24);}}}},
    effects(value){effects=value;if(value)this.effect();},
    async music(value){
      const revision=++musicRevision;music=value;if(!value){track.pause();return true;}
      try{await track.play();return revision===musicRevision && music && !closed;}
      catch{if(revision===musicRevision)failed();return false;}
    },
    volume(value){track.volume=Math.min(1,Math.max(0,value));},
    destroy(){closed=true;music=false;musicRevision++;document.removeEventListener('visibilitychange',visibility);track.pause();track.removeAttribute('src');track.load();track.remove();context?.close().catch(()=>{});context=null;},
  };
}

export function createQuizPlayer({root,quiz,preview=false,progress=[],onAnswer,onFinish,onDirty=()=>{}}){
  const feedbacks=Array(quiz.questions.length).fill(null),answers=Array(quiz.questions.length).fill(null);
  for(const saved of progress){feedbacks[saved.questionIndex]=saved;answers[saved.questionIndex]=saved.answerIndex;}
  let index=Math.min(progress.length,quiz.questions.length-1),reflection='',pending=false,alive=true,timer=null,pace=0,deadline=0,music=false,musicRequest=0,effects=true,motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $=s=>root.querySelector(s),events=new AbortController();
  const audio=createAudio(()=>{music=false;if(!alive)return;$('[data-music]').textContent='Music off';$('[data-music]').setAttribute('aria-pressed','false');$('[data-music-status]').textContent='Music could not play. Tap Music to try again.';});
  const listen=(type,fn)=>root.addEventListener(type,fn,{signal:events.signal});
  root.innerHTML=`<section class="quiz-game" data-theme="inkwire"><div class="quiz-game-top"><span class="quiz-game-brand">INK WIRE <small>${preview?'TEACHER PREVIEW':'READ • THINK • DISCOVER'}</small></span><div class="quiz-game-settings"><button type="button" data-music aria-pressed="false">Music off</button><button type="button" data-sounds aria-pressed="true">Sound on</button><button type="button" data-motion aria-pressed="${motion}">Motion ${motion?'on':'off'}</button></div></div><div class="quiz-music-controls"><span>Lofi Chill · looping soundtrack</span><label class="quiz-volume">Volume <input type="range" min="0" max="100" value="20" step="5" data-music-volume aria-label="Music volume"><output data-music-volume-value>20%</output></label></div><p data-music-status role="status"></p><div data-game-stage></div></section>`;
  const game=$('.quiz-game');game.append(audio.element);game.classList.toggle('reduce-motion',!motion);
  function stopTimer(){clearInterval(timer);timer=null;}
  function startTimer(){stopTimer();deadline=Date.now()+pace*1000;const tick=()=>{if(!$('[data-pace-left]'))return;const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));$('[data-pace-left]').textContent=pace?(remaining?remaining+'s':'Take your time'):'No time limit';if(!remaining)stopTimer();};tick();if(pace)timer=setInterval(tick,250);}
  function render(){
    stopTimer();const q=quiz.questions[index],feedback=feedbacks[index],correct=feedback?.answerIndex===feedback?.correctIndex,complete=feedbacks.filter(Boolean).length;
    $('[data-game-stage]').innerHTML=`<div class="quiz-game-progress"><span>Question ${index+1} of ${quiz.questions.length}</span><progress value="${complete}" max="${quiz.questions.length}" aria-label="Answers submitted"></progress><span data-pace-left>${feedback?'Answer submitted':'No time limit'}</span></div><h3 class="quiz-game-question" tabindex="-1">${escape(q.prompt)}</h3><div class="quiz-game-answers" role="group" aria-label="Answer choices">${q.options.map((option,n)=>`<button type="button" class="quiz-answer answer-${n}${feedback?(n===feedback.correctIndex?' is-correct':n===feedback.answerIndex?' is-incorrect':' is-other'):''}" data-answer="${n}" aria-pressed="${answers[index]===n}" ${feedback?'disabled':''}><span class="quiz-answer-letter">${'ABCD'[n]}</span><span>${escape(option)}</span><span class="quiz-answer-check" aria-hidden="true">${feedback?(n===feedback.correctIndex?'✓':n===feedback.answerIndex?'×':''):answers[index]===n?'✓':''}</span></button>`).join('')}</div>${feedback?`<section class="quiz-answer-feedback ${correct?'is-correct':'is-incorrect'}" role="status" tabindex="-1"><strong class="quiz-feedback-word"><span aria-hidden="true">${correct?'✓':'×'}</span> ${correct?'Correct':'Incorrect'}</strong><p><b>Correct answer:</b> ${escape(q.options[feedback.correctIndex])}</p>${feedback.explanation?`<p>${escape(feedback.explanation)}</p>`:''}<small>${preview?'Preview only':complete===quiz.questions.length?'Quiz complete · your score is saved.':'Answer saved.'}</small></section>`:''}<p data-game-error role="alert"></p><div class="quiz-game-footer"><button type="button" data-previous ${index?'':'disabled'}>Previous</button><label class="quiz-pace">Practice pace<select data-pace ${feedback?'disabled':''}><option value="0">Untimed</option>${[30,60,90].map(n=>`<option value="${n}" ${pace===n?'selected':''}>${n} seconds</option>`).join('')}</select></label>${feedback?`<button type="button" class="game-next" data-next>${index===quiz.questions.length-1?'See results':'Continue'} →</button>`:`<button type="button" class="game-next" data-submit-answer ${answers[index]===null?'disabled':''}>Submit answer</button>`}</div><p class="quiz-game-caption">${preview?'Preview only · no student score is recorded.':'Your first completed score is recorded. Replays are for practice.'} The pace timer never reduces your score.</p>`;
    if(!feedback)startTimer();
  }
  function finish(){
    stopTimer();const score=feedbacks.filter(f=>f.answerIndex===f.correctIndex).length;
    $('[data-game-stage]').innerHTML=`<div class="quiz-game-finish quiz-celebrate"><span class="quiz-game-spark" aria-hidden="true">✦</span><h3 tabindex="-1">${preview?'Preview complete':'Quiz complete'}</h3><p class="quiz-game-score">${score} / ${quiz.questions.length}</p><p>${preview?'No student score was recorded.':'Your score is saved. Your first score stays on the lesson timeline when you replay.'}</p>${!preview && quiz.reflectionPrompt?`<label>${escape(quiz.reflectionPrompt)} <small>Optional; not scored</small><textarea data-player-reflection maxlength="2000" rows="3">${escape(reflection)}</textarea></label>`:''}<p data-game-error role="alert"></p><button type="button" class="game-next" ${preview?'data-replay':'data-finish-player'}>${preview?'Play again':quiz.reflectionPrompt?'Save reflection & view results':'View results & replay'}</button></div>`;
    $('[data-game-stage] h3').focus();
  }
  listen('click',async event=>{
    const button=event.target.closest('button');if(!button || pending || !alive)return;
    if(button.hasAttribute('data-music')){
      music=!music;const request=++musicRequest;$('[data-music-status]').textContent='';button.textContent='Music '+(music?'on':'off');button.setAttribute('aria-pressed',music);
      const enabled=await audio.music(music);if(alive && request===musicRequest && !enabled){music=false;button.textContent='Music off';button.setAttribute('aria-pressed','false');}
    }
    if(button.hasAttribute('data-sounds')){effects=!effects;audio.effects(effects);button.textContent='Sound '+(effects?'on':'off');button.setAttribute('aria-pressed',effects);}
    if(button.hasAttribute('data-motion')){motion=!motion;game.classList.toggle('reduce-motion',!motion);button.textContent='Motion '+(motion?'on':'off');button.setAttribute('aria-pressed',motion);}
    if(button.hasAttribute('data-answer') && !feedbacks[index]){answers[index]=Number(button.dataset.answer);audio.effect();onDirty(true);root.querySelectorAll('[data-answer]').forEach(el=>{const selected=Number(el.dataset.answer)===answers[index];el.setAttribute('aria-pressed',selected);el.querySelector('.quiz-answer-check').textContent=selected?'✓':'';});$('[data-submit-answer]').disabled=false;}
    if(button.hasAttribute('data-submit-answer') && answers[index]!==null && !feedbacks[index]){
      pending=true;button.disabled=true;button.textContent='Submitting…';$('[data-game-error]').textContent='';
      try{
        const feedback=preview?{questionIndex:index,answerIndex:answers[index],correctIndex:quiz.questions[index].correctIndex,explanation:quiz.questions[index].explanation}:await onAnswer({questionIndex:index,answerIndex:answers[index]});
        if(!alive)return;feedbacks[index]=feedback;answers[index]=feedback.answerIndex;onDirty(false);audio.effect(feedback.answerIndex===feedback.correctIndex?true:'incorrect');render();$('.quiz-answer-feedback').focus();
      }catch(e){if(alive){$('[data-game-error]').textContent=e.message;button.disabled=false;button.textContent='Submit answer';}}
      finally{pending=false;}
    }
    if(button.hasAttribute('data-next') && feedbacks[index]){if(index===quiz.questions.length-1)finish();else{index++;render();$('.quiz-game-question').focus();}}
    if(button.hasAttribute('data-previous') && index){index--;render();$('.quiz-game-question').focus();}
    if(button.hasAttribute('data-finish-player')){
      reflection=$('[data-player-reflection]')?.value || '';pending=true;button.disabled=true;
      try{await onFinish({reflection});}catch(e){if(alive){$('[data-game-error]').textContent=e.message;button.disabled=false;}}finally{pending=false;}
    }
    if(button.hasAttribute('data-replay')){answers.fill(null);feedbacks.fill(null);index=0;render();$('.quiz-game-question').focus();}
  });
  listen('input',event=>{if(event.target.matches('[data-player-reflection]'))onDirty(true);if(event.target.matches('[data-music-volume]')){audio.volume(Number(event.target.value)/100);$('[data-music-volume-value]').textContent=event.target.value+'%';}});
  listen('change',event=>{if(event.target.matches('[data-pace]')){pace=Number(event.target.value);startTimer();}});
  render();
  return {destroy(){alive=false;events.abort();stopTimer();audio.destroy();}};
}

export function createFlashcards({root,quiz}){
  const cards=quiz.questions.filter(q=>Number.isInteger(q.correctIndex) && q.correctIndex>=0 && q.options[q.correctIndex]).map(q=>({front:q.prompt,back:q.options[q.correctIndex],explanation:q.explanation}));
  let deck=cards.map((_,i)=>i),index=0,flipped=false,again=new Set();
  const shuffle=()=>{for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}};
  function render(){
    if(!cards.length){root.innerHTML='<p>Add correct answers to create flashcards.</p>';return;}
    if(index>=deck.length){root.innerHTML=`<section class="flashcards"><h3>Practice complete</h3><p>${deck.length} cards reviewed · ${again.size} to practise again.</p><button type="button" class="teacher-button" data-again ${again.size?'':'disabled'}>Practise again</button> <button type="button" class="teacher-button secondary" data-all>All cards</button></section>`;return;}
    const card=cards[deck[index]];root.innerHTML=`<section class="flashcards"><div class="quiz-toolbar"><strong>Card ${index+1} of ${deck.length}</strong><button type="button" class="text-button" data-shuffle>Shuffle cards</button></div><button type="button" class="flashcard ${flipped?'is-flipped':''}" data-flip aria-label="${flipped?'Show question':'Reveal answer'}"><small>${flipped?'ANSWER':'QUESTION / TERM'}</small><span>${escape(flipped?card.back:card.front)}</span>${flipped && card.explanation?`<p>${escape(card.explanation)}</p>`:''}<small>${flipped?'Click to see the question':'Click or press Enter to flip'}</small></button><div class="flashcard-actions"><button type="button" class="teacher-button secondary" data-card-again ${flipped?'':'disabled'}>Practise again</button><button type="button" class="teacher-button" data-card-known ${flipped?'':'disabled'}>Got it ✓</button></div><p class="planner-hint">Practice only · this does not change your quiz score.</p></section>`;
  }
  root.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-flip'))flipped=!flipped;
    else if(b.hasAttribute('data-card-again') || b.hasAttribute('data-card-known')){b.hasAttribute('data-card-again')?again.add(deck[index]):again.delete(deck[index]);index++;flipped=false;}
    else if(b.hasAttribute('data-shuffle')){shuffle();index=0;flipped=false;}
    else if(b.hasAttribute('data-again')){deck=[...again];again.clear();index=0;flipped=false;}
    else if(b.hasAttribute('data-all')){deck=cards.map((_,i)=>i);again.clear();index=0;flipped=false;}
    else return;render();root.querySelector('[data-flip],h3')?.focus();
  });render();
}
