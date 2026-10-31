import {build} from 'esbuild';
await build({entryPoints:['src/invitation-qr.js'],bundle:true,minify:true,format:'iife',target:'es2020',outfile:'dist/invitation-qr.js',legalComments:'linked'});
// MIT license is retained alongside the bundled QR encoder in dist/invitation-qr-license.txt.
