// Transcript previews are deliberately tab-local. No raw transcript is uploaded,
// persisted, shared with other roles, or sent to an AI service in this prototype.
const transcriptPreviews = new Map();
const TRANSCRIPT_MAX_BYTES = 2 * 1024 * 1024;
function validateTranscriptFile(name,size,text) {
  if(!/\.(vtt|txt)$/i.test(name))throw new Error('Choose a Zoom .vtt transcript or a .txt file.');
  if(size>TRANSCRIPT_MAX_BYTES)throw new Error('This preview accepts transcripts up to 2 MB.');
  if(typeof text!=='string' || !text.trim())throw new Error('The transcript file is empty.');
  if(text.includes('\0'))throw new Error('This does not look like a plain-text transcript.');
  return text.replace(/^\uFEFF/,'');
}
function teacherTranscriptPanel() {
  const entry=transcriptPreviews.get(assessmentKey());
  return '<section class="card transcript-panel"><span class="eyebrow">TRANSCRIPT</span><h2>Class transcript</h2><p>Choose the file you downloaded from Zoom, then review the conversation while writing your lesson recap.</p><p class="transcript-context"><b>'+esc(student)+'</b><br>Week '+Math.ceil(week/2)+' · Lesson '+((week-1)%2+1)+'</p><label class="formlabel" for="transcript-file">Choose transcript · .vtt or .txt</label><input id="transcript-file" type="file" accept=".vtt,.txt,text/vtt,text/plain" aria-describedby="transcript-help"><p id="transcript-help" class="student-small">Preview only · Up to 2 MB. Use fictional content. The file stays in this tab and is cleared when you reload.</p><div id="transcript-result">'+transcriptPreviewHTML(entry)+'</div><button class="btn wide" type="button" disabled>Generate draft · API not connected</button><p class="student-small">Once connected: draft a lesson recap and learning targets, check them, then share the reviewed assessment.</p><p id="transcript-status" role="status" class="student-small"></p></section>';
}
function transcriptPreviewHTML(entry) {
  if(!entry)return '';
  return '<div class="transcript-loaded"><b>'+esc(entry.name)+'</b><details><summary>Read transcript</summary><pre>'+esc(entry.text)+'</pre></details><button id="transcript-remove" type="button" class="link text-button">Remove transcript from this tab</button></div>';
}
function bindTranscriptRemove() {
  $('#transcript-remove')?.addEventListener('click',()=>{
    transcriptPreviews.delete(assessmentKey());$('#transcript-result').innerHTML='';$('#transcript-file').value='';$('#transcript-status').textContent='Transcript removed from this tab.';
  });
}
function bindTranscriptEvents() {
  if(role!=='teacher')return;
  bindTranscriptRemove();
  $('#transcript-file')?.addEventListener('change',async event=>{
    const input=event.target,file=input.files?.[0],key=assessmentKey();if(!file)return;
    const status=$('#transcript-status');status.textContent='Reading your file…';
    try {
      if(file.size>TRANSCRIPT_MAX_BYTES)throw new Error('This preview accepts transcripts up to 2 MB.');
      if(!/\.(vtt|txt)$/i.test(file.name))throw new Error('Choose a Zoom .vtt transcript or a .txt file.');
      const text=validateTranscriptFile(file.name,file.size,await file.text());
      // Ignore a late file read if the teacher has moved to another lesson/view.
      if(assessmentKey()!==key || !input.isConnected)return;
      const entry={name:file.name,text};transcriptPreviews.set(key,entry);
      $('#transcript-result').innerHTML=transcriptPreviewHTML(entry);bindTranscriptRemove();status.textContent='Transcript ready to read. Nothing has been uploaded or generated.';
    } catch(error) {
      if(input.isConnected){input.value='';status.textContent=error.message || 'Could not read this file. Try a plain-text transcript.';}
    }
  });
}
