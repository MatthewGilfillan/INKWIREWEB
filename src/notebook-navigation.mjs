/* The chooser and section/page browser share one footprint. No page is remounted. */
export function mountNotebookNavigation({grid,onToggle,onSearch,onRecent}){
 const root=document.getElementById('notebook-navigation'),chooser=document.getElementById('notebook-chooser'),title=document.getElementById('notebook-chooser-title'),rail=document.getElementById('notebook-rail-toggle');
 let currentBook=null,bookLabel='Notebooks',open=false,recent=false,width=390,sections=180;
 try{const saved=JSON.parse(localStorage.getItem('inkwire-notebook-widths')||'null');if(Number.isFinite(saved?.width))width=Math.max(280,Math.min(620,saved.width));if(Number.isFinite(saved?.sections))sections=Math.max(120,Math.min(400,saved.sections));}catch{}
 function update(){root.dataset.notebooksOpen=String(open);root.dataset.recentOpen=String(recent);chooser.setAttribute('aria-expanded',String(open||recent));title.textContent=recent?'Recent pages':open?'Notebooks':bookLabel;chooser.title=open||recent?'Return to this notebook’s sections and pages':'Choose another notebook';root.style.setProperty('--notebook-nav-width',width+'px');grid.style.setProperty('--notebook-nav-width',width+'px');root.style.setProperty('--notebook-section-width',sections+'px');}
 function store(){try{localStorage.setItem('inkwire-notebook-widths',JSON.stringify({width,sections}));}catch{}}
 chooser.onclick=()=>{if(recent){recent=false;open=false;}else open=!open;update();};rail.onclick=onToggle;
 document.getElementById('notebook-rail-search').onclick=onSearch;document.getElementById('notebook-rail-recent').onclick=onRecent;
 for(const handle of document.querySelectorAll('[data-notebook-resize]')){
  const whole=handle.dataset.notebookResize==='navigation',initial=whole?390:180;
  function value(){return whole?root.getBoundingClientRect().width:root.querySelector('.section-column').getBoundingClientRect().width;}
  function set(next){if(whole)width=Math.max(280,Math.min(620,grid.clientWidth-48-6-320,next));else sections=Math.max(120,Math.min(width-126,next));handle.setAttribute('aria-valuenow',String(Math.round(whole?width:sections)));update();}
  handle.setAttribute('aria-valuenow',String(whole?width:sections));
  handle.onpointerdown=event=>{if(event.button!==0||innerWidth<=850)return;event.preventDefault();handle.focus();const start=event.clientX,before=value();handle.setPointerCapture(event.pointerId);handle.dataset.dragging='true';handle.onpointermove=e=>set(before+e.clientX-start);const end=()=>{handle.onpointermove=null;delete handle.dataset.dragging;store();};handle.onpointerup=end;handle.onpointercancel=end;};
  handle.ondblclick=()=>{set(initial);store();};
  handle.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();set(event.key==='Home'?initial:event.key==='End'?(whole?620:width-126):value()+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?40:10));store();};
 }
 update();return {
  setBook(book){const id=book?.id||null;if(id!==currentBook){currentBook=id;open=!book;recent=false;}bookLabel=book?(book.teacherBook?'Teacher notebook':book.learnerName)+' · '+book.className:'Notebooks';update();},
  closeChooser(){open=false;recent=false;update();},
  showRecent(){open=false;recent=true;update();},
  setPane(pane){if(pane==='notebooks'){open=true;recent=false;}else if(pane==='sections'||pane==='pages'){open=false;recent=false;}update();},
  setExpanded(expanded){rail.setAttribute('aria-pressed',String(expanded));rail.setAttribute('aria-label',expanded?'Restore notebook view':'Expand page view');rail.title=expanded?'Restore notebook view':'Expand page view';}
 };
}

// A teacher's unscoped hub opens the chooser; deep links still open their target.
export function initialNotebook(notebooks,{role,notebookId,classId}){
 return notebooks.find(book=>book.id===notebookId)||((role!=='teacher'||classId)?notebooks[0]:null);
}
