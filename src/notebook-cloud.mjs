export function syncPresentation({online=true,loading=false,busy=false,dirty=false,localFailure=false,error='',localOnly=false,readOnly=false}={}){
 if(localFailure)return {state:'error',message:'Device saving failed. Download your draft, then retry saving.'};
 if(!online)return {state:'pending',message:dirty?'Offline. Changes are waiting to sync.':'Offline. Reconnect to sync.'};
 if(error)return {state:'error',message:'Sync failed. '+error};
 if(loading)return {state:'pending',message:'Opening notebook…'};
 if(busy||dirty)return {state:'pending',message:'Saving and syncing…'};
 if(localOnly)return {state:'pending',message:'Saved on this device. Practice work is not saved to the cloud.'};
 return {state:'saved',message:readOnly?'Up to date. Read-only notebook.':'All changes saved.'};
}
export function mountCloudSync(button,{getState,onSync,observe=[]}){
 const announcement=button.querySelector('[role=status]');
 function render(){const data=getState(),view=syncPresentation(data);button.dataset.syncState=view.state;button.title='Save and sync · '+view.message;button.setAttribute('aria-label',button.title);button.disabled=!!data.disabled;if(announcement.textContent!==view.message)announcement.textContent=view.message;}
 const observer=new MutationObserver(render);for(const element of observe)observer.observe(element,{childList:true,characterData:true,subtree:true});
 const online=()=>render();window.addEventListener('online',online);window.addEventListener('offline',online);button.onclick=onSync;render();return {render,destroy(){observer.disconnect();window.removeEventListener('online',online);window.removeEventListener('offline',online);}};
}
