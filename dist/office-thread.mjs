import {ZetaHelperThread} from './vendor/zetajs/zetaHelper.js';
const helper=new ZetaHelperThread(),css=helper.css,zetajs=helper.zetajs;
helper.thrPort.onmessage=event=>{
 if(event.data.cmd!=='convert')return;const {from,to,ext}=event.data;let model;
 try{
  // Never run document macros, update remote links, or permit an interaction dialog.
  const bean=(Name,Value)=>new css.beans.PropertyValue({Name,Value});
  model=helper.desktop.loadComponentFromURL('file://'+from,'_blank',0,[bean('Hidden',true),bean('ReadOnly',true),bean('MacroExecutionMode',0),bean('UpdateDocMode',0)]);
  if(!model)throw Error('This document could not be opened.');
  model.storeToURL('file://'+to,[bean('Overwrite',true),bean('FilterName',ext==='ppt'||ext==='pptx'?'impress_pdf_Export':'writer_pdf_Export')]);
  helper.thrPort.postMessage({cmd:'converted',from,to});
 }catch(e){let message='This document could not be converted. Attach the original file instead.';try{const exc=zetajs.catchUnoException(e);if(exc?.Message)console.warn(exc.Message);}catch{}helper.thrPort.postMessage({cmd:'failed',message});}
 finally{try{if(model?.queryInterface(zetajs.type.interface(css.util.XCloseable)))model.close(false);}catch{}}
};
helper.thrPort.postMessage({cmd:'start'});
