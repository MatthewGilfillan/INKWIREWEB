export function formatSummaryText(text) {
  const time = '\\d{1,2}:\\d{2}(?::\\d{2})?';
  const range = `${time}(?:\\s*[–—-]\\s*${time})?`;
  const stamp = new RegExp(`\\*{0,2}\\b${range}\\b\\*{0,2}`, 'g');
  return String(text).split('\n').flatMap(line => {
    if (/^\s*\|/.test(line)) {
      const cells = line.trim().split('|').slice(1,-1).map(cell=>cell.trim());
      if (cells.every(cell=>/^[-:\s]+$/.test(cell)) || /^(time|timestamp)$/i.test(cells[0])) return [];
      if (new RegExp(time).test(cells[0])) line = '- ' + cells.slice(1).join(' · ');
    }
    line = line.replace(new RegExp(`\\b(?:from approximately|at)\\s+(?=\\*{0,2}${time})`, 'gi'), '').replace(stamp, '')
      .replace(/\([\s;,–—-]*\)/g,'').replace(/\*\*\s*\*\*/g,'').replace(/\s+([,.;:])/g,'$1').replace(/^,\s*/,'').replace(/ {2,}/g,' ').trimEnd();
    if (/^#{1,6}\s+/.test(line)) line='**'+line.replace(/^#{1,6}\s+/,'').replace(/\*/g,'').trim()+'**';
    if (/^[a-z]/.test(line)) line=line[0].toUpperCase()+line.slice(1);
    return [line];
  }).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

export function renderSummary(container, text) {
  container.replaceChildren();
  const appendInline=(element,value)=>{
    const pattern=/\*\*([^*]+)\*\*|\*([^*]+)\*/g;let cursor=0;
    for(const match of value.matchAll(pattern)){
      element.append(document.createTextNode(value.slice(cursor,match.index)));
      const emphasis=document.createElement(match[1]?'strong':'em');emphasis.textContent=match[1] || match[2];element.append(emphasis);cursor=match.index+match[0].length;
    }
    element.append(document.createTextNode(value.slice(cursor)));
  };
  for(const line of text.split('\n')){
    if(!line.trim())continue;
    const heading=line.match(/^\*\*(.+)\*\*$/);
    const element=document.createElement(heading?'h4':'p');
    if(heading)element.textContent=heading[1];else appendInline(element,line.replace(/^- /,'• '));
    container.append(element);
  }
}
