import {api,escape} from './workspace-shared.js';
import {deviceTimeZone,validDisplayTimeZone,displayTimeZoneLabel} from './display-time-zone.mjs';

export async function mountAccountTimeZone(root){
 root.innerHTML='<p role="status">Loading time zone…</p>';
 try{
  const {timeZone}=await api('/api/account/preferences');if(!root.isConnected)return;
  const zones=[...new Set([deviceTimeZone(),'Asia/Bangkok','Asia/Shanghai','Europe/London','America/New_York','UTC',...(Intl.supportedValuesOf?.('timeZone')||[]),...(validDisplayTimeZone(timeZone)?[timeZone]:[])])].sort();
  root.innerHTML=`<form data-time-zone-form><h3>Calendar time zone</h3><p>Meetings keep the time zone they were scheduled in. Your calendar and Dashboard show the equivalent time here.</p><label for="account-time-zone">Display lesson times in</label><select id="account-time-zone"><option value="">Automatic · local time (${escape(displayTimeZoneLabel(deviceTimeZone()))})</option>${zones.map(zone=>`<option value="${escape(zone)}" ${zone===timeZone?'selected':''}>${escape(displayTimeZoneLabel(zone))}</option>`).join('')}</select><button type="submit" class="account-submit">Save time zone</button><p role="status" data-time-zone-status></p></form>`;
  root.querySelector('form').addEventListener('submit',async event=>{
   event.preventDefault();event.stopPropagation();const button=root.querySelector('button'),status=root.querySelector('[data-time-zone-status]');button.disabled=true;
   try{await api('/api/account/preferences',{timeZone:root.querySelector('select').value||null});status.textContent='Time zone saved. It applies across your calendars and Dashboard.';}
   catch(error){status.textContent=error.message;}finally{button.disabled=false;}
  });
 }catch(error){if(root.isConnected)root.innerHTML=`<p role="status">${escape(error.message)}</p><button type="button" class="account-link" data-retry-time-zone>Try again</button>`;root.querySelector('[data-retry-time-zone]')?.addEventListener('click',()=>mountAccountTimeZone(root));}
}
