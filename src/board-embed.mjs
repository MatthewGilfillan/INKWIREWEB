import {mountClassBoard} from './class-board.mjs';
const root=document.querySelector('#embedded-live-board'),status=document.querySelector('#embedded-status'),params=new URLSearchParams(location.search),classId=params.get('classId'),boardId=params.get('boardId');
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;let mounted;
const standalone=window.parent===window;if(standalone)document.body.classList.add('is-standalone-board');
async function open(){try{if(!ID.test(classId||'')||!ID.test(boardId||''))throw Error('This Live Board link is incomplete.');const response=await fetch('/api/class-boards/classes/'+classId,{credentials:'same-origin',cache:'no-store'}),value=await response.json();if(!response.ok)throw Error(value.message||'This activity is not available to this account.');
mounted=await mountClassBoard({root,classId,boardId,followFinal:!params.get('snapshotId'),userId:value.userId,onStatus:(message,error)=>{status.textContent=error?message:'';}});
if(standalone){const back=document.createElement('a');back.className='board-back-link';back.textContent='← Back to notebooks';back.href='/notebooks?'+new URLSearchParams({classId});root.querySelector('.class-board-title-group').append(back);}
if(params.get('snapshotId'))await mounted.viewSnapshot(params.get('snapshotId'));status.textContent='';}catch(error){status.textContent=error.message;}}
window.addEventListener('beforeunload',event=>{if(mounted?.pending()&&!mounted.locallySaved()){event.preventDefault();event.returnValue='';}});window.addEventListener('pagehide',()=>mounted?.destroy());open();
