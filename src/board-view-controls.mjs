const svg=paths=>`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const expand=svg('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>');
const collapse=svg('<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/>');
const external=svg('<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M14 3h7v7m0-7L10 14"/>');

export function mountBoardViewControls({root,classId,boardId,getSnapshotId=()=>'',status}){
 const heading=root.querySelector('.class-board-heading'),titleGroup=heading.firstElementChild,actions=heading.querySelector('.class-board-heading-actions');
 root.dataset.boardAppearance='paper';
 titleGroup.classList.add('class-board-title-group');
 const fullscreen=document.createElement('button');fullscreen.type='button';fullscreen.dataset.boardFullscreen='';fullscreen.className='board-view-button';
 const newWindow=document.createElement('button');newWindow.type='button';newWindow.dataset.boardNewWindow='';newWindow.className='board-view-button';newWindow.innerHTML=external;newWindow.setAttribute('aria-label','View in new window');newWindow.title='View in new window';
 actions.append(fullscreen,newWindow);
 function fullscreenState(){const active=document.fullscreenElement===root;fullscreen.innerHTML=active?collapse:expand;fullscreen.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');fullscreen.title=active?'Exit fullscreen · Esc':'Enter fullscreen';fullscreen.setAttribute('aria-pressed',String(active));}
 fullscreen.onclick=async()=>{try{if(document.fullscreenElement===root)await document.exitFullscreen();else if(root.requestFullscreen&&document.fullscreenEnabled!==false)await root.requestFullscreen();else status('Fullscreen is unavailable in this browser. Use View in new window to open the board separately.',true);}catch{status('Fullscreen could not open here. Use View in new window to open the board separately.',true);}};
 newWindow.onclick=()=>{
  const url=new URL(location.pathname==='/board-embed.html'?'/board-embed.html':'/board-embed',location.origin);url.searchParams.set('classId',classId);url.searchParams.set('boardId',boardId);
  const snapshot=getSnapshotId();if(snapshot)url.searchParams.set('snapshotId',snapshot);
  const sourcePageId=new URLSearchParams(location.search).get('sourcePageId');if(sourcePageId)url.searchParams.set('sourcePageId',sourcePageId);
  // Preserve the fictional identity only when using the local review harness.
  const role=new URLSearchParams(location.search).get('reviewRole');if(['teacher','student','otherStudent'].includes(role)&&['localhost','127.0.0.1'].includes(location.hostname))url.searchParams.set('reviewRole',role);
  const popup=window.open('about:blank','_blank','popup=no,toolbar=yes,menubar=yes,location=yes,status=yes,width=1280,height=900,resizable=yes,scrollbars=yes');
  if(!popup){status('Your browser blocked the new window. Allow popups for this site and try again.',true);return;}
  popup.opener=null;popup.location.replace(url.href);
 };
 if(root.classList.contains('is-reading-wall')||root.classList.contains('is-mountain-wall')){
  titleGroup.append(root.querySelector('[data-board-state]'));
  const filters=document.createElement('div');filters.className='reading-header-filters';const stage=root.querySelector('[data-story-stage]');
  filters.append(stage.closest('label'),root.querySelector('[data-story-team]').closest('label'));heading.insertBefore(filters,actions);
  actions.prepend(root.querySelector('[data-board-count]'));root.querySelector('.class-board-meta').hidden=true;
  const launch=root.querySelector('[data-board-launch]');if(launch)titleGroup.append(launch);
 }
 function update(){const prompt=root.querySelector('[data-board-prompt]');if(root.classList.contains('is-reading-wall'))prompt.hidden=/^Choose a response type[.,]/i.test(prompt.textContent.trim())||!prompt.textContent.trim();}
 document.addEventListener('fullscreenchange',fullscreenState);fullscreenState();
 return {update,destroy(){document.removeEventListener('fullscreenchange',fullscreenState);if(document.fullscreenElement===root)document.exitFullscreen().catch(()=>{});}};
}
