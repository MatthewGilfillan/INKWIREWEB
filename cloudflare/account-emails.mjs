// Shared by real account delivery and the public, token-free design previews.
// Keep essential layout inline and table-based for email clients.
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const copy = {
  activate: {
    subject: 'Activate your Ink Wire account',
    preheader: 'Welcome to Ink Wire. Activate your account and begin your next chapter.',
    eyebrow: 'WELCOME TO INK WIRE',
    title: 'Your next chapter starts here.',
    intro: 'A place to read, think, write and grow.',
    heading: 'Let’s get your account ready.',
    body: 'Thanks for joining Ink Wire. Confirm your email address to activate your account and open your learning space.',
    action: 'Activate account', expiry: '1 hour',
    note: 'If you didn’t create an Ink Wire account, you can safely ignore this email.',
  },
  reset: {
    subject: 'Reset your Ink Wire password',
    preheader: 'Choose a new password for your Ink Wire account. This link expires in 30 minutes.',
    eyebrow: 'YOUR INK WIRE ACCOUNT',
    title: 'Reset your password.',
    body: 'We received a request to reset your Ink Wire password. Use the button below to choose a new one.',
    action: 'Reset password', expiry: '30 minutes',
    note: 'If you didn’t request this, you can safely ignore this email. Your password will stay the same.',
  },
};

export function renderAccountEmail({ origin, kind, url }) {
  const content = copy[kind];
  if (!content) throw new Error('Unsupported account email');
  const site = new URL(origin), actionURL = new URL(url);
  if (site.protocol !== 'https:' || site.username || site.password || site.origin !== origin ||
      actionURL.origin !== origin || actionURL.username || actionURL.password ||
      !['/account', '/account.html'].includes(actionURL.pathname) || !actionURL.hash.startsWith(`#${kind}=`)) {
    throw new Error('Invalid account email destination');
  }
  const photo = kind === 'activate';
  const text = [
    photo ? 'Welcome to Ink Wire!' : content.title,
    content.body,
    `${escapeHTML(content.action)}:\n${url}`,
    `This link expires in ${content.expiry} and can only be used once.`,
    content.note,
    'Ink Wire Education',
  ].join('\n\n');
  return { subject: content.subject, text, html: renderLayout({origin, url, content, photo}) };
}

function renderLayout({origin, url, content, photo = false, invitation = null}) {
  const asset = name => escapeHTML(`${origin}/assets/${name}`);
  const link = escapeHTML(url), home = escapeHTML(origin);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${escapeHTML(content.subject)}</title>
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}img{-ms-interpolation-mode:bicubic;border:0}
  a:focus{outline:3px solid #032b62;outline-offset:3px}
  @media screen and (max-width:620px){
    .email-shell{width:100%!important}.outer-pad{padding:12px 8px!important}.email-pad{padding-left:24px!important;padding-right:24px!important}
    .hero-copy,.hero-photo{display:block!important;width:100%!important;box-sizing:border-box!important}
    .hero-copy{padding:30px 24px 26px!important}.hero-photo{padding:0 24px 28px!important}
    .hero-photo img{width:100%!important;max-width:240px!important;height:auto!important;margin:0 auto!important}
    .hero-title{font-size:34px!important;line-height:39px!important}.email-button{display:block!important;text-align:center!important}
  }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f3f5f9;color:#032b62;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;font-size:1px;line-height:1px;color:#f3f5f9;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHTML(content.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f5f9" style="width:100%;background-color:#f3f5f9;">
<tr><td align="center" class="outer-pad" style="padding:32px 16px;">
<table role="presentation" width="600" class="email-shell" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td height="5" bgcolor="#137b5d" style="height:5px;line-height:5px;font-size:0;">&nbsp;</td></tr>
<tr><td class="email-pad" style="padding:24px 36px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
    <td width="42" valign="middle" style="width:42px;"><a href="${home}" target="_blank" rel="noopener noreferrer"><img src="${asset('favicon-64.png')}" width="32" height="32" alt="Ink Wire" style="display:block;width:32px;height:32px;"></a></td>
    <td valign="middle" style="font-size:13px;line-height:20px;letter-spacing:1px;color:#032b62;font-weight:bold;">INK WIRE EDUCATION</td>
  </tr></table>
</td></tr>
${photo ? `<tr><td bgcolor="#f4eaf3" style="background-color:#f4eaf3;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    <td class="hero-copy" width="336" valign="middle" style="width:336px;padding:32px 24px 32px 36px;">
      <p style="margin:0 0 18px;font-size:10px;line-height:16px;letter-spacing:1.8px;font-weight:bold;color:#455c85;">${escapeHTML(content.eyebrow)}</p>
      <h1 class="hero-title" style="margin:0 0 20px;font-size:38px;line-height:43px;letter-spacing:-1px;font-weight:bold;color:#032b62;">${escapeHTML(content.title)}</h1>
      <p style="margin:0;font-size:16px;line-height:25px;color:#455c85;">${escapeHTML(content.intro)}</p>
    </td>
    <td class="hero-photo" width="200" valign="middle" style="width:200px;padding:28px 28px 28px 0;">
      <img src="${asset('reading-student.jpg')}" width="200" height="300" alt="A boy in a pink shirt reading a book with a pen in hand" style="display:block;width:200px;height:300px;border-radius:4px;">
    </td>
  </tr></table>
</td></tr>` : ''}
${invitation ? `<tr><td><img src="${asset('young-readers.jpg')}" width="600" height="400" alt="A boy and girl smiling between stacks of books" style="display:block;width:100%;max-width:600px;height:auto;"></td></tr>` : ''}
<tr><td class="email-pad" style="padding:32px 36px 20px;">
  ${photo ? `<h2 style="margin:0 0 14px;color:#032b62;font-size:24px;line-height:31px;">${escapeHTML(content.heading)}</h2>` : `<p style="margin:0 0 16px;font-size:10px;line-height:16px;letter-spacing:1.8px;font-weight:bold;color:#455c85;">${escapeHTML(content.eyebrow)}</p><h1 style="margin:0 0 20px;color:#032b62;font-size:34px;line-height:41px;letter-spacing:-.5px;">${escapeHTML(content.title)}</h1>`}
  <p style="margin:0 0 24px;font-size:16px;line-height:26px;color:#455c85;">${escapeHTML(content.body)}</p>
  ${invitation ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;"><tr><td bgcolor="#f4eaf3" style="padding:20px;background-color:#f4eaf3;border-radius:6px;word-break:break-word;">
    <p style="margin:0 0 6px;font-size:11px;line-height:18px;letter-spacing:1px;color:#455c85;">${invitation.kind === 'family' ? 'INVITATION FROM' : 'YOUR CLASS'}</p>
    <p style="margin:0;font-size:20px;line-height:28px;font-weight:bold;color:#032b62;">${escapeHTML(invitation.className)}</p>
    ${invitation.studentName ? `<p style="margin:10px 0 0;font-size:14px;line-height:22px;color:#455c85;">Student: <strong>${escapeHTML(invitation.studentName)}</strong></p>` : ''}
  </td></tr></table><p style="margin:0 0 24px;font-size:14px;line-height:23px;color:#455c85;">${escapeHTML(invitation.instructions)}</p>` : ''}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#64e6be" style="background-color:#64e6be;border-radius:6px;text-align:center;mso-padding-alt:16px 28px;">
    <a class="email-button" href="${link}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:16px 28px;font-size:16px;line-height:20px;font-weight:bold;color:#071c40;text-decoration:none;border-radius:6px;">${escapeHTML(content.action)}</a>
  </td></tr></table>
  <p style="margin:18px 0 0;font-size:13px;line-height:21px;color:#455c85;">${invitation ? `Expires ${escapeHTML(invitation.expiryLabel)}.${invitation.kind === 'class' ? '' : ' One account per invitation.'}` : `This link expires in <strong>${content.expiry}</strong> and can only be used once.`}</p>
</td></tr>
<tr><td class="email-pad" style="padding:4px 36px 28px;">
  ${invitation ? `<p style="margin:0 0 18px;font-size:13px;line-height:22px;color:#455c85;">Or open <a href="${home}/join" target="_blank" style="color:#137b5d;">inkwire-education.com/join</a>, choose <strong>${invitation.kind === 'family' ? 'Parent invitation' : invitation.kind === 'student' ? 'Individual student invitation' : 'Class join code'}</strong> and enter <strong style="letter-spacing:2px;white-space:nowrap;">${escapeHTML(invitation.code.match(/.{1,4}/g).join('-'))}</strong>.</p>` : ''}
  <p style="margin:0 0 18px;font-size:13px;line-height:21px;color:#455c85;">${escapeHTML(content.note)}</p>
  <p style="margin:0 0 6px;font-size:12px;line-height:19px;color:#455c85;">Button not working? Copy this link into your browser:</p>
  <p style="margin:0;font-size:12px;line-height:19px;word-break:break-all;overflow-wrap:anywhere;"><a href="${link}" target="_blank" rel="noopener noreferrer" style="color:#137b5d;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${link}</a></p>
</td></tr>
<tr><td class="email-pad" align="center" bgcolor="#ffffff" style="padding:28px 36px 30px;background-color:#ffffff;border-top:1px solid #e3e6ee;">
  <a href="${home}" target="_blank" rel="noopener noreferrer"><img src="${asset('inkwire-original-logo.png')}" width="180" alt="Ink Wire Education" style="display:block;width:180px;max-width:100%;height:auto;"></a>
  <p style="margin:14px 0 0;font-size:12px;line-height:20px;color:#455c85;">Literature. Writing. Learning.</p>
  <p style="margin:4px 0 0;font-size:11px;line-height:18px;color:#455c85;">${invitation ? 'A class invitation' : 'An account message'} from Ink Wire Education.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function renderInvitationEmail({origin, kind, code, className, studentName = '', expiresAt}) {
  const site = new URL(origin);
  if (site.protocol !== 'https:' || site.origin !== origin || !['class','student','family'].includes(kind) ||
      !new RegExp(`^[A-HJ-NP-Z2-9]{${kind === 'class' ? 8 : 12}}$`).test(code) ||
      typeof className !== 'string' || !className.trim() || !Number.isFinite(expiresAt) ||
      (kind !== 'class' && !studentName)) throw new Error('Invalid invitation email');
  const parent = kind === 'family';
  const subject = parent ? `Parent invitation: ${className}` : `You’re invited to ${className}`;
  const url = `${origin}/join#${kind}=${code}`;
  const expiryLabel = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Shanghai',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(expiresAt) + ' (Beijing time, UTC+8)';
  const instructions = parent
    ? 'Choose a Parent account when you sign up, or sign in to your existing Parent account. Then confirm the connection to your child.'
    : 'Choose a Student account when you sign up, or sign in to your existing Student account. Then confirm that you want to join.';
  const content = {
    subject: subject.replace(/[\r\n]/g,' '),
    preheader: parent ? 'Connect your parent account and stay close to your child’s learning.' : 'Your teacher has invited you to learn with Ink Wire.',
    eyebrow: parent ? 'FOR PARENTS & FAMILIES' : 'YOUR CLASS INVITATION',
    title: parent ? 'Follow your child’s learning.' : 'Join your class.',
    body: parent ? `You’re invited to connect with ${studentName} on Ink Wire. Follow their classes, see lesson summaries and teacher feedback, and keep up with homework.` : 'Your teacher has invited you to Ink Wire. Find your lesson timetable, learning materials, quizzes and feedback in one place.',
    action: parent ? 'Connect parent account' : 'Join class',
    note: parent ? 'This private link connects one parent account to the student named above across their classes. Please do not forward it. If this invitation was not intended for you, you can ignore it.' : kind === 'student' ? 'This private link is for the student named above. Please do not forward it. If it was not intended for you, you can ignore it.' : 'This invitation is for students in this class. If it was not intended for you, you can ignore it.',
  };
  const invitation = {kind, code, className, studentName, expiryLabel, instructions};
  return {
    subject:content.subject,
    text:[content.title,content.body,`Class: ${className}`,studentName ? `Student: ${studentName}` : '',instructions,`${content.action}:\n${url}`,`Invitation code: ${code.match(/.{1,4}/g).join('-')}`,`Expires ${expiryLabel}.${kind === 'class' ? '' : ' One account per invitation.'}`,content.note,'Ink Wire Education'].filter(Boolean).join('\n\n'),
    html:renderLayout({origin,url,content,invitation}),
  };
}
