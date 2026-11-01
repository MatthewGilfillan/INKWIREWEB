import {build} from 'esbuild';
await build({entryPoints:['src/notebooks.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/notebooks.js',legalComments:'linked'});
