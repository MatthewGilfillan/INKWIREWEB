import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const html=await readFile('dist/worksheets.html','utf8');const header=html.match(/<header[\s\S]*?<\/header>/)[0];const main=html.match(/<main>([\s\S]*?)<\/main>/)[1];const dialog=html.match(/<dialog[\s\S]*?<\/dialog>/)[0];
await build({define:{__WORKSHEET_MARKUP__:JSON.stringify(header+main+dialog)},entryPoints:['src/notebooks.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/notebooks.js',legalComments:'linked'});
