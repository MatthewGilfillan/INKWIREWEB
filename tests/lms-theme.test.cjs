const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../dist/lms-theme.js'),'utf8');
function fixture(saved=null,blocked=false){
 const nodes=[],windowEvents={},documentEvents={},writes=[];let stored=saved;
 function node(tag){const n={tag,dataset:{},attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},addEventListener(k,fn){this.listeners[k]=fn;},append(child){this.children.push(child);},before(){},querySelector(selector){return selector==='.today-account'?account:nodes.find(x=>Object.hasOwn(x.dataset,'lmsThemeToggle'))||null;}};nodes.push(n);return n;}
 const account=node('details'),header=node('header'),root=node('html');
 const document={documentElement:root,readyState:'loading',createElement:node,addEventListener(k,fn){documentEvents[k]=fn;},querySelectorAll(selector){return selector==='.workspace-header'?[header]:nodes.filter(n=>Object.hasOwn(n.dataset,'lmsThemeToggle'));}};
 const context=vm.createContext({document,window:{addEventListener(k,fn){windowEvents[k]=fn;}},localStorage:{getItem(){if(blocked)throw Error('Blocked');return stored;},setItem(key,value){if(blocked)throw Error('Blocked');stored=value;writes.push([key,value]);}}});
 vm.runInContext(source,context);return {root,nodes,writes,windowEvents,mount(){documentEvents.DOMContentLoaded();return nodes.find(n=>Object.hasOwn(n.dataset,'lmsThemeToggle'));}};
}
test('theme applies before mount, defaults to light without storing, and toggles accessibly',()=>{
 const f=fixture();assert.equal(f.root.dataset.lmsTheme,'light');assert.equal(f.writes.length,0);
 const button=f.mount();assert.equal(button.attributes.role,'switch');assert.equal(button.attributes['aria-label'],'Dark mode');assert.equal(button.attributes['aria-checked'],'false');
 button.listeners.click();assert.equal(f.root.dataset.lmsTheme,'dark');assert.equal(button.attributes['aria-checked'],'true');assert.deepEqual(f.writes,[['inkwire.appearance.v1','dark']]);
 button.listeners.click();assert.equal(f.root.dataset.lmsTheme,'light');assert.equal(button.attributes['aria-checked'],'false');
});
test('saved dark theme survives navigation and cross-tab updates without writing during initialization',()=>{
 const f=fixture('dark'),button=f.mount();assert.equal(f.root.dataset.lmsTheme,'dark');assert.equal(button.attributes['aria-checked'],'true');assert.equal(f.writes.length,0);
 f.windowEvents.storage({key:'unrelated',newValue:'light'});assert.equal(f.root.dataset.lmsTheme,'dark');
 f.windowEvents.storage({key:'inkwire.appearance.v1',newValue:'light'});assert.equal(f.root.dataset.lmsTheme,'light');
 f.windowEvents.pageshow();assert.equal(f.root.dataset.lmsTheme,'dark');
 f.windowEvents.storage({key:null,newValue:null});assert.equal(f.root.dataset.lmsTheme,'light');
});
test('blocked or invalid storage does not break a page-only appearance choice',()=>{
 assert.equal(fixture('unknown').root.dataset.lmsTheme,'light');
 const f=fixture(null,true),button=f.mount();button.listeners.click();assert.equal(f.root.dataset.lmsTheme,'dark');assert.equal(f.writes.length,0);
 f.windowEvents.pageshow();assert.equal(f.root.dataset.lmsTheme,'dark');
});
