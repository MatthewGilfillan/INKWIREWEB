import {build} from 'esbuild';
await build({entryPoints:['src/assignment-page.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/assignment-page.js',legalComments:'linked'});
