import {templateById} from '../dist/live-board-templates.mjs';
export const boardLayouts=[
 {id:'wall',label:'Wall',description:'A flowing wall of response cards.'},
 {id:'columns',label:'Columns',description:'Group responses by activity section.'},
 {id:'grid',label:'Grid',description:'Cards in a tidy, even grid.'},
 {id:'rows',label:'Rows',description:'Read responses one after another.'},
 {id:'timeline',label:'Timeline',description:'Follow responses across a horizontal line.'},
];
export function layoutsFor(template){const definition=templateById(template);if(definition?.layout==='ranking')return [{id:'activity',label:'Student columns',description:'Each student orders their own set of items.'}];return [...(definition?[{id:'activity',label:definition.layout==='mountain'?'Story Mountain':'Graphic organizer',description:'Use the visual structure designed for this activity.'}]:[]),...boardLayouts.filter(row=>definition||row.id!=='columns')];}
export function cleanBoardLayout(value,template){const layout=value??(templateById(template)?'activity':'wall');if(!layoutsFor(template).some(row=>row.id===layout))throw Object.assign(Error('Choose a supported layout for this activity.'),{status:400});return layout;}
export function layoutCards(template,current){return layoutsFor(template).map(row=>`<button type="button" class="board-layout-choice" data-board-layout="${row.id}" aria-pressed="${row.id===current}"><span class="board-layout-preview preview-${row.id}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><strong>${row.label}</strong><small>${row.description}</small></button>`).join('');}
