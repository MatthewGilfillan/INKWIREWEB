import {workspaceChoice} from './unit-position.mjs';

// Layout is a device preference. It never changes a class or a student's work.
const key='inkwire.teacher.workspace.v1',buttons=[...document.querySelectorAll('[data-layout-choice]')];
let choice='essentials';try{choice=workspaceChoice(localStorage.getItem(key));}catch{}
function apply(value){
  choice=workspaceChoice(value);document.body.dataset.workspaceLayout=choice;
  buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layoutChoice===choice)));
}
apply(choice);
buttons.forEach(button=>button.addEventListener('click',()=>{apply(button.dataset.layoutChoice);try{localStorage.setItem(key,choice);}catch{}}));
window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue);});
