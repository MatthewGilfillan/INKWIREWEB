// Both transient and saved ink use coordinates relative to the editable canvas.
export function canvasPoint(bounds,event){return [Math.round(Math.max(0,Math.min(10000,event.clientX-bounds.left))*10)/10,Math.round(Math.max(0,Math.min(200000,event.clientY-bounds.top))*10)/10];}
export const eraserSizes=[{name:'Small',size:12},{name:'Medium',size:24},{name:'Large',size:40}];
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points){
 const sorted=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),lower=[],upper=[];
 for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(const p of sorted.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
 return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function segmentHitsPolygon(a,b,polygon){
 let low=0,high=1;
 for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],start=cross(p,q,a),end=cross(p,q,b),delta=end-start;
  if(Math.abs(delta)<1e-9){if(start<0)return false;continue;}
  const t=-start/delta;if(delta>0)low=Math.max(low,t);else high=Math.min(high,t);if(low>high)return false;
 }
 return true;
}
export function strokeHitsEraser(stroke,from,to,size){
 const half=(size+stroke.size)/2,polygon=hull([from,to].flatMap(([x,y])=>[[x-half,y-half],[x+half,y-half],[x+half,y+half],[x-half,y+half]]));
 for(let i=1;i<stroke.points.length;i++)if(segmentHitsPolygon(stroke.points[i-1],stroke.points[i],polygon))return true;
 return false;
}
export const automaticInk=(color,highlight=false)=>!highlight&&['#243556','#18395d','#161b24','#000000'].includes(color.toLowerCase());
export const inkStrokeColor=(color,highlight=false)=>automaticInk(color,highlight)?`var(--notebook-auto-ink, ${color})`:color;
