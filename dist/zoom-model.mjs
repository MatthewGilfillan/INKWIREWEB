export function zoomURL(value,{recording=false}={}){
 if(!value)return '';let url;try{url=new URL(value);}catch{throw Error('Enter a complete https:// Zoom link.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||value.length>2000||!/(^|\.)zoom\.(us|com)$/.test(url.hostname))throw Error('Use a secure Zoom link on zoom.us or zoom.com.');
 if(recording?!/^\/rec\/(share|play)\//.test(url.pathname):!/^\/(j|wc\/join)\/\d{9,11}\/?$/.test(url.pathname))throw Error(recording?'Use the Zoom recording’s sharing link.':'Use the participant meeting link, not a host start link.');
 url.hash='';return url.href;
}
export function meetingDetails(input){
 const joinURL=zoomURL(String(input.joinURL||'').trim()),fromURL=joinURL?new URL(joinURL).pathname.match(/\d{9,11}/)?.[0]:'',meetingId=String(input.meetingId||fromURL||'').replace(/[ -]/g,'');
 if(!/^\d{9,11}$/.test(meetingId))throw Error('Enter a 9–11 digit Zoom meeting ID.');if(fromURL&&fromURL!==meetingId)throw Error('The meeting ID does not match the link.');
 const passcode=String(input.passcode||'').trim();if(passcode.length>64||/[\x00-\x1f\x7f]/.test(passcode))throw Error('Check the meeting passcode.');
 return {meetingId,joinURL:joinURL||'https://zoom.us/j/'+meetingId,passcode,recordingURL:zoomURL(String(input.recordingURL||'').trim(),{recording:true})};
}
