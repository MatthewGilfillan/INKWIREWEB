const {DatabaseSync}=require('node:sqlite');
const {readFileSync,readdirSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const origin='https://inkwire-education.com';
async function fixture(){
  const {handleNotebooks}=await import('../../cloudflare/notebooks.mjs');
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('cloudflare/migrations').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('cloudflare/migrations/'+f,'utf8'));
  const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}};
  const users=Object.fromEntries(['teacher','otherTeacher','invitedTeacher','student','otherStudent','parent','otherParent'].map(id=>{const role=id.toLowerCase().includes('teacher')?'teacher':id.toLowerCase().includes('student')?'student':'parent';db.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt,requestedRole) VALUES(?,?,?,1,0,0,?)').run(id,id,id+'@example.invalid',role);return [id,{id,emailVerified:true,requestedRole:role}];}));
  const classId=randomUUID(),otherClass=randomUUID(),learnerId=randomUUID().replace(/-/g,''),otherLearner=randomUUID();
  db.prepare('INSERT INTO classes(id,owner_id,name,subject,request_id,created_at) VALUES(?,?,?,?,?,0)').run(classId,'teacher','Literature','English',randomUUID());db.prepare('INSERT INTO classes(id,owner_id,name,subject,request_id,created_at) VALUES(?,?,?,?,?,0)').run(otherClass,'otherTeacher','Writing','English',randomUUID());
  db.prepare('INSERT INTO class_teachers VALUES(?,?,0)').run(classId,'invitedTeacher');
  for(const [id,user]of[[learnerId,'student'],[otherLearner,'otherStudent']]){db.prepare('INSERT INTO learners VALUES(?,?,?,0)').run(id,user,user);db.prepare('INSERT INTO class_students VALUES(?,?,0)').run(classId,id);}
  db.prepare('INSERT INTO learner_parents VALUES(?,?,?,0)').run(learnerId,'parent','Parent');
  const env={DB,APP_ORIGIN:origin};const base='/'+classId+'/'+learnerId;
  const call=(who,path='',body,headers={})=>handleNotebooks(new Request(origin+'/api/notebooks'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,users[who]);
  return {db,env,users,classId,otherClass,learnerId,otherLearner,base,call};
}
module.exports={fixture,origin};
