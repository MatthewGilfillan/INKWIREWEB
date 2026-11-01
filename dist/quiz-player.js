import {escape} from './workspace-shared.js';

// Original, quiet synthesised audio; no third-party tracks or autoplay.
function createAudio(){
  let context=null,loop=null,beat=0,music=false,effects=true,closed=false;
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
  const notes=[261.63,329.63,392,329.63,293.66,349.23,440,349.23];
  return {
    effect(success=false){if(effects && ready()){tone(success?523.25:392);if(success){tone(659.25,.18,.04,.12);tone(783.99,.25,.04,.24);}}},
    effects(value){effects=value;if(value)this.effect();},
    music(value){music=value;if(loop)clearInterval(loop);loop=null;if(value && ready()){tone(notes[beat++%notes.length],.45,.025);loop=setInterval(()=>{if(music)tone(notes[beat++%notes.length],.45,.025);},480);return true;}music=false;return !value;},
    destroy(){closed=true;if(loop)clearInterval(loop);context?.close().catch(()=>{});context=null;},
  };
}

export function createQuizPlayer({root,quiz,preview=false,onSubmit,onDirty=()=>{}}){
  let index=0,answers=Array(quiz.questions.length).fill(null),reflection='',submitted=false,alive=true,timer=null,pace=0,remaining=0,deadline=0,music=false,effects=true,motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const audio=createAudio(),$=s=>root.querySelector(s),events=new AbortController();
  const listen=(type,fn)=>root.addEventListener(type,fn,{signal:events.signal});
  root.innerHTML=`<section class="quiz-game" data-theme="inkwire"><div class="quiz-game-top"><span class="quiz-game-brand">INK WIRE <small>${preview?'TEACHER PREVIEW':'READ • THINK • DISCOVER'}</small></span><div class="quiz-game-settings"><button type="button" data-music aria-pressed="false">Music off</button><button type="button" data-sounds aria-pressed="true">Sound on</button><button type="button" data-motion aria-pressed="${motion}">Motion ${motion?'on':'off'}</button></div></div><div data-game-stage></div></section>`;
  const game=$('.quiz-game');game.classList.toggle('reduce-motion',!motion);
  function stopTimer(){clearInterval(timer);timer=null;}
  function startTimer(){stopTimer();remaining=pace;deadline=Date.now()+pace*1000;const tick=()=>{if(!$('[data-pace-left]'))return;remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));$('[data-pace-left]').textContent=pace?(remaining?remaining+'s':'Take your time'):'No time limit';if(!remaining)stopTimer();};tick();if(pace)timer=setInterval(tick,250);}
  function render(){
    const q=quiz.questions[index],complete=answers.filter(a=>a!==null).length;
    $('[data-game-stage]').innerHTML=`<div class="quiz-game-progress"><span>Question ${index+1} of ${quiz.questions.length}</span><progress value="${complete}" max="${quiz.questions.length}" aria-label="Questions answered"></progress><span data-pace-left>No time limit</span></div><h3 class="quiz-game-question" tabindex="-1">${escape(q.prompt)}</h3><div class="quiz-game-answers" role="group" aria-label="Answer choices">${q.options.map((option,n)=>`<button type="button" class="quiz-answer answer-${n}" data-answer="${n}" aria-pressed="${answers[index]===n}"><span class="quiz-answer-letter">${'ABCD'[n]}</span><span>${escape(option)}</span><span class="quiz-answer-check" aria-hidden="true">${answers[index]===n?'✓':''}</span></button>`).join('')}</div><div class="quiz-game-footer"><button type="button" data-previous ${index?'':'disabled'}>Previous</button><label class="quiz-pace">Practice pace<select data-pace><option value="0">Untimed</option>${[30,60,90].map(n=>`<option value="${n}" ${pace===n?'selected':''}>${n} seconds</option>`).join('')}</select></label><button type="button" class="game-next" data-next ${answers[index]===null?'disabled':''}>${index===quiz.questions.length-1?'Review answers':'Next question'} →</button></div><p class="quiz-game-caption">${preview?'Preview only · no student score is recorded.':'Your score is saved after you submit.'} The pace timer never removes answers or reduces your score.</p>`;
    startTimer();
  }
  function review(){
    stopTimer();$('[data-game-stage]').innerHTML=`<div class="quiz-game-finish"><span class="quiz-game-spark" aria-hidden="true">✦</span><h3 tabindex="-1">Ready to finish?</h3><p>You’ve answered all ${quiz.questions.length} questions.</p><ol class="quiz-game-review">${quiz.questions.map((q,i)=>`<li><button type="button" data-review-question="${i}"><strong>${i+1}. ${escape(q.prompt)}</strong><span>${escape(q.options[answers[i]])}</span></button></li>`).join('')}</ol>${quiz.reflectionPrompt?`<label>${escape(quiz.reflectionPrompt)} <small>Optional; not scored</small><textarea data-player-reflection maxlength="2000" rows="3">${escape(reflection)}</textarea></label>`:''}<p data-game-error role="alert"></p><button type="button" class="game-next" data-submit-player>${preview?'Finish preview':'Submit quiz'}</button></div>`;
    $('[data-game-stage] h3').focus();
  }
  listen('click',async event=>{
    const button=event.target.closest('button');if(!button || submitted || !alive)return;
    if(button.hasAttribute('data-music')){music=!music;if(!audio.music(music))music=false;button.textContent='Music '+(music?'on':'off');button.setAttribute('aria-pressed',music);}
    if(button.hasAttribute('data-sounds')){effects=!effects;audio.effects(effects);button.textContent='Sound '+(effects?'on':'off');button.setAttribute('aria-pressed',effects);}
    if(button.hasAttribute('data-motion')){motion=!motion;game.classList.toggle('reduce-motion',!motion);button.textContent='Motion '+(motion?'on':'off');button.setAttribute('aria-pressed',motion);}
    if(button.hasAttribute('data-answer')){answers[index]=Number(button.dataset.answer);audio.effect();onDirty();root.querySelectorAll('[data-answer]').forEach(el=>{const selected=Number(el.dataset.answer)===answers[index];el.setAttribute('aria-pressed',selected);el.querySelector('.quiz-answer-check').textContent=selected?'✓':'';});$('[data-next]').disabled=false;}
    if(button.hasAttribute('data-next') && answers[index]!==null){audio.effect();if(index===quiz.questions.length-1)review();else{index++;render();$('.quiz-game-question').focus();}}
    if(button.hasAttribute('data-previous') && index){index--;render();$('.quiz-game-question').focus();}
    if(button.hasAttribute('data-review-question')){reflection=$('[data-player-reflection]')?.value || '';index=Number(button.dataset.reviewQuestion);render();$('.quiz-game-question').focus();}
    if(button.hasAttribute('data-submit-player')){
      if(answers.some(a=>a===null))return;reflection=$('[data-player-reflection]')?.value || '';
      if(preview){audio.effect(true);const score=quiz.questions.reduce((total,q,i)=>total+Number(q.correctIndex===answers[i]),0);$('[data-game-stage]').innerHTML=`<div class="quiz-game-finish quiz-celebrate"><span class="quiz-game-spark" aria-hidden="true">✦</span><h3>Preview complete</h3><p class="quiz-game-score">${score} / ${quiz.questions.length}</p><p>No score was recorded. Return to the editor to change or assign your quiz.</p><button type="button" data-replay class="game-next">Play again</button></div>`;stopTimer();}
      else{submitted=true;button.disabled=true;button.textContent='Saving your score…';try{await onSubmit({answers:[...answers],reflection});}catch(e){if(alive){$('[data-game-error]').textContent=e.message;button.disabled=false;button.textContent='Submit quiz';}}finally{submitted=false;}}
    }
    if(button.hasAttribute('data-replay')){answers.fill(null);index=0;render();}
  });
  listen('input',event=>{if(event.target.matches('[data-player-reflection]'))onDirty();});
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
