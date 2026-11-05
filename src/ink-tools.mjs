export const strokeSizes={pen:[.25,.35,.5,.7,1],highlight:[2,3,4,5,6]};
export const inkColors={pen:[['Black','#243556'],['Blue','#0070c0'],['Green','#008000'],['Red','#ff0000']],highlight:[['Yellow','#ffe45c'],['Pink','#ff6ec7'],['Cyan','#67e8f9'],['Lime','#a3e635']]};
export function mountInkPresets(element,{unitsPerInch=96,onColor,onWidth}){
 const doc=element.ownerDocument,colors=doc.createElement('div'),widths=doc.createElement('div');colors.className='ink-preset-colors';widths.className='ink-preset-widths';
 for(const [node,label]of [[colors,'Quick ink colours'],[widths,'Stroke sizes']]){node.setAttribute('role','group');node.setAttribute('aria-label',label);}element.append(colors,widths);
 function render(tool,memory){
  const sizes=strokeSizes[tool];if(!sizes)return;colors.replaceChildren();widths.replaceChildren();
  for(const [name,color]of inkColors[tool]){const button=doc.createElement('button');button.type='button';button.className='ink-preset-color';button.style.setProperty('--ink-swatch',color);button.setAttribute('aria-label',name+' ink');button.setAttribute('aria-pressed',String(memory.color.toLowerCase()===color.toLowerCase()));button.onmousedown=event=>event.preventDefault();button.onclick=()=>onColor(color);colors.append(button);}
  const values=sizes.map(mm=>Math.round(mm*unitsPerInch/25.4*100)/100),closest=values.reduce((best,value,index)=>Math.abs(value-memory.size)<Math.abs(values[best]-memory.size)?index:best,0);
  sizes.forEach((mm,index)=>{const button=doc.createElement('button');button.type='button';button.className='ink-preset-width';button.setAttribute('aria-label',mm+' millimetre '+(tool==='highlight'?'highlighter':'pen'));button.setAttribute('aria-pressed',String(index===closest));button.style.setProperty('--stroke-color',memory.color);
   const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),path=doc.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 88 48');svg.setAttribute('aria-hidden','true');path.setAttribute('d','M14 33C24 9 34 41 45 25S58 10 68 18');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width',Math.round(mm*96/25.4*100)/100);path.setAttribute('stroke-linecap','round');path.setAttribute('opacity',tool==='highlight'?'.6':'1');svg.append(path);
   const label=doc.createElement('span');label.textContent=mm+' mm';button.append(svg,label);button.onmousedown=event=>event.preventDefault();button.onclick=()=>onWidth(values[index]);widths.append(button);
  });
 }
 return {colors,widths,render};
}
