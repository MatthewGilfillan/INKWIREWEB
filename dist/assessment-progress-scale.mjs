import {schoolProgressScale} from './standards-registry.mjs';

// Provisional school bands requested by the owner. This is a display estimate
// from rounded practice accuracy, not a stored curriculum/teacher judgment.
const thresholds=[0,40,55,70,80,90];
export const estimatedProgressBands=schoolProgressScale.map((level,index)=>({
 ...level,min:thresholds[index],max:index===thresholds.length-1?100:thresholds[index+1]-1
}));
export function estimateProgressLevel(score){
 if(!Number.isFinite(score)||score<0||score>100)return null;
 const percentage=Math.round(score);
 const band=estimatedProgressBands.find(level=>percentage>=level.min&&percentage<=level.max);
 return {...band,percentage};
}
