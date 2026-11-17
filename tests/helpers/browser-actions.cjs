async function openPlanner(page){
 await page.waitForFunction(()=>{const form=document.querySelector('#course-form'),edit=document.querySelector('[data-edit-unit-plan]');return form?.getClientRects().length||edit?.getClientRects().length;});
 const form=page.locator('#course-form');
 if(!await form.isVisible())await page.locator('[data-edit-unit-plan]').click();
 await form.waitFor({state:'visible'});
 const advanced=form.locator('.planner-intro');if(await advanced.count()&&!await advanced.evaluate(el=>el.open))await advanced.locator(':scope > summary').click();
}
async function courseSeed(){const {defaults,generateLessons}=await import('../../dist/course-model.mjs');const course={...defaults('Literature & essays'),assessment:{version:1,deferred:true,frameworks:[],judgmentScale:'framework',notes:''}};course.lessons=generateLessons(course);return course;}
async function setWheel(backing,value){const picker=backing.locator('..'),parts=value.split(':');for(let i=0;i<parts.length;i++){await picker.locator('.schedule-segment > button').nth(i).click();await backing.page().locator('[popover]:popover-open [role=option]').filter({hasText:new RegExp('^'+Number(parts[i]).toString().padStart(parts.length===2?2:1,'0')+'$')}).click();}}
module.exports={openPlanner,courseSeed,setWheel};
