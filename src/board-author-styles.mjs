export const authorColors=[{id:'mint',label:'Mint'},{id:'periwinkle',label:'Periwinkle'},{id:'peach',label:'Peach'},{id:'sky',label:'Sky blue'},{id:'rose',label:'Rose'},{id:'lemon',label:'Lemon'},{id:'lilac',label:'Lilac'},{id:'sage',label:'Sage'}];
export const authorNotes=[{id:'card',label:'Plain card'},{id:'sticky',label:'Sticky note'},{id:'lined',label:'Lined paper'}];
export function authorAppearance(board,authorId){
 const identity=typeof authorId==='string'&&authorId?authorId:'unassigned-author';
 let hash=2166136261;for(const char of identity)hash=Math.imul(hash^char.codePointAt(0),16777619)>>>0;
 const saved=typeof authorId==='string'&&authorId?board.authorStyles?.find(style=>style.authorId===authorId):null,colorChoice=saved?.color||'auto',noteChoice=saved?.note||'auto';
 return {color:colorChoice==='auto'?authorColors[hash%authorColors.length].id:colorChoice,note:noteChoice==='auto'?authorNotes[Math.floor(hash/authorColors.length)%authorNotes.length].id:noteChoice,colorChoice,noteChoice,version:saved?.version||0};
}
