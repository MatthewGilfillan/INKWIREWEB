const {test}=require('node:test');
const assert=require('node:assert/strict');

test('font, size and colour choices survive a toolbar refresh when their popover closes',async()=>{
 const {chooseTextValue}=await import('../src/text-tools.mjs');
 for(const [oldValue,choice]of [['Georgia','Courier New'],['16','24'],['#243556','#7030a0']]){
  const input=new EventTarget();input.value=oldValue;let applied;
  input.addEventListener('change',()=>{applied=input.value;});
  chooseTextValue(input,choice,()=>{input.value=oldValue;});
  assert.equal(applied,choice);assert.equal(input.value,choice);
 }
});
