// Shared prompt definitions: the response type travels with the post's section.
export const readingResponses = [
 {id:'question',label:'My question',hint:'What are you wondering about?',evidence:'What in the text sparked your question?',reasoning:'Why is this question worth exploring?'},
 {id:'connection',label:'Connection to our lives',hint:'How does this text connect to life or the world around us?',evidence:'Evidence — summarize a detail or add a quote',reasoning:'Explain how the connection helps you understand the text.'},
 {id:'revisit',label:'Evidence worth revisiting',hint:'Which detail or quotation deserves another look?',evidence:'Evidence — summarize the text or add a quote',reasoning:'Why does this evidence matter?'},
 {id:'prediction',label:'My prediction',hint:'What do you think will happen next?',evidence:'Which clues support your prediction?',reasoning:'Explain how those clues support your prediction.'},
 {id:'inference',label:'Reading between the lines',hint:'What can you infer that the author does not state directly?',evidence:'Evidence — summarize the text or add a quote',reasoning:'Explain how the evidence supports your inference.'},
 {id:'character',label:'Character’s thoughts, feelings, and motivations',hint:'What is a character thinking or feeling, and what motivates them?',evidence:'Evidence — summarize the text or add a quote',reasoning:'Explain what the evidence reveals about the character.'},
 {id:'theme',label:'A theme or message',hint:'What idea or message is developing?',evidence:'Which moments or details support your thinking?',reasoning:'Explain how the evidence develops this idea.'},
 {id:'craft',label:'The author’s choices',hint:'Notice a word, image, structure, or point of view the author chose.',evidence:'Evidence — summarize the text or add a quote',reasoning:'What effect does this choice have on the reader?'},
 {id:'changed',label:'My thinking changed',hint:'I used to think… Now I think…',evidence:'What in the text changed your thinking?',reasoning:'Explain how your understanding developed.'},
];
export const readingResponse = id => readingResponses.find(row => row.id === id) || readingResponses[0];

// Present older separately stored references inside the evidence, without discarding them.
export function readingEvidence(evidence="",reference=""){return [evidence,reference.trim()?"Page / source: "+reference.trim():""].filter(Boolean).join("\n\n");}
