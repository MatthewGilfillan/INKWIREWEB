import {officeJob,cleanOfficeJobs} from './office-jobs.mjs';
import {ZetaHelperMain} from './vendor/zetajs/zetaHelper.js';
const id=location.hash.slice(1),status=document.querySelector('#office-status'),button=document.querySelector('#office-close'),progress=document.querySelector('progress');
const retry=document.querySelector('#office-retry');
let finished=false,timer,job,helper;
retry.onclick=async()=>{retry.disabled=true;try{await update({state:'queued',error:null});location.reload();}catch{status.textContent='Insert the file again from your notebook.';}};
function returnToNotebook(){const url=new URL(job?.returnUrl||'/notebooks',location.origin);if(url.origin!==location.origin||url.pathname!=='/notebooks')throw Error('Invalid notebook destination.');location.replace(url.href);}
const update=async patch=>{if(!job)return;if(!await officeJob('get',id))throw Error('This printout was cancelled. Return to the notebook.');job={...job,...patch};await officeJob('put',id,job);};
const fail=async error=>{if(finished)return;finished=true;clearTimeout(timer);status.textContent=error.message||String(error);progress.hidden=true;button.textContent='Return to notebook';try{await update({state:'error',error:status.textContent});}catch{}retry.hidden=!job?.file;};
button.onclick=async()=>{if(!finished){finished=true;clearTimeout(timer);await update({state:'error',error:'Printout cancelled. You can attach the file or try again.',file:null});}returnToNotebook();};
try{
 if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Open this window from a notebook’s Insert as printout button.');
 await cleanOfficeJobs();for(let attempt=0;attempt<30;attempt++){job=await officeJob('get',id);if(job)break;await new Promise(resolve=>setTimeout(resolve,100));}if(!job?.file||Date.now()-job.updatedAt>300000)throw Error('This printout request expired. Return to the notebook and try again.');if(job.state!=='queued')throw Error('Conversion was interrupted. Try again or return to your notebook.');
 document.querySelector('#office-name').textContent=job.file.name;
 if(!crossOriginIsolated)throw Error('This browser cannot run the local conversion engine. Try a current desktop Chrome or Edge, or attach the file.');
 await update({state:'loading'});timer=setTimeout(()=>fail(Error('Conversion took too long. Attach the file or try again.')),600000);
 helper=new ZetaHelperMain('/office-thread.mjs',{threadJsType:'module',wasmPkg:'free',blockPageScroll:false});
 helper.Module.uno_scripts[1]=new URL('/office-wrap.js',location.href).href;
 helper.Module.onAbort=()=>fail(Error('The conversion engine could not start. Attach the file or try again.'));
 window.addEventListener('error',event=>{if(!finished)fail(Error(event.message?.includes('memory')?'There is not enough browser memory for this printout. Attach the file instead.':'The conversion engine could not start. Attach the file or try again.'));},true);
 window.addEventListener('unhandledrejection',()=>{if(!finished)fail(Error('The conversion engine could not start. Attach the file or try again.'));});
 helper.start(()=>{helper.thrPort.onmessage=async event=>{try{
  if(finished)return;
  if(event.data.cmd==='start'){
   const account=await fetch('/api/account',{credentials:'same-origin',cache:'no-store'});if(!account.ok)throw Error('Sign in again before inserting a printout.');
   const ext=job.file.name.split('.').pop().toLowerCase();if(!['doc','docx','ppt','pptx'].includes(ext))throw Error('Choose a Word or PowerPoint file.');
   status.textContent='Converting '+job.file.name+'…';await update({state:'converting'});
   helper.FS.writeFile('/tmp/notebook-input.'+ext,new Uint8Array(await job.file.arrayBuffer()));helper.thrPort.postMessage({cmd:'convert',ext,from:'/tmp/notebook-input.'+ext,to:'/tmp/notebook-output.pdf'});
  }else if(event.data.cmd==='converted'){
   const bytes=helper.FS.readFile(event.data.to);if(bytes.length>10*1024*1024)throw Error('The printout exceeds 10 MB. Attach the original instead.');
   const pdf=new Blob([bytes],{type:'application/pdf'});await update({state:'complete',pdf,file:null});finished=true;clearTimeout(timer);status.textContent='Printout ready. Return to your notebook to see it on the page.';progress.hidden=true;button.textContent='Return to notebook';
   try{helper.FS.unlink(event.data.from);helper.FS.unlink(event.data.to);}catch{}
   returnToNotebook();
  }else if(event.data.cmd==='failed')throw Error(event.data.message);
 }catch(e){await fail(e);}};});
}catch(e){await fail(e);}
