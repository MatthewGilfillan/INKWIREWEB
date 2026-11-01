export function validatePrintout(file) {
  if(!file||!file.size)throw Error('Choose a PDF file.');
  if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name||''))throw Error('Choose a PDF file to insert as a printout.');
  if(file.size>10*1024*1024)throw Error('Choose a PDF of up to 10 MB.');
}
export async function inspectPrintout(file,engine) {
  validatePrintout(file);
  const pdfjs=engine||await import('pdfjs-dist');
  if(pdfjs.GlobalWorkerOptions)pdfjs.GlobalWorkerOptions.workerSrc='/pdf/pdf.worker.min.mjs';
  let task;
  try {
    task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),password:'',isEvalSupported:false,cMapUrl:'/pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf/standard_fonts/',wasmUrl:'/pdf/wasm/'});
    const pdf=await task.promise;if(pdf.numPages<1||pdf.numPages>60)throw Error('Choose a PDF with between 1 and 60 pages.');
    const pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),v=page.getViewport({scale:1});if(!Number.isFinite(v.width)||!Number.isFinite(v.height)||v.width<50||v.height<50||v.width>2000||v.height>2000)throw Error('This PDF uses an unsupported page size. Export it using standard paper sizes.');pages.push({width:v.width,height:v.height});}
    return pages;
  } catch(e) {if(e.name==='PasswordException')throw Error('This PDF is password-protected. Choose an unlocked copy.');throw e;}
  finally {await task?.destroy();}
}
export async function uploadPrintout({file,pages,title,id,classId,displayMode='printout'}) {
  const response=await fetch('/api/worksheets?'+new URLSearchParams({classId,title}),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/pdf','X-PDF-Pages':JSON.stringify(pages),'X-Worksheet-Id':id,'X-PDF-Display':displayMode},body:file,signal:AbortSignal.timeout(90000)});
  const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.message||'The PDF could not be uploaded. Keep this dialog open and try again.');return result;
}
