// Draw one continuous outline around the selected score cell and its wider detail row.
export function connectedEvidencePath(width,height,left,right,top,r=14){
 const W=Math.max(1,width),H=Math.max(1,height),L=Math.max(r*2,left),R=Math.min(W-r*2,right),T=Math.min(-r*2,top);
 if(R-L<r*2)return `M ${r} 0 H ${W-r} Q ${W} 0 ${W} ${r} V ${H-r} Q ${W} ${H} ${W-r} ${H} H ${r} Q 0 ${H} 0 ${H-r} V ${r} Q 0 0 ${r} 0 Z`;
 return `M ${r} 0 H ${L-r} Q ${L} 0 ${L} ${-r} V ${T+r} Q ${L} ${T} ${L+r} ${T} H ${R-r} Q ${R} ${T} ${R} ${T+r} V ${-r} Q ${R} 0 ${R+r} 0 H ${W-r} Q ${W} 0 ${W} ${r} V ${H-r} Q ${W} ${H} ${W-r} ${H} H ${r} Q 0 ${H} 0 ${H-r} V ${r} Q 0 0 ${r} 0 Z`;
}
export function connectEvidencePanels(root){
 let stopped=false,frame;
 function draw(){if(stopped)return;for(const panel of root.querySelectorAll('[data-wide-evidence]')){const axis=panel.dataset.wideEvidence;if(!axis)continue;const row=panel.closest('tr')?.previousElementSibling,cell=Array.from(row?.querySelectorAll('[data-score-axis]')||[]).find(c=>c.dataset.scoreAxis===axis);if(!cell)continue;const box=panel.getBoundingClientRect(),neck=cell.getBoundingClientRect();if(box.width<1||box.height<1)continue;const svg=panel.querySelector('.evidence-outline');svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);svg.querySelector('path').setAttribute('d',connectedEvidencePath(box.width,box.height,neck.left-box.left+2,neck.right-box.left-2,neck.top-box.top+2));panel.dataset.connected='true';}}
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);},observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
 for(const element of root.querySelectorAll('.educade-class-table,[data-wide-evidence]'))observer?.observe(element);window.addEventListener('resize',schedule);schedule();
 return ()=>{stopped=true;cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',schedule);};
}
