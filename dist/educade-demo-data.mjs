// EDUCADE fictional fixture, imported with the owner’s permission from public/teacher-data.js
// development 1a49552d1d76d4d3d9f973369454331b0fe7ba7c. Only the module wrapper changes.
/* Original EDUCADE demo taxonomy. Coverage reference: supplied Grade 5 skill lists.
   EDUCADE IDs identify skills; standards mappings live separately below. */
const demo = (() => {
  const domains = {
    reading: {name:'Reading', sections:[{id:'foundations',name:'Reading Foundations'},{id:'comprehension',name:'Reading Comprehension'}]},
    writing: {name:'Writing'}, grammar:{name:'Grammar'}, vocabulary:{name:'Vocabulary'}
  };
  const groups = [];
  function group(domain, section, key, name, labels) {
    const prefix = `EDU.G5.${domain.toUpperCase()}.${section ? section.toUpperCase()+'.' : ''}${key.toUpperCase()}`;
    const entry={id:prefix,domain,section,key,name,skills:labels.split('|').map((label,i)=>({id:`${prefix}.${String(i+1).padStart(2,'0')}`,name:label}))};
    groups.push(entry); return entry;
  }
  group('reading','foundations','syllables','Multisyllabic words','Identify syllable types|Segment multisyllabic words|Read multisyllabic words|Spell multisyllabic words');
  group('reading','foundations','affixed','Affixed words','Read words with affixes|Use an affixed word in a sentence');
  group('reading','foundations','frequent','High-frequency and irregular words','Read high-frequency words|Spell irregular words');
  group('reading','comprehension','mainidea','Main idea','Use key details to find the main idea|Summarize the main idea|Combine ideas from two texts');
  group('reading','comprehension','inference','Inference and theme','Draw an inference using textual evidence|Identify a story’s theme|Compare themes across stories');
  group('reading','comprehension','purpose','Author’s purpose and perspective','Identify author’s purpose|Compare points of view|Compare information from two texts|Analyze an argument');
  group('reading','comprehension','tone','Tone','Distinguish formal and informal language');
  group('reading','comprehension','character','Character thoughts and motivations','Compare characters using actions and dialogue|Explain how a character changes');
  group('reading','comprehension','story','Story elements','Identify narrative point of view|Identify story elements|Analyze plot events');
  group('reading','comprehension','structure','Text structure','Sequence informational events|Compare and contrast information|Connect causes and effects|Connect problems and solutions');
  group('reading','comprehension','sensory','Sensory details','Recognize sensory details|Sort sensory details');
  group('reading','comprehension','figurative','Literary devices','Explain similes and metaphors in context|Interpret an allusion|Explain the effect of figurative language');
  group('reading','comprehension','wordmeaning','Vocabulary in a text','Determine a word’s meaning in a story|Use context to explain a phrase');
  group('reading','comprehension','visual','Visual elements','Interpret illustrations|Read a graphic organizer');
  group('reading','comprehension','features','Text features','Use headings, captions and diagrams');
  group('reading','comprehension','poetry','Poetry elements','Identify rhyme patterns|Identify elements of poetry');
  group('reading','comprehension','literary','Literary texts','Read fantasy|Read realistic fiction|Read historical fiction|Read poetry and drama');
  group('reading','comprehension','informational','Informational texts','Read about people and places|Read about science and nature|Read about history and technology');
  // Extend the catalogue without renaming existing IDs or generating responses.
  group('reading','comprehension','evidence','Supporting evidence','Select textual evidence to support an explanation|Explain how evidence supports a conclusion');
  group('reading','comprehension','integrating','Integrating information','Integrate information from visual and written sources');
  for(const [key,label] of [['story','Explain how setting shapes events'],['tone','Explain tone using word choice'],['structure','Identify and explain a text’s structure'],['features','Explain how text features support understanding']]){
    const entry=groups.find(g=>g.domain==='reading'&&g.key===key);
    entry.skills.push({id:`${entry.id}.${String(entry.skills.length+1).padStart(2,'0')}`,name:label});
  }
  group('writing',null,'organization','Organizing writing','Link information with transitions|Sequence sentences|Organize information by topic|Remove unrelated details');
  group('writing',null,'opening','Introductions and conclusions','Write a topic sentence|Write a concluding sentence');
  group('writing',null,'summary','Summarizing','Summarize a story');
  group('writing',null,'argument','Developing and supporting arguments','Support an opinion with reasons|Distinguish facts and opinions|Select supporting details');
  group('writing',null,'description','Descriptive details','Add sensory detail to a narrative|Show character emotions|Choose a stronger verb');
  group('writing',null,'variety','Sentence variety','Create varied sentences');
  group('writing',null,'revision','Editing and revising','Revise a draft using feedback|Correct a commonly confused word');
  group('writing',null,'research','Research skills','Avoid plagiarism|Distinguish primary and secondary sources');
  group('grammar',null,'spelling','Spelling','Spell words with prefixes|Spell words with suffixes|Spell common words');
  group('grammar',null,'sentences','Sentences, fragments and run-ons','Identify sentence types|Recognize a complete sentence|Identify clauses|Build compound and complex sentences');
  group('grammar',null,'nouns','Nouns','Recognize common and proper nouns|Form plurals|Use possessive nouns');
  group('grammar',null,'pronouns','Pronouns','Use subject and object pronouns|Use possessive and reflexive pronouns|Use relative pronouns');
  group('grammar',null,'verbtypes','Verb types','Recognize main and helping verbs|Use modal verbs');
  group('grammar',null,'agreement','Subject–verb agreement','Choose an agreeing subject and verb|Use agreement with compound subjects');
  group('grammar',null,'tense','Verb tense','Form and use perfect verb tenses|Correct inappropriate shifts in tense|Use progressive verb tenses');
  group('grammar',null,'modifiers','Adjectives and adverbs','Distinguish adjectives and adverbs|Order adjectives|Use comparisons');
  group('grammar',null,'prepositions','Prepositions','Identify prepositions and objects|Use prepositional phrases');
  group('grammar',null,'conjunctions','Conjunctions','Explain how a conjunction connects ideas|Use correlative conjunctions');
  group('grammar',null,'contractions','Contractions','Use pronoun–verb contractions|Use contractions with not');
  group('grammar',null,'commas','Commas','Use a comma after an introductory element|Use commas in a series|Use commas in direct address');
  group('grammar',null,'capitalization','Capitalization','Correct capitalization|Capitalize titles');
  group('grammar',null,'formatting','Formatting','Format titles|Punctuate dialogue|Format addresses');
  group('grammar',null,'abbreviations','Abbreviations','Abbreviate days and months|Use common abbreviations');
  group('vocabulary',null,'affixes','Prefixes and suffixes','Use a prefix to explain meaning|Use a suffix to explain meaning|Group words by affix');
  group('vocabulary',null,'roots','Greek and Latin roots','Use a Greek or Latin root to infer meaning|Group words by shared roots');
  group('vocabulary',null,'categories','Categories','Group related words|Identify a word that does not belong');
  group('vocabulary',null,'relationships','Synonyms and antonyms','Explain relationships between synonyms and antonyms|Find a synonym in context');
  group('vocabulary',null,'analogies','Analogies','Complete a word analogy');
  group('vocabulary',null,'homophones','Homophones and multiple meanings','Choose the correct homophone|Interpret a multiple-meaning word');
  group('vocabulary',null,'idioms','Idioms and adages','Explain an idiom in context|Explain an adage');
  group('vocabulary',null,'shades','Shades of meaning','Compare shades of meaning|Recognize connotation');
  group('vocabulary',null,'context','Context clues','Infer a word’s meaning using context|Use domain-specific vocabulary|Use academic vocabulary');
  group('vocabulary',null,'reference','Reference skills','Use dictionary entries|Use guide words|Use a thesaurus|Alphabetize words');
  const find=(domain,key,n=0)=>groups.find(g=>g.domain===domain&&g.key===key).skills[n];
  const readingCategory=(key,name,description,selection)=>({id:`EDU.G5.READING.CATALOGUE.${key.toUpperCase()}`,key,name,description,domain:'reading',section:'comprehension',skills:selection.flatMap(([topic,indices])=>indices.map(n=>find('reading',topic,n)))});
  // Navigation groups reference each reading skill once. Genre/context entries
  // are kept separately; they do not become assessment scores or skill columns.
  const readingCatalogue=[
    readingCategory('meaning','Meaning and evidence','Find the central meaning, draw inferences and support explanations with text evidence.',[['mainidea',[0,1]],['inference',[0,1]],['evidence',[0,1]]]),
    readingCategory('characters','Characters and events','Explore characters, setting, plot and the connections between events.',[['character',[0,1]],['story',[1,2,3]],['structure',[2]]]),
    readingCategory('craft','Author’s craft','Explore purpose, point of view, tone, sensory details and language in context.',[['purpose',[0,1]],['story',[0]],['tone',[0,1]],['sensory',[0,1]],['figurative',[0,1,2]],['wordmeaning',[0,1]]]),
    readingCategory('structure','Structure and features','Explore how organisation, text features, visuals and poetry shape understanding.',[['structure',[0,1,3,4]],['features',[0,1]],['visual',[0,1]],['poetry',[0,1]]]),
    readingCategory('comparing','Comparing and evaluating','Compare texts and themes, evaluate arguments and integrate information.',[['mainidea',[2]],['inference',[2]],['purpose',[2,3]],['integrating',[0]]])
  ];
  const readingContexts=groups.filter(g=>g.domain==='reading'&&['literary','informational'].includes(g.key));
  const readingSkills=()=>[...groups.filter(g=>g.domain==='reading'&&g.section==='foundations').flatMap(g=>g.skills),...readingCatalogue.flatMap(g=>g.skills)];
  const samples={};
  const mappings={};
  function assess(domain,key,n,code,standard,title,prompt,answer,retry,hint){
    const skill=find(domain,key,n);
    samples[skill.id]={title,prompt,answer,retry,hint};
    mappings[skill.id]={code:`CCSS.ELA-LITERACY.${code}`,description:standard,status:'candidate',sourceType:'published reference mirror',source:`https://www.thecorestandards.org/ELA-Literacy/${code.split('.')[0]}/5/`,checked:'2026-10-09'};
    return skill.id;
  }
  const reading=[
    assess('reading','inference',0,'RL.5.1','Quote accurately when explaining a text and drawing inferences.','The rising tide','“The water climbed past the lowest step. Eirik pulled the supply crates up to the higher path.” Why does Eirik move the crates? Quote a detail from the text.','He wants to keep them dry because “The water climbed past the lowest step.”','He moves them because he dislikes the harbour.','Connect the rising water with the location of the crates.'),
    assess('reading','wordmeaning',0,'RL.5.4','Determine the meaning of words and phrases in a text.','Harbour supplies','“Bring me a sturdy rope. The wind is rising, and we must secure the ship.” What does sturdy mean here?','Strong enough to hold the ship safely.','Thin and easy to break.','Think about the job the rope needs to do.'),
    assess('reading','figurative',0,'RL.5.4','Determine meanings of words and phrases, including figurative language.','The storm’s voice','“The wind howled like a hungry wolf.” What does this simile suggest about the wind?','It is loud and fierce, like a wolf’s howl.','A real wolf is hiding on the ship.','Compare the sound of wind with the sound of a wolf.'),
    assess('reading','character',0,'RL.5.3','Compare and contrast characters using details such as actions and dialogue.','Two ways to help','Eirik says, “Check every knot first.” Liv says, “I will carry the supplies while you check.” Compare their priorities, using their words.','Eirik says “Check every knot first,” showing his focus on safety. Liv offers to “carry the supplies,” showing her focus on preparation. Both want to help the crew.','Both characters want to leave the supplies behind.','Look at what each character offers to do.')
  ];
  const foundation=assess('reading','syllables',2,'RF.5.3.a','Use letter–sound knowledge, syllabication and morphology to read unfamiliar multisyllabic words.','A longer word','Read transportation by identifying its syllable chunks.','trans / por / ta / tion — transportation','trans / port — stops before the end of the word','Try one syllable at a time, then blend the complete word.');
  const writing=[
    assess('writing','organization',0,'W.5.2.c','Link ideas within and across categories of information using words, phrases and clauses.','A useful connection','Link these informational ideas: “The wind is rising. The crew must check the ropes.” Use a transition showing the connection.','The wind is rising; therefore, the crew must check the ropes.','The wind is rising. Also, the apples are red.','Choose a transition that shows a cause and a response.'),
    assess('writing','argument',0,'W.5.1.b','Support an opinion with logically ordered reasons, facts and details.','Choose the safer plan','Support this opinion with a reason from the quest: “The crew should check the ropes before departure.”','They should check first because the rising wind could loosen the ship’s ropes.','They should check because it is my favourite plan.','Use the rising wind as a fact to support the opinion.'),
    assess('writing','description',0,'W.5.3.d','Use concrete words, phrases and sensory details to convey experiences and events.','Bring the harbour to life','Add concrete sensory details to this narrative sentence: “We walked by the sea.”','We followed the salt-sprayed path as cold waves slapped the wooden pier.','We walked by the nice sea in a nice place.','Describe something the character can hear or feel.'),
    assess('writing','revision',0,'W.5.5','With guidance and support, strengthen writing by planning, revising, editing or rewriting.','A partner’s suggestion','A partner says your verb could show more urgency. Revise: “Liv went to the ship before the tide rose.”','Liv hurried to the ship before the tide rose.','Liv went to the ship and it was a ship.','Choose a verb that shows quick movement.')
  ];
  const grammar=[
    assess('grammar','conjunctions',0,'L.5.1.a','Explain the function of conjunctions, prepositions and interjections.','Connecting a reason','In “We wait because the tide is high,” what is the job of because?','It joins the action to the reason for waiting.','It names the person who waits.','Notice which idea explains the other idea.'),
    assess('grammar','tense',0,'L.5.1.b','Form and use perfect verb tenses.','Before the storm','Complete using the past perfect: “Before the storm arrived, the crew ___ the ropes.”','had secured','will secure','The securing happened before another past event.'),
    assess('grammar','tense',1,'L.5.1.d','Recognize and correct inappropriate shifts in verb tense.','Keep the timeline clear','Correct the tense shift: “Yesterday, Liv carried supplies and checks the sail.”','Yesterday, Liv carried supplies and checked the sail.','Yesterday, Liv carries supplies and will check the sail.','Both actions happened yesterday.'),
    assess('grammar','commas',0,'L.5.2.b','Use a comma to separate an introductory element from the rest of a sentence.','A pause before departure','Add the missing comma: “Before sunrise the crew checked the ship.”','Before sunrise, the crew checked the ship.','Before, sunrise the crew checked the ship.','Find the introductory time phrase.')
  ];
  const vocabulary=[
    assess('vocabulary','context',0,'L.5.4.a','Use context as a clue to the meaning of a word or phrase.','A narrow route','“The passage was narrow; only one sailor could walk through at a time.” Explain narrow using the context.','Not wide; the passage fits just one sailor.','Very deep and full of water.','Use the clue about one sailor at a time.'),
    assess('vocabulary','roots',0,'L.5.4.b','Use common, grade-appropriate Greek and Latin affixes and roots as clues to meaning.','Cargo to carry','The Latin root port means carry. What does transport suggest when the crew transports cargo?','They carry or move the cargo from one place to another.','They paint the cargo blue.','Use the meaning of port to explain the action.'),
    assess('vocabulary','relationships',0,'L.5.5.c','Use relationships between words such as synonyms and antonyms to understand words.','Words that work together','How do strong and sturdy help you understand the rope? How is fragile different?','Strong and sturdy are similar; fragile means easily broken, the opposite quality.','All three words mean exactly the same thing.','Separate similar meanings from opposite meanings.'),
    assess('vocabulary','context',1,'L.5.6','Acquire and accurately use grade-appropriate academic and domain-specific words.','The harbour log','Use cargo accurately in a sentence about the supplies being carried on the ship.','The crew loaded cargo, including food and rope, onto the ship.','The cargo blew across the sky like a cloud.','Cargo is the goods a vehicle or ship carries.')
  ];
  // Additional fictional practice gives each subject a fuller profile. These
  // examples have no standards mapping until that alignment is reviewed.
  function practice(domain,key,n,title,prompt,answer,retry,hint){
    const id=find(domain,key,n).id;
    samples[id]={title,prompt,answer,retry,hint};
    return id;
  }
  const extraReading=[
    practice('reading','mainidea',0,'Ready to sail','The crew checked the ropes, packed food and repaired the sail. What main idea connects these details?','The crew prepared the ship for its voyage.','The crew had already reached a new island.','Find the purpose shared by all three actions.'),
    practice('reading','structure',2,'A sail in trouble','The wind tore a hole in the sail, so the crew returned to shore. What caused the crew to return?','The wind damaged the sail.','The crew wanted to count the clouds.','Look for the event before the word so.'),
    practice('reading','purpose',1,'Two views of the voyage','Liv calls the voyage exciting. Tor calls it risky because a storm is coming. How do their perspectives differ?','Liv anticipates adventure; Tor is concerned about danger.','Both think there is no reason to sail.','Compare the words exciting and risky.'),
    practice('reading','inference',1,'Sharing the last meal','Liv shares her last loaf with a hungry traveller. Later, the traveller helps repair her boat. What theme do these events suggest?','Kindness can encourage others to help in return.','Keeping everything for yourself always brings help.','Connect Liv’s choice with what the traveller does later.')
  ];
  const extraWriting=[
    practice('writing','opening',0,'Begin a guide','Write a topic sentence for a paragraph about rope checks, food supplies and sail repairs before a voyage.','A safe voyage begins with careful preparation.','My boots are brown.','Introduce the idea that connects the three details.'),
    practice('writing','variety',0,'Vary the rhythm','Combine and vary these sentences: Liv checked the sail. Liv packed her bag. Liv boarded the ship.','After checking the sail and packing her bag, Liv boarded the ship.','Liv checked. Liv packed. Liv boarded.','Try beginning with an introductory phrase.')
  ];
  const extraGrammar=[
    practice('grammar','agreement',0,'The crew’s supplies','Choose the correct verb: The crates ___ beside the ship. (is / are)','are','is','The subject crates is plural.'),
    practice('grammar','modifiers',0,'How Liv moves','In Liv climbed carefully, which word describes how she climbed?','carefully','Liv','An adverb can describe how an action happens.')
  ];
  const extraVocabulary=[
    practice('vocabulary','affixes',0,'A useful prefix','The crew must rebuild the damaged pier. What does re- tell you?','They must build it again.','They must stop building it forever.','The prefix re- often means again.'),
    practice('vocabulary','idioms',0,'An extra pair of hands','Liv asks Tor to lend a hand with the sail. What does lend a hand mean?','Help with the task.','Give away a real hand.','Think about what Liv needs Tor to do.')
  ];
  const profileAxes={
    reading:[...reading,...extraReading].map((id,i)=>({id,label:['Inference','Vocabulary in context','Figurative language','Character analysis','Main idea','Cause and effect','Comparing perspectives','Theme'][i]})),
    writing:[...writing,...extraWriting].map((id,i)=>({id,label:['Transitions','Supporting arguments','Descriptive details','Revision','Topic sentences','Sentence variety'][i]})),
    grammar:[...grammar,...extraGrammar].map((id,i)=>({id,label:['Conjunctions','Perfect tense','Consistent tense','Commas','Subject–verb agreement','Adjectives and adverbs'][i]})),
    vocabulary:[...vocabulary,...extraVocabulary].map((id,i)=>({id,label:['Context clues','Greek and Latin roots','Synonyms and antonyms','Words in use','Prefixes','Idioms'][i]}))
  };
  // These describe the assessed activity, not every sub-skill in its catalogue.
  // Word/form examples marked as used must occur in a correct recorded response.
  const focus=(id,encountered,successful,options={})=>{
    samples[id].focus={encountered,successful,...options};
  };
  focus(reading[0],['Drawing inferences','Supporting ideas with text evidence'],['Inference supported with a text quotation']);
  focus(reading[1],['Context clues','Word meaning in a passage'],['sturdy — strong'],{label:'Recognised successfully'});
  focus(reading[2],['Similes','Interpreting comparisons'],['Explaining the effect of a simile']);
  focus(reading[3],['Character motivation','Comparing characters'],['Explaining different character motives']);
  focus(extraReading[0],['Key details','Identifying a main idea'],['Connecting details to one main idea']);
  focus(extraReading[1],['Identifying causes','Cause-and-effect links'],['Connecting a cause with its effect']);
  focus(extraReading[2],['Comparing perspectives','Different attitudes to events'],['Distinguishing two points of view']);
  focus(extraReading[3],['Identifying themes','Connecting events to a message'],['Inferring a theme from story events']);
  focus(foundation,['Syllable division','Blending multisyllabic words'],['Dividing and blending word parts'],{terms:['transportation']});
  focus(writing[0],['Cause-and-effect transitions','Connecting ideas'],['Linking ideas with a relevant transition'],{terms:['therefore']});
  focus(writing[1],['Supporting an opinion','Relevant reasons and evidence'],['Linking a reason to an opinion']);
  focus(writing[2],['Sensory details','Precise descriptive language'],['Adding concrete sensory detail'],{terms:['salt-sprayed','cold waves']});
  focus(writing[3],['Choosing precise verbs','Revising for effect'],['Strengthening a verb choice'],{terms:['hurried']});
  focus(extraWriting[0],['Topic sentences','Introducing a main idea'],['Connecting a topic sentence to its details']);
  focus(extraWriting[1],['Combining sentences','Introductory phrases'],['Varying sentence structure'],{terms:['After checking']});
  focus(grammar[0],['Subordinating conjunctions','Connecting an action to a reason'],['because'],{label:'Recognised successfully'});
  focus(grammar[1],['Past perfect tense','Sequencing past events'],['Forming the past perfect'],{terms:['had secured']});
  focus(grammar[2],['Simple past tense','Regular past-tense verbs','Consistent tense across clauses'],['Keeping past-tense verbs consistent'],{terms:['carried','checked']});
  focus(grammar[3],['Introductory phrases','Commas after introductions'],['Placing a comma after an introductory phrase']);
  focus(extraGrammar[0],['Plural subjects','Subject–verb agreement'],['Choosing an agreeing verb'],{terms:['are']});
  focus(extraGrammar[1],['Adverbs','Describing how an action happens'],['carefully'],{label:'Recognised successfully'});
  focus(vocabulary[0],['Context clues','Inferring word meaning'],['narrow — not wide'],{label:'Recognised successfully'});
  focus(vocabulary[1],['Latin roots','Inferring meaning from word parts'],['port — carry','transport'],{label:'Recognised successfully'});
  focus(vocabulary[2],['Synonyms','Antonyms'],['strong / sturdy','fragile'],{label:'Recognised successfully'});
  focus(vocabulary[3],['Domain-specific vocabulary','Using words in context'],['Using a word accurately in a sentence'],{terms:['cargo']});
  focus(extraVocabulary[0],['Prefixes','Explaining meaning from an affix'],['re- — again','rebuild'],{label:'Recognised successfully'});
  focus(extraVocabulary[1],['Idioms','Interpreting nonliteral meaning'],['lend a hand — help'],{label:'Recognised successfully'});
  const names=[['alex','Alex Chen',[45,85,60,70]],['maya','Maya Patel',[80,70,90,65]],['leo','Leo Martin',[60,40,60,80]],['sofia','Sofia Kim',[90,75,70,55]],['noah','Noah Wilson',[30,60,50,70]],['ella','Ella Brown',[70,90,35,80]],['finn','Finn Larsen',[65,75,55,80]],['amara','Amara Okafor',[85,60,75,70]],['oliver','Oliver Reed',[50,80,65,60]]];
  const classes=[{id:'5a',name:'Class 5A',studentIds:['alex','maya','leo','sofia','noah','ella']},{id:'5b',name:'Class 5B',studentIds:['finn','amara','oliver']}];
  function records(skillId,score,studentIndex,skillIndex){
    const correctTotal=Math.round(score/5);
    const quota=[-.9,-.3,.3,.9].map(offset=>Math.max(0,Math.min(5,Math.round(correctTotal/4+offset))));
    while(quota.reduce((a,b)=>a+b,0)<correctTotal){for(let w=3;w>=0;w--)if(quota[w]<5){quota[w]++;break;}}
    while(quota.reduce((a,b)=>a+b,0)>correctTotal){for(let w=0;w<4;w++)if(quota[w]>0){quota[w]--;break;}}
    return Array.from({length:20},(_,i)=>{
      const week=Math.floor(i/5)+1,correct=(i%5)<quota[week-1];
      const supported=(i+studentIndex+skillIndex)%4===0||(!correct&&(i+skillIndex)%3===0);
      const hint=supported&&(i+studentIndex)%3!==0;
      const sample=samples[skillId];
      return {id:`${names[studentIndex][0]}:${skillId}:${i+1}`,skillId,week,day:(i%5)+1,correct,supported,hint,response:correct?sample.answer:sample.retry};
    });
  }
  const students=names.map(([id,name,values],index)=>{
    const scores={};reading.forEach((skill,i)=>scores[skill]=values[i]);
    [writing,grammar,vocabulary].forEach((list,d)=>list.forEach((skill,i)=>scores[skill]=Math.max(25,Math.min(95,values[(i+d)%4]+(d-1)*5))));
    [extraReading,extraWriting,extraGrammar,extraVocabulary].forEach((list,d)=>list.forEach((skill,i)=>scores[skill]=Math.max(25,Math.min(95,values[(i+d+1)%4]+(i%2?5:-5)))));
    scores[foundation]=Math.min(95,values[1]);
    const evidence=Object.entries(scores).flatMap(([skill,score],i)=>records(skill,score,index,i));
    return {id,name,index,initials:name.split(' ').map(s=>s[0]).join(''),evidence};
  });
  function summarize(evidence){
    const attempts=evidence.length,correct=evidence.filter(r=>r.correct).length;
    return {attempts,correct,score:attempts?Math.round(correct/attempts*100):null,independent:evidence.filter(r=>!r.supported).length,supported:evidence.filter(r=>r.supported).length,hints:evidence.filter(r=>r.hint).length};
  }
  function skillStats(student,id){return summarize(student.evidence.filter(r=>r.skillId===id));}
  function skillSummary(student,id){
    const records=student.evidence.filter(record=>record.skillId===id);
    if(!records.length)return {encountered:[],successful:[],label:'Successful work'};
    const metadata=samples[id]?.focus,skill=groups.flatMap(group=>group.skills).find(entry=>entry.id===id);
    const encountered=metadata?.encountered||[skill?.name||'Recorded skill'];
    const correct=records.filter(record=>record.correct);
    const normalize=text=>' '+String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()+' ';
    const used=(metadata?.terms||[]).filter(term=>correct.some(record=>normalize(record.response).includes(normalize(term))));
    return {encountered,successful:correct.length?(used.length?used:metadata?.successful||[skill.name]):[],label:used.length?'Used successfully':metadata?.label||'Successful work'};
  }
  function domainStats(student,domain){
    const ids=new Set(groups.filter(group=>group.domain===domain).flatMap(group=>group.skills.map(skill=>skill.id)));
    return summarize(student.evidence.filter(record=>ids.has(record.skillId)));
  }
  function groupStats(student,group){return summarize(student.evidence.filter(r=>group.skills.some(s=>s.id===r.skillId)));}
  const readingLessons=[
    {label:'Inference',model:'Read “The rising tide”. Underline “The water climbed past the lowest step” and explain why Eirik moves the crates.',practice:'Have learners connect a quoted clue to an inference using “I infer … because the text says …”.',check:'Use a new short passage. Ask for an inference and a quoted clue before offering a hint.',intervention:'Underline one useful clue together, then connect it to the inference with “because”.'},
    {label:'Vocabulary in context',model:'Read “Harbour supplies”. Think aloud about why a rope must be sturdy when the wind is rising.',practice:'Replace sturdy with strong, then check whether the meaning still fits the sentence.',check:'Give an unfamiliar word in a new sentence. Ask learners to explain its meaning and point to the clue.',intervention:'Identify the surrounding clue, try a replacement word and check that the sentence still makes sense.'},
    {label:'Figurative language',model:'Read “The wind howled like a hungry wolf.” Identify the comparison and model how howled suggests a loud, fierce wind.',practice:'Have pairs explain the comparison in their own words and point to the words that support their interpretation.',check:'Give a new simile. Ask learners to explain its meaning independently before offering a hint.',intervention:'Contrast the literal picture with the intended meaning, then explain what the comparison tells the reader.'},
    {label:'Character thoughts & motivations',model:'Read “Two ways to help”. Compare Eirik’s “Check every knot first” with Liv’s offer to carry the supplies.',practice:'Use a two-column chart: what each character says or does, and what it reveals about their priorities.',check:'Use new dialogue. Ask learners to compare the characters and cite a detail for each.',intervention:'Connect one action or line of dialogue to each character’s priority before comparing them.'}
  ];
  // Transparent planning rules over existing evidence, with no generated assessment.
  // Missing scores are excluded. Thresholds guide practice; they do not claim mastery.
  function readingPlan(learners,skillIds=reading){
    const practiceThreshold=70,individualThreshold=50;
    const priorities=skillIds.map(id=>{
      const skill=groups.flatMap(g=>g.skills).find(s=>s.id===id);
      if(!skill)return null;
      const lesson=readingLessons[reading.indexOf(id)]||{label:skill.name,model:`Model ${skill.name.toLowerCase()} using a short text.`,practice:samples[id]?.hint||'Guide a response together and ask learners to explain their reasoning.',check:'Use a fresh text to check the same skill before offering an answer-directed hint.',intervention:samples[id]?.hint||'Model one component, guide a response, then check the skill on a fresh text.'};
      const members=learners.map(student=>{
        const evidence=student.evidence.filter(r=>r.skillId===id);
        return {student,stats:summarize(evidence),independent:summarize(evidence.filter(r=>!r.supported)),supported:summarize(evidence.filter(r=>r.supported))};
      }).filter(member=>member.stats.attempts>0);
      return {id,name:skill.name,...lesson,members,belowPractice:members.filter(member=>member.stats.score<practiceThreshold),stats:summarize(members.flatMap(member=>member.student.evidence.filter(r=>r.skillId===id)))};
    }).filter(priority=>priority?.members.length>0).sort((a,b)=>b.belowPractice.length-a.belowPractice.length||a.stats.correct/a.stats.attempts-b.stats.correct/b.stats.attempts);
    const wholeClass=priorities.find(p=>p.members.length>=2&&p.belowPractice.length>=Math.ceil(p.members.length/2))||null;
    const smallGroups=priorities.filter(p=>p.id!==wholeClass?.id&&p.belowPractice.length>=2).slice(0,2);
    const individuals=learners.flatMap(student=>{
      const weakest=priorities.flatMap(priority=>{
        const member=priority.members.find(m=>m.student.id===student.id);
        return member&&member.stats.score<individualThreshold?[{...member,skill:priority}]:[];
      }).sort((a,b)=>a.stats.score-b.stats.score)[0];
      return weakest?[weakest]:[];
    }).sort((a,b)=>a.stats.score-b.stats.score||a.student.name.localeCompare(b.student.name));
    return {wholeClass,smallGroups,individuals,practiceThreshold,individualThreshold};
  }
  return {domains,groups,students,classes,samples,mappings,reading,readingCatalogue,readingContexts,readingSkills,profileAxes,summarize,skillStats,skillSummary,domainStats,groupStats,readingPlan};
})();

export default demo;
