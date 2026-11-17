import {readingResponses,readingResponse,readingEvidence} from './reading-responses.mjs';
import {escape as e} from '../dist/workspace-shared.js';

const icon=(path)=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const imageIcon=icon('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/>');
const linkIcon=icon('<path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/>');
const responseIcons={question:'?',connection:'↔',revisit:'⌕',prediction:'↗',inference:'…',character:'♡',theme:'✧',craft:'✎',changed:'↻'};

export function mountReadingWallComposer(root){
 const form=root.querySelector('[data-board-composer]'),heading=form.querySelector('[data-composer-heading]');
 const fields=document.createElement('div');fields.className='reading-response-fields';fields.dataset.responseFields='';
 const title=form.elements.title,text=form.elements.text,evidence=form.elements.evidence,reference=form.elements.reference,reasoning=form.elements.reasoning;
 const subjectLabel=title.closest('label'),textLabel=text.closest('label'),evidenceLabel=evidence.closest('label'),reasonLabel=reasoning.closest('label');
 const link=form.elements.url,image=form.elements.image,linkLabel=link.closest('label'),imageLabel=image.closest('label');
 const preview=form.querySelector('[data-board-preview]'),removeImage=form.querySelector('[data-remove-image]'),actions=form.querySelector('[data-post-submit]').closest('.class-board-heading-actions');
 // Keep the existing named inputs and handlers, but show only the two core writing areas.
 for(const child of [...form.children])if(child!==heading)fields.append(child);
 form.append(fields);
 subjectLabel.className='reading-subject';subjectLabel.firstChild.textContent='';
 const subjectName=document.createElement('span');subjectName.className='reading-visually-hidden';subjectName.textContent='Subject (optional)';subjectLabel.prepend(subjectName);title.placeholder='Subject';
 textLabel.className='reading-main-response';textLabel.firstChild.textContent='';
 const responseName=document.createElement('span');responseName.className='reading-visually-hidden';responseName.textContent='Your response (optional)';textLabel.prepend(responseName);
 evidenceLabel.className='reading-evidence';evidenceLabel.firstChild.textContent='Evidence (optional)';evidence.rows=2;
 evidence.placeholder='Summarize a detail or add a quote. Include the page or chapter here if useful.';
 for(const field of [title,text,evidence,reasoning,link,image,reference])field.required=false;
 const sourceNote=document.createElement('div');sourceNote.className='reading-saved-source';sourceNote.hidden=true;
 const sourceText=document.createElement('span'),removeSource=document.createElement('button');removeSource.type='button';removeSource.textContent='×';removeSource.setAttribute('aria-label','Remove saved page or source');sourceNote.append(sourceText,removeSource);evidenceLabel.append(sourceNote);
 reference.closest('label').hidden=true;imageLabel.hidden=true;
 const chooser=document.createElement('section');chooser.dataset.responseChoices='';
 chooser.innerHTML=`<div class="reading-response-choices">${readingResponses.map(r=>`<button type="button" data-reading-response="${r.id}"><span class="reading-type-icon" aria-hidden="true">${responseIcons[r.id]}</span><strong>${e(r.label)}</strong><small>${e(r.hint)}</small></button>`).join('')}</div>`;
 form.prepend(chooser);
 const toolbar=document.createElement('div');toolbar.className='reading-compose-toolbar';
 toolbar.innerHTML=`<button type="button" data-response-back>← Change type</button><div class="reading-attachment-buttons"><button type="button" data-attach-reading-image aria-label="Attach image" title="Attach an image">${imageIcon}<span>Image</span></button><button type="button" data-reading-link aria-label="Add a link" aria-expanded="false" title="Add a link">${linkIcon}<span>Link</span></button></div>`;
 linkLabel.className='reading-link-panel';linkLabel.id='reading-post-link-'+crypto.randomUUID();linkLabel.firstChild.textContent='Link (optional)';linkLabel.hidden=true;toolbar.querySelector('[data-reading-link]').setAttribute('aria-controls',linkLabel.id);
 const extras=document.createElement('details');extras.className='reading-extras';extras.innerHTML='<summary>Extensions &amp; extras <small>Optional</small></summary>';extras.append(reasonLabel);
 // The hidden stage/reference inputs remain in the form for lossless editing of older posts.
 fields.prepend(subjectLabel,toolbar,textLabel,evidenceLabel,extras,linkLabel,preview,removeImage);
 fields.append(actions);actions.classList.add('reading-compose-actions');
 function update(){const r=readingResponse(form.elements.stage.value);text.placeholder=r.hint;reasonLabel.firstChild.textContent=r.reasoning+' (optional)';extras.querySelector('small').textContent=reasoning.value.trim()?'1 added · optional':'Optional';}
 function mergeSource(){
  const combined=readingEvidence(evidence.value,reference.value);
  if(reference.value.trim()&&combined.length<=evidence.maxLength){evidence.value=combined;reference.value='';}
  // Very long legacy evidence keeps its saved source as a removable note inside Evidence.
  sourceNote.hidden=!reference.value.trim();sourceText.textContent=reference.value.trim()?'Saved source: '+reference.value.trim():'';
 }
 function showChoices(){chooser.hidden=false;fields.hidden=true;heading.hidden=false;heading.textContent='Choose a reading response';chooser.querySelector('button').focus();}
 function showFields(){chooser.hidden=true;fields.hidden=false;heading.hidden=true;update();mergeSource();}
 function setLinkOpen(open){linkLabel.hidden=!open;toolbar.querySelector('[data-reading-link]').setAttribute('aria-expanded',String(open));}
 function click(event){
  const choice=event.target.closest('[data-reading-response]');
  if(choice){const previous=readingResponse(form.elements.stage.value).label;form.elements.stage.value=choice.dataset.readingResponse;if(!title.value.trim()||title.value===previous)title.value=readingResponse(choice.dataset.readingResponse).label;showFields();form.dispatchEvent(new Event('input',{bubbles:true}));text.focus();}
  if(event.target.closest('[data-response-back]'))showChoices();
  if(event.target.closest('[data-attach-reading-image]'))image.click();
  if(event.target.closest('[data-reading-link]')){setLinkOpen(linkLabel.hidden);if(!linkLabel.hidden)link.focus();}
 }
 function change(event){if(event.target.name==='stage')update();}
 function input(event){if(event.target===reasoning)update();}
 removeSource.onclick=()=>{reference.value='';sourceNote.hidden=true;form.dispatchEvent(new Event('input',{bubbles:true}));};
 form.addEventListener('click',click);form.addEventListener('change',change);form.addEventListener('input',input);
 return {open(choose,{hasTitle=false}={}){extras.open=false;setLinkOpen(!!link.value.trim());if(!choose&&!hasTitle)title.value=readingResponse(form.elements.stage.value).label;choose?showChoices():showFields();},update,destroy(){form.removeEventListener('click',click);form.removeEventListener('change',change);form.removeEventListener('input',input);}};
}
