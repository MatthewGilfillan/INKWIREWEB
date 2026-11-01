import { mkdir, writeFile } from 'node:fs/promises';
import { renderAccountEmail, renderInvitationEmail } from '../cloudflare/account-emails.mjs';

const directory = new URL('../dist/email-previews/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const kind of ['activate', 'reset', 'student', 'parent']) {
  const origin = 'https://inkwire-education.com';
  const email = ['student','parent'].includes(kind)
    ? renderInvitationEmail({origin,kind:kind==='parent'?'family':'student',code:'ABCDEFGHJKLM',className:'Animal Farm · Literature & Writing',studentName:'Jamie',expiresAt:Date.UTC(2026,10,8,10)})
    : renderAccountEmail({ origin, kind, url: `${origin}/account.html#${kind}=EXAMPLE-LINK-PREVIEW-ONLY` });
  // These are visual samples. No real tokens or working account-action links.
  const preview = email.html.replace('</head>', '<meta name="robots" content="noindex,nofollow"><style>a{pointer-events:none}</style></head>')
    .replace(/<a href=/g, '<a aria-disabled="true" tabindex="-1" href=');
  await writeFile(new URL(`${kind}.html`, directory), preview);
}
console.log('Built account and class-invitation email design previews.');
