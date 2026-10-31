import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir('public/pdf-assets', { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) await cp(join(root, folder), `public/pdf-assets/${folder}`, { recursive: true });
await cp(join(root, 'LICENSE'), 'public/pdf-assets/LICENSE');
await cp(join(dirname(require.resolve('pdf-lib/package.json')), 'LICENSE.md'), 'public/pdf-assets/PDF-LIB-LICENSE.md');
