const text=(value,max,label,optional=false)=>{
  if(typeof value!=='string' || value.length>max || (!optional && !value.trim()))throw Error(`Check ${label}.`);
  return value.trim();
};
export function validateQuiz(input){
  const title=text(input.title,160,'the quiz title'),reflectionPrompt=text(input.reflectionPrompt,500,'the reflection prompt',true);
  if(!Array.isArray(input.questions) || !input.questions.length || input.questions.length>20)throw Error('Add 1–20 questions.');
  const questions=input.questions.map((q,i)=>{
    const prompt=text(q.prompt,1000,`question ${i+1}`),explanation=text(q.explanation,1500,`the explanation for question ${i+1}`,true);
    if(!Array.isArray(q.options) || q.options.length<2 || q.options.length>4)throw Error('Each question needs 2–4 answers.');
    const options=q.options.map(o=>text(o,500,`the answers for question ${i+1}`));
    if(new Set(options).size!==options.length)throw Error('Use different answers within each question.');
    if(!Number.isInteger(q.correctIndex) || q.correctIndex<0 || q.correctIndex>=options.length)throw Error('Choose the correct answer for every question.');
    return {prompt,options,correctIndex:q.correctIndex,explanation};
  });
  return {title,questions,reflectionPrompt};
}
