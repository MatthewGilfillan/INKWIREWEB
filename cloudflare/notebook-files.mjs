import {notebookFileType} from '../src/notebook-file-node.mjs';
import {limitClassAction} from './classes.mjs';
export function validFileBytes(bytes,ext){
 const starts=(...v)=>v.every((n,i)=>bytes[i]===n);
 if(ext==='png')return starts(137,80,78,71,13,10,26,10);
 if(['jpg','jpeg'].includes(ext))return starts(255,216,255);
 if(ext==='gif')return /^GIF8[79]a/.test(new TextDecoder().decode(bytes.slice(0,6)));
 if(ext==='webp')return new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 if(['doc','ppt'].includes(ext))return starts(208,207,17,224,161,177,26,225);
 if(!starts(80,75,3,4))return false;
 // ZIP names remain uncompressed in the directory; reject mismatched Office packages.
 const text=new TextDecoder('latin1').decode(bytes);return text.includes('[Content_Types].xml')&&text.includes(ext==='docx'?'word/':'ppt/');
}
export async function handleNotebookFile(request,env,user,ctx,pageId,assetId){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},fail=(message,status=400)=>Response.json({message},{status,headers});
 if(ctx.pages.find(p=>p.id===pageId)?.kind!=='note')return fail('Open a notebook page to insert a file.',404);
 if(!env.WORKSHEETS)return fail('File storage is temporarily unavailable.',503);
 const key=`notebook-files/${ctx.classId}/${ctx.owner}/${pageId}/${assetId}`;
 if(request.method==='GET'){
  const object=await env.WORKSHEETS.get(key);if(!object)return fail('File not found.',404);
  const {fileName='Notebook file',mime='application/octet-stream'}=object.customMetadata||{};
  return new Response(object.body,{headers:{...headers,'Content-Type':mime,'Content-Disposition':`${mime.startsWith('image/')?'inline':'attachment'}; filename="notebook-file"; filename*=UTF-8''${encodeURIComponent(fileName)}`,'Content-Security-Policy':"sandbox; default-src 'none'"}});
 }
 if(request.method!=='POST')return fail('Not found.',404);
 if(user.requestedRole!=='teacher')return fail('Only teachers can insert files.',403);
 if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403);
 let fileName,type;try{fileName=decodeURIComponent(request.headers.get('X-File-Name')||'');if(!fileName.trim()||fileName.length>180||/[\x00-\x1f\x7f/\\]/.test(fileName))throw Error('Invalid file name.');type=notebookFileType({name:fileName,size:Number(request.headers.get('X-File-Size'))});}catch(e){return fail(e.message);}
 if(request.headers.get('Content-Type')!==type.mime)return fail('The file type does not match its name.');
 if(!await limitClassAction(env,user.id,'notebook-file',40))return fail('Please wait before inserting more files.',429);
 const existing=await env.WORKSHEETS.get(key);if(existing)return Response.json({id:assetId},{headers});
 const reader=request.body?.getReader();if(!reader)return fail('Choose a file.');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>25*1024*1024){await reader.cancel();return fail('Choose a file of up to 25 MB.',413);}chunks.push(value);}
 if(size!==Number(request.headers.get('X-File-Size')))return fail('The upload was incomplete. Try again.');
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 if(!validFileBytes(bytes,type.ext))return fail('The file contents do not match this file type.');
 await env.WORKSHEETS.put(key,bytes,{httpMetadata:{contentType:type.mime},customMetadata:{fileName,mime:type.mime,size:String(size)}});return Response.json({id:assetId},{status:201,headers});
}
