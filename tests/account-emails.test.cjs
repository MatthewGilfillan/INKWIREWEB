const { test } = require('node:test');
const assert = require('node:assert/strict');

test('account email HTML preserves the exact activation/reset destination and a plain-text alternative', async () => {
  const { renderAccountEmail } = await import('../cloudflare/account-emails.mjs');
  const origin = 'https://inkwire-education.com';
  for (const kind of ['activate', 'reset']) {
    const url = `${origin}/account.html#${kind}=encoded%2Btoken&join=class%2Bjoin`;
    const result = renderAccountEmail({origin, kind, url});
    assert.ok(result.text.includes(url));
    assert.ok(result.html.includes(`href="${url.replace('&', '&amp;')}"`));
    assert.ok(result.html.includes('favicon-64.png'));
    assert.ok(result.html.indexOf('inkwire-original-logo.png') > result.html.indexOf('Button not working?'));
    assert.equal(result.html.includes('reading-student.jpg'), kind === 'activate');
    assert.ok(result.html.includes(kind === 'activate' ? '1 hour' : '30 minutes'));
    assert.ok(!/<script|<form|<iframe|data:image|url\(/i.test(result.html));
    assert.ok(Buffer.byteLength(result.html) < 20000);
  }
});

test('account email renderer refuses untrusted destinations or unexpected message types', async () => {
  const { renderAccountEmail } = await import('../cloudflare/account-emails.mjs');
  const origin = 'https://inkwire-education.com';
  for (const url of ['https://evil.invalid/account#activate=x', 'javascript:alert(1)', `${origin}/elsewhere#activate=x`, `${origin}/account#reset=x`]) {
    assert.throws(() => renderAccountEmail({origin, kind:'activate', url}));
  }
  assert.throws(() => renderAccountEmail({origin, kind:'unknown', url:`${origin}/account#activate=x`}));
});

test('student and parent invitations escape names, preserve join roles and describe the correct scope', async () => {
  const {renderInvitationEmail}=await import('../cloudflare/account-emails.mjs');
  const origin='https://inkwire-education.com',className='Books <script>alert(1)</script> & Writing',studentName='Jamie <b>Test</b>';
  for(const kind of ['class','student','family']){
    const code=kind==='class'?'ABCDEFGH':'ABCDEFGHJKLM';
    const mail=renderInvitationEmail({origin,kind,code,className,studentName:kind==='class'?'':studentName,expiresAt:Date.UTC(2026,10,8,10)});
    assert.ok(mail.html.includes('young-readers.jpg'));
    assert.ok(mail.html.includes('Books &lt;script&gt;'));
    assert.ok(!mail.html.includes('<script>'));
    assert.ok(mail.html.includes(`/join#${kind}=${code}`));
    assert.ok(mail.text.includes(`/join#${kind}=${code}`));
    assert.ok(mail.html.includes('8 Nov 2026, 18:00 (Beijing time, UTC+8)'));
    assert.equal(mail.text.includes('One account per invitation'),kind!=='class');
    assert.equal(mail.text.includes('across their classes'),kind==='family');
    assert.ok(mail.html.includes('favicon-64.png') && mail.html.includes('inkwire-original-logo.png'));
  }
  assert.throws(()=>renderInvitationEmail({origin,kind:'family',code:'ABCDEFGHJKLM',className,expiresAt:Date.now()}));
});
