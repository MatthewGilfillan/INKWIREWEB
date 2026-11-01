// Forms content only: never request or import respondents, responses or grades.
export function parseGoogleFormLink(value){
  let url;try{url=new URL(value);}catch{throw Error('Paste the Google Form’s editor link, ending in /edit.');}
  const match=url.pathname.match(/^\/forms\/(?:u\/\d+\/)?d\/([\w-]+)\/edit\/?$/);
  if(url.protocol!=='https:' || url.hostname!=='docs.google.com' || url.username || url.password || !match || match[1]==='e')throw Error('Open the form as its owner or editor and copy the /edit link. Short links and student response links do not include its answer key.');
  return match[1];
}
const text=value=>typeof value==='string'?value.trim():'';
export function convertGoogleForm(form){
  if(!form || !Array.isArray(form.items) || !form.info || form.items.length>500)throw Error('This form could not be read, or has more than 500 items.');
  const rows=[],notes=[];let section='',context=[],media=false;
  for(const item of form.items){
    if(item.pageBreakItem){section=[text(item.title),text(item.description)].filter(Boolean).join('\n');context=[];media=false;continue;}
    if(item.textItem){context.push([text(item.title),text(item.description)].filter(Boolean).join('\n'));continue;}
    if(item.imageItem || item.videoItem){media=true;notes.push('A section contains media. Questions in that section need manual adaptation.');continue;}
    if(!item.questionItem && !item.questionGroupItem)continue;
    const q=item.questionItem?.question,choice=q?.choiceQuestion,options=choice?.options?.map(o=>text(o.value)) || [];
    const prompt=[text(form.info.description),section,...context,text(item.title),text(item.description)].filter(Boolean).join('\n\n');
    const row={label:text(item.title)||'Untitled question',question:null,notes:[]};
    if(media || item.questionItem?.image || choice?.options?.some(o=>o.image))row.notes.push('Image or video question: add it manually after reviewing its media.');
    else if(!['RADIO','DROP_DOWN'].includes(choice?.type))row.notes.push('Not imported: this version supports single-answer multiple choice and dropdown questions.');
    else if(choice.options.some(o=>o.isOther || o.goToAction || o.goToSectionId))row.notes.push('Not imported: “Other” answers and branching need manual adaptation.');
    else if(options.length<2 || options.length>4 || options.some(o=>!o || o.length>500 || /[\r\n]/.test(o)) || new Set(options).size!==options.length)row.notes.push('Not imported: use 2–4 different, single-line answer choices of up to 500 characters.');
    else if(!prompt || prompt.length>1000)row.notes.push('Not imported: question and section instructions must fit within 1,000 characters.');
    else{
      const answers=q.grading?.correctAnswers?.answers || [],index=answers.length===1?options.indexOf(text(answers[0].value)):-1;
      if(index<0)row.notes.push('Choose a correct answer in the editor before assigning.');
      if(q.grading?.pointValue!==undefined && q.grading.pointValue!==1)row.notes.push(`Original: ${q.grading.pointValue} points. Ink Wire uses 1 point per question.`);
      const feedback=[['Feedback',q.grading?.generalFeedback],['Correct answer',q.grading?.whenRight],['Review',q.grading?.whenWrong]].flatMap(([label,f])=>f?.text?[`${label}: ${text(f.text)}`]:[]).join('\n');
      if(feedback.length>1500)row.notes.push('Long feedback was omitted; copy a shorter explanation into the editor.');
      if([q.grading?.generalFeedback,q.grading?.whenRight,q.grading?.whenWrong].some(f=>f?.material?.length))row.notes.push('Feedback media links are not imported.');
      row.question={prompt,options,correctIndex:index,explanation:feedback.length<=1500?feedback:''};
    }
    rows.push(row);
  }
  const title=text(form.info.title)||text(form.info.documentTitle)||'Imported Google Form';
  if(title.length>160)notes.push('The quiz title is shortened to 160 characters.');
  return {title:title.slice(0,160),rows,notes:[...new Set(notes)]};
}
