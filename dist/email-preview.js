const frame = document.querySelector('#email-frame');
const preview = document.querySelector('.preview-window');
const subjects = { activate: 'Activate your Ink Wire account', reset: 'Reset your Ink Wire password', student:'You’re invited to Animal Farm · Literature & Writing', parent:'Parent invitation: Animal Farm · Literature & Writing' };
let observer;
const resize = () => { if (frame.contentDocument?.body) frame.style.height = `${frame.contentDocument.body.scrollHeight}px`; };
frame.addEventListener('load', () => {
  observer?.disconnect();
  observer = new ResizeObserver(resize);
  observer.observe(frame.contentDocument.body);
  for (const image of frame.contentDocument.images) image.addEventListener('load', resize, {once:true});
  resize();
});
document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  const kind = button.dataset.kind;
  document.querySelectorAll('[data-kind]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelector('#preview-subject').textContent = subjects[kind];
  frame.title = `${button.textContent} email preview`;
  frame.src = `/email-previews/${kind}.html`;
}));
document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-size]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  preview.classList.toggle('is-mobile', button.dataset.size === 'mobile');
  requestAnimationFrame(resize);
}));

const selectedKind = new URLSearchParams(location.search).get('kind');
if(Object.hasOwn(subjects,selectedKind || ''))document.querySelector(`[data-kind="${selectedKind}"]`).click();
