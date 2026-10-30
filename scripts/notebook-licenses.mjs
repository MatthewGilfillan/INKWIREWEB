import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Preserve upstream notices alongside the distributed browser bundle.
const notices = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (/^(LICENSE|THIRD_PARTY_LICENSES)(\.md|\.txt)?$/i.test(entry.name)) {
      notices.push(`${file.replace(/^node_modules\//, '')}\n\n${await readFile(file, 'utf8')}`);
    }
  }
}
await visit('node_modules');
await writeFile('dist/notebook-licenses.txt', 'Ink Wire notebook — third-party license notices\n\n' + notices.sort().join('\n\n---\n\n'));
