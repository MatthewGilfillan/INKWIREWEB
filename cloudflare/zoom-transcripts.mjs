import {zoomAPI,zoomAccessToken} from './zoom-connection.mjs';
import {zoomURL} from '../dist/zoom-model.mjs';

export async function boundedText(response,max){
 const reader=response.body?.getReader();if(!reader)throw Error('Missing response body.');
 const parts=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Response too large.');}parts.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export function encodedMeetingUUID(uuid,retained=false){const encoded=encodeURIComponent(uuid);return (retained?uuid.includes('/'):uuid.startsWith('/')||uuid.includes('//'))?encodeURIComponent(encoded):encoded;}
async function downloadTranscript(url,token){
 const target=new URL(url);
 if(target.protocol!=='https:'||target.username||target.password||target.port||!/(^|\.)zoom\.(us|com)$/.test(target.hostname))throw Error('Invalid transcript download host.');
 const response=await fetch(target.href,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token}});
 if(!response.ok){await response.body?.cancel();throw Error('Transcript download unavailable.');}
 const text=await boundedText(response,524288);if(new TextEncoder().encode(text).length<30)throw Error('Transcript is incomplete.');return text;
}
export async function fetchZoomTranscript(env,meeting){
 let recordings;
 try{recordings=await zoomAPI(env,meeting.connection_user_id,'/meetings/'+encodedMeetingUUID(meeting.meeting_uuid)+'/recordings');}
 catch(error){if(![400,403,404].includes(error.zoomStatus))throw error;}
 let files=[],source='recording',recordingURL='';
 if(recordings){
  if(recordings.uuid!==meeting.meeting_uuid||(recordings.host_id&&recordings.host_id!==meeting.zoom_user_id))throw Error('Recording instance mismatch.');
  files=(recordings.recording_files||[]).filter(f=>f.recording_type==='audio_transcript'&&f.status==='completed'&&f.download_url);
  try{recordingURL=zoomURL(recordings.share_url||'',{recording:true});}catch{}
 }
 if(!files.length){
  // Retained transcripts can exist without a cloud recording. Numeric IDs return
  // the latest occurrence; using UUID is essential for historical class safety.
  const transcript=await zoomAPI(env,meeting.connection_user_id,'/meetings/'+encodedMeetingUUID(meeting.meeting_uuid,true)+'/transcript');
  if(transcript.meeting_id!==meeting.meeting_uuid||transcript.host_id!==meeting.zoom_user_id||transcript.account_id!==meeting.account_id)throw Error('Transcript instance mismatch.');
  if(transcript.can_download!==true||!transcript.download_url)throw Error('Transcript is not available to download.');
  files=[{download_url:transcript.download_url}];source='meeting';
 }
 if(files.length>20)throw Error('Too many transcript segments.');
 const token=await zoomAccessToken(env,meeting.connection_user_id),parts=[];let size=0;
 for(const file of files){const text=await downloadTranscript(file.download_url,token);size+=new TextEncoder().encode(text).length+2;if(size>524288)throw Error('Transcript exceeds 512 KiB.');parts.push(text);}
 return {text:parts.join('\n\n'),source,recordingURL};
}
