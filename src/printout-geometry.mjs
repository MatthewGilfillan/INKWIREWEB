const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function resizePrintout(before,edge,dx,dy){
 const left=edge.includes('w'),top=edge.includes('n'),horizontal=/[ew]/.test(edge),vertical=/[ns]/.test(edge),right=before.x+before.width,bottom=before.y+before.height;
 let width=before.width,height=before.height;
 if(horizontal&&vertical){
  const ratio=before.originalWidth/before.originalHeight,baseHeight=width/ratio;
  const scale=1+((left?-dx:dx)*width+(top?-dy:dy)*baseHeight)/(width*width+baseHeight*baseHeight);
  const minWidth=Math.max(50,50*ratio),maxWidth=Math.min(2000,4000*ratio,left?right:2000,top?bottom*ratio:2000);
  width=clamp(width*scale,minWidth,Math.max(minWidth,maxWidth));height=width/ratio;
 }else{
  if(horizontal)width=clamp(width+(left?-dx:dx),50,Math.min(2000,left?right:2000));
  if(vertical)height=clamp(height+(top?-dy:dy),50,Math.min(4000,top?bottom:4000));
 }
 return {...before,x:left?Math.max(0,right-width):before.x,y:top?Math.max(0,bottom-height):before.y,width,height};
}
export function scalePrintoutDocument(pages,factor){
 const x=Math.min(...pages.map(p=>p.x)),y=Math.min(...pages.map(p=>p.y));
 const min=Math.max(...pages.map(p=>Math.max(50/p.width,50/p.height))),max=Math.min(...pages.map(p=>Math.min(2000/p.width,4000/p.height,(p.x===x?Infinity:(10000-x)/(p.x-x)),(p.y===y?Infinity:(200000-y)/(p.y-y)))));
 const scale=clamp(factor,min,max);
 return pages.map(p=>({...p,x:x+(p.x-x)*scale,y:y+(p.y-y)*scale,width:p.width*scale,height:p.height*scale}));
}
export function restorePrintoutDocument(pages){
 const x=Math.min(...pages.map(p=>p.x));let y=Math.min(...pages.map(p=>p.y));
 return pages.map(p=>{const restored={...p,x,y,width:p.originalWidth,height:p.originalHeight};y+=p.originalHeight+24;return restored;});
}
