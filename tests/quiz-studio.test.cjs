const {test}=require('node:test');const assert=require('node:assert/strict');
const {fixture,users,definition,cid}=require('./helpers/quiz-fixture.cjs');
const formQuestion=(title='Choose a term',type='RADIO',key='Imagery')=>({title,questionItem:{question:{choiceQuestion:{type,options:[{value:'Imagery'},{value:'Irony'}]},grading:{pointValue:1,correctAnswers:{answers:[{value:key}]},whenRight:{text:'Sensory language.'}}}}});
test('Forms import keeps wording and keys, flags unsupported content and never invents an answer',async()=>{
 const {convertGoogleForm,parseGoogleFormLink}=await import('../dist/google-forms-model.mjs');
 assert.equal(parseGoogleFormLink('https://docs.google.com/forms/d/abc_123/edit?usp=sharing'),'abc_123');
 for(const link of ['https://forms.gle/abc','https://docs.google.com/forms/d/e/abc/viewform','https://evil.invalid/forms/d/abc/edit','http://docs.google.com/forms/d/abc/edit','https://docs.google.com@evil.invalid/forms/d/abc/edit'])assert.throws(()=>parseGoogleFormLink(link));
 const missing=formQuestion('Missing key');delete missing.questionItem.question.grading.correctAnswers;
 const image=formQuestion('Diagram');image.questionItem.image={contentUri:'https://example.invalid/image.png'};
 const branch=formQuestion('Branching');branch.questionItem.question.choiceQuestion.options[0].goToSectionId='2';
 const weighted=formQuestion('Two points','DROP_DOWN','Irony');weighted.questionItem.question.grading.pointValue=2;
 const form={info:{title:'<script>literal</script>',description:'Use the poem.'},items:[{pageBreakItem:{},title:'Section one'},formQuestion(),missing,formQuestion('Checkbox','CHECKBOX'),image,branch,weighted]};
 const result=convertGoogleForm(form);assert.equal(result.rows.length,6);assert.equal(result.rows.filter(r=>r.question).length,3);assert.equal(result.rows[0].question.correctIndex,0);assert.match(result.rows[0].question.prompt,/Use the poem.*Section one.*Choose a term/s);assert.equal(result.rows[1].question.correctIndex,-1);assert.match(result.rows[1].notes[0],/Choose a correct/);assert.equal(result.rows[5].question.correctIndex,1);assert.match(result.rows[5].notes[0],/2 points/);assert.equal(result.title,'<script>literal</script>');assert.ok(!JSON.stringify(result).includes('contentUri'));
 const many=convertGoogleForm({info:{title:'Many'},items:Array.from({length:25},()=>formQuestion())});assert.equal(many.rows.length,25,'conversion never silently drops questions after 20');
});
test('private teacher drafts persist without publishing, permit a missing key, and enforce revisions and attempt locks',async()=>{
 const f=await fixture();try{
  const incomplete=structuredClone(definition);incomplete.questions[0].correctIndex=-1;
  let body={action:'save-draft',courseRevision:1,revision:0,draftRevision:0,quiz:incomplete};
  assert.equal((await f.request(users.u,body)).status,404);assert.equal((await f.request(users.t,body,'legacy-1',{Origin:'https://evil.invalid'})).status,403);
  let response=await f.request(users.t,body);assert.equal(response.status,200);let result=await response.json();assert.equal(result.aiDraft.source,'Teacher draft');assert.equal(result.aiDraft.quiz.questions[0].correctIndex,-1);assert.equal(result.quiz,null);
  assert.equal((await(await f.request(users.sa)).json()).aiDraft,undefined);assert.equal((await(await f.request(users.sa)).json()).quiz,null);assert.equal(f.db.prepare('SELECT count(*) n FROM lesson_quizzes').get().n,0);
  assert.equal((await f.request(users.t,body)).status,409,'stale draft cannot overwrite');
  assert.equal((await f.request(users.t,{action:'save',revision:0,draftRevision:1,quiz:incomplete})).status,400,'missing keys cannot be assigned');
  body={...body,draftRevision:1,quiz:definition};assert.equal((await f.request(users.t,body)).status,200);
  assert.equal((await f.request(users.t,{action:'save',revision:0,draftRevision:1,quiz:definition})).status,409);
  assert.equal((await f.request(users.t,{action:'save',revision:0,draftRevision:2,quiz:definition})).status,200);assert.equal(f.db.prepare('SELECT count(*) n FROM quiz_drafts').get().n,0);
  await f.request(users.sa,{action:'start',revision:1,attemptId:crypto.randomUUID()});assert.equal((await f.request(users.t,{...body,revision:1,draftRevision:0})).status,409);
  const long={...definition,questions:Array.from({length:20},()=>definition.questions[0])};assert.equal((await f.request(users.t,{action:'save-draft',revision:0,courseRevision:1,draftRevision:0,quiz:long},'legacy-2')).status,200);
  f.db.prepare('UPDATE course_overviews SET revision=2 WHERE class_id=?').run(cid);assert.equal((await f.request(users.t,{...body,revision:0,draftRevision:1},'legacy-2')).status,409);
 }finally{f.db.close();}
});
