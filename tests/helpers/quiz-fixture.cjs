const {DatabaseSync}=require('node:sqlite');const {readFileSync,readdirSync}=require('node:fs');const path=require('node:path');
const origin='https://inkwire-education.com',cid='11111111-1111-4111-8111-111111111111';
const users=Object.fromEntries([['t','teacher'],['u','teacher'],['sa','student'],['sb','student'],['pa','parent']].map(([id,requestedRole])=>[id,{id,requestedRole,emailVerified:true}]));
const definition={title:'Chapter one reading check',reflectionPrompt:'What would you like to discuss?',questions:[{prompt:'Who tells the story?',options:['The narrator','The editor'],correctIndex:0,explanation:'Look at the opening voice.'},{prompt:'Which detail supports your answer?',options:['A quotation','A guess'],correctIndex:0,explanation:''}]};
async function fixture(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(path.join(__dirname,'../../cloudflare/migrations')).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(path.join(__dirname,'../../cloudflare/migrations',f),'utf8'));
 for(const u of Object.values(users))db.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt,requestedRole) VALUES(?,?,?,1,0,0,?)').run(u.id,u.id,u.id+'@example.invalid',u.requestedRole);
 db.prepare('INSERT INTO classes(id,owner_id,name,subject,request_id,created_at) VALUES(?,?,?,?,?,0)').run(cid,'t','Fictional literature','Reading','req');
 for(const [id,name,user]of[['a','Alice','sa'],['b','Bob','sb']]){db.prepare('INSERT INTO learners VALUES(?,?,?,0)').run(id,name,user);db.prepare('INSERT INTO class_students VALUES(?,?,0)').run(cid,id);}
 db.prepare('INSERT INTO learner_parents VALUES(?,?,?,0)').run('a','pa','Alice parent');
 const {defaults,generateLessons}=await import('../../dist/course-model.mjs'),course={...defaults('Reading'),weeks:2,startDate:'2027-01-01'};course.lessons=generateLessons(course);db.prepare('INSERT INTO course_overviews VALUES(?,1,?,?,0)').run(cid,JSON.stringify(course),'t');
 const DB={prepare(sql){const stmt=db.prepare(sql);let args=[];return {bind(...a){args=a;return this;},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};},async run(){return stmt.run(...args);}};}};
 const env={DB,APP_ORIGIN:origin},helpers={json:(v,s=200)=>Response.json(v,{status:s}),fail:(message,s=400,code)=>Response.json({message,code},{status:s}),readJSON:r=>r.json()};
 const {handleLessonQuiz}=await import('../../cloudflare/lesson-quizzes.mjs'),{handleLessonFeedback}=await import('../../cloudflare/lesson-feedback.mjs');
 const request=(user=users.t,body,lesson='legacy-1',headers={})=>handleLessonQuiz(new Request(`${origin}/api/lesson-quizzes/classes/${cid}/lessons/${lesson}`,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})}),env,user,helpers);
 const timeline=(user=users.t,suffix='timeline')=>handleLessonFeedback(new Request(`${origin}/api/lesson-feedback/classes/${cid}/${suffix}`),env,user,helpers);
 const assign=()=>request(users.t,{action:'save',revision:0,quiz:definition});
 return {db,env,helpers,course,request,timeline,assign};
}
module.exports={fixture,users,definition,cid,origin};
