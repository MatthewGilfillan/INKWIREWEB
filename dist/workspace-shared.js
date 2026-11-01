export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function api(path, body, { timeoutMs = 20000 } = {}) {
  const response=await fetch(path,{method:body === undefined ? 'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body === undefined ? {Accept:'application/json'}:{'Content-Type':'application/json',Accept:'application/json'},...(body === undefined ? {}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(timeoutMs)});
  const result=await response.json().catch(()=>({}));
  if (!response.ok) throw Object.assign(new Error(result.message || 'Could not complete this request. Please try again.'),{status:response.status,code:result.code});
  return result;
}
export async function copy(value, input, status) {
  try {await navigator.clipboard.writeText(value);status.textContent='Copied.';}
  catch {input.focus();input.select();status.textContent='Select and copy the text above.';}
}
export function signOut(button,status) {
  button.addEventListener('click',async()=>{button.disabled=true;try {await api('/api/accounts/signout',{});location.replace('/account');}catch(error){status.textContent=error.message;button.disabled=false;}});
}

export function requestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
