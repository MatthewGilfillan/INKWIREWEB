import {api,escape} from './workspace-shared.js';
import {loadGoogle} from './drive-course-import.js';
import {parseGoogleFormLink,convertGoogleForm} from './google-forms-model.mjs';
export function createGoogleFormsImport({root,onImport,onBusy=()=>{}}){
  root.innerHTML=`<h3>Import a Google Forms quiz</h3><p>Bring your existing questions and answer keys into Ink Wire. Review the import, select up to 20 questions, then save a private draft or assign it to this lesson.</p><label>Google Form editor link<input type="url" data-forms-link placeholder="https://docs.google.com/forms/d/…/edit"></label><p data-forms-setup role="status">Checking Google connection…</p><button type="button" class="teacher-button secondary" data-forms-connect disabled>Connect Google &amp; read form</button><p class="planner-hint">Read-only access to your form content. No student responses are requested. Your original form stays unchanged. Google access is used only for this import and is not saved.</p><p data-forms-status role="status"></p><div data-forms-review></div>`;
  const $=s=>root.querySelector(s);let config='',active=true,busy=false,converted=null,controller=null,cancelAuth=null;
  api('/api/drive-config').then(value=>{if(!active)return;config=value.clientId;$('[data-forms-setup]').textContent=config?'Use the Google account that owns or can edit this form.':'Google connection needs administrator setup. For now, print your form as a PDF and use Upload resources, or paste its questions into the AI brief. Check the answer key after generation.';$('[data-forms-connect]').disabled=!config;}).catch(()=>{if(active)$('[data-forms-setup]').textContent='Could not check the Google connection. Reopen the importer to try again.';});
  function review(){
    let selected=0;$('[data-forms-review]').innerHTML=`<h4>${escape(converted.title)}</h4><p>${converted.rows.filter(r=>r.question).length} importable of ${converted.rows.length} question items. Unsupported items are listed below.</p>${converted.notes.map(n=>`<p class="quiz-notice">${escape(n)}</p>`).join('')}<div class="forms-question-list">${converted.rows.map((r,i)=>`<label class="forms-question"><input type="checkbox" data-forms-question="${i}" ${r.question?(selected++<20?'checked':''):'disabled'}><span><strong>${escape(r.label)}</strong>${r.notes.map(n=>`<small>${escape(n)}</small>`).join('')}</span></label>`).join('')}</div><p>Imported questions use one point each. Missing answer keys must be completed before assignment.</p><button type="button" class="teacher-button" data-forms-use>Use selected questions</button>`;
  }
  async function connect(){
    if(busy || !config)return;let id;try{id=parseGoogleFormLink($('[data-forms-link]').value.trim());}catch(e){$('[data-forms-status]').textContent=e.message;return;}
    busy=true;onBusy(true);$('[data-forms-connect]').disabled=true;let token='';
    try{
      await loadGoogle();if(!active)return;
      const auth=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Google sign-in timed out. Try connecting again.')),60000);
        const finish=(error,result)=>{clearTimeout(timer);cancelAuth=null;error?reject(error):resolve(result);};cancelAuth=()=>finish(Error('Import closed.'));
        window.google.accounts.oauth2.initTokenClient({client_id:config,scope:'https://www.googleapis.com/auth/forms.body.readonly',include_granted_scopes:false,callback:r=>r.error?finish(Error('Google access was not granted.')):finish(null,r),error_callback:()=>finish(Error('Google sign-in was closed or blocked. Try again.'))}).requestAccessToken({prompt:'select_account'});
      });
      token=auth.access_token;if(!active)return;if(!token)throw Error('Google did not provide access. Try again.');
      if(!window.google.accounts.oauth2.hasGrantedAllScopes(auth,'https://www.googleapis.com/auth/forms.body.readonly'))throw Error('Allow read-only form access to import the questions.');
      $('[data-forms-status]').textContent='Reading questions and answer keys…';controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),30000);
      try{
        const response=await fetch('https://forms.googleapis.com/v1/forms/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token},credentials:'omit',signal:controller.signal});
        if(!response.ok){await response.body?.cancel();throw Error(response.status===401?'Google access expired. Connect again.':response.status===403?'Google could not read this form. Check that this account has access and that Google Forms API is enabled.':'Form not found. Copy its editor link and try again.');}
        const reader=response.body.getReader(),chunks=[];let size=0;
        try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024){await reader.cancel();throw Error('This form is too large. Import a smaller copy.');}chunks.push(value);}}finally{reader.releaseLock();}
        const form=JSON.parse(await new Blob(chunks).text());if(!active)return;converted=convertGoogleForm(form);review();$('[data-forms-status]').textContent='Ready to review. Nothing has been assigned.';
      }finally{clearTimeout(timeout);controller=null;}
    }catch(e){if(active)$('[data-forms-status]').textContent=e.name==='AbortError'?'Google took too long. Try again.':e.message;}
    finally{token='';if(active){busy=false;onBusy(false);$('[data-forms-connect]').disabled=!config;}}
  }
  root.addEventListener('click',e=>{
    if(e.target.closest('[data-forms-connect]'))connect();
    if(e.target.closest('[data-forms-use]') && !busy){const selected=[...root.querySelectorAll('[data-forms-question]:checked')].map(el=>converted.rows[Number(el.dataset.formsQuestion)]?.question).filter(Boolean);if(!selected.length || selected.length>20){$('[data-forms-status]').textContent='Select 1–20 questions.';return;}onImport({title:converted.title,reflectionPrompt:'',questions:selected});}
  });
  return {destroy(){active=false;controller?.abort();cancelAuth?.();converted=null;}};
}
