import {build} from 'esbuild';
import {cp,mkdir,copyFile} from 'node:fs/promises';
await build({entryPoints:['src/worksheets.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/worksheets.js',legalComments:'linked'});
await mkdir('dist/pdf',{recursive:true});
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','dist/pdf/pdf.worker.min.mjs');
for(const folder of ['cmaps','standard_fonts','wasm'])await cp('node_modules/pdfjs-dist/'+folder,'dist/pdf/'+folder,{recursive:true});
await copyFile('node_modules/pdfjs-dist/LICENSE','dist/pdf/LICENSE');
