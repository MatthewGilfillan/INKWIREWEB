const {test}=require('node:test'),assert=require('node:assert/strict');
test('teacher bell contains current-class quiz submissions and cancellations, with private read state',async()=>{
 const {classSetupFixture,users,cid,origin}=require('./helpers/class-setup-fixture.cjs'),f=await classSetupFixture();
 const {handleNotifications}=await import('../cloudflare/notifications.mjs');await f.assign();
 f.db.prepare(`INSERT INTO quiz_attempts(id,class_id,lesson_id,learner_id,learner_name,quiz_revision,started_at,submitted_at,score,total,answers) VALUES(?,?,?,?,?,1,1,2,1,2,'[0,1]')`).run('attempt',cid,'legacy-1','a','Alice');
 const course={...f.course,lessons:f.course.lessons.map((lesson,index)=>index===1?{...lesson,status:'cancelled'}:lesson)};f.db.prepare('UPDATE course_overviews SET content=?,updated_at=3 WHERE class_id=?').run(JSON.stringify(course),cid);
 const api=(user=users.t,body,headers={})=>handleNotifications(new Request(origin+'/api/notifications',{method:body?'POST':'GET',headers:{Origin:origin,...headers},...(body?{body:JSON.stringify(body)}:{})}),f.env,user,f.helpers);
 let {items}=await(await api()).json();assert.equal(items.length,2);assert.equal(items.filter(item=>!item.read).length,2);assert.match(items.find(item=>item.type==='submission').title,/Alice submitted/);assert.ok(items.some(item=>item.type==='cancellation'));
 assert.deepEqual((await(await api(users.u)).json()).items,[]);assert.deepEqual((await(await api(users.sa)).json()).items,[]);
 assert.equal((await api(users.t,{ids:items.map(item=>item.id)})).status,200);assert.ok((await(await api()).json()).items.every(item=>item.read));
 assert.equal((await api(users.t,{ids:['x'],userId:'u'})).status,400);assert.equal((await api(users.t,{ids:[]},{Origin:'https://foreign.invalid'})).status,403);assert.equal((await api(null)).status,401);
 f.db.prepare('DELETE FROM class_students WHERE class_id=? AND learner_id=?').run(cid,'a');assert.equal((await(await api()).json()).items.length,1);
 f.db.prepare('UPDATE classes SET deleted_at=4 WHERE id=?').run(cid);assert.deepEqual((await(await api()).json()).items,[]);f.db.close();
});
