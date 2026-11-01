const {test}=require('node:test');const assert=require('node:assert/strict');
test('class summaries have bold headings and no timestamps, including old timing tables',async()=>{
 const {formatSummaryText}=await import('../dist/summary-format.mjs');
 const result=formatSummaryText('# Teacher review: *Animal Farm*\n\n## Lesson overview\nChapter 9 was read together from approximately **19:16:10–20:24:43**.\nThe class discussed language (19:04:28–19:15:06; 20:14:11–20:24:43).\n\n## Lesson sequence\n| Time | Recorded activity |\n|---|---|\n| **19:00:58–19:04:26** | Language practice. |\n\n## Homework\nAt **20:59:44–21:00:14**, the teacher assigned two pages.');
 assert.match(result,/\*\*Lesson overview\*\*/);assert.match(result,/\*\*Teacher review: Animal Farm\*\*/);assert.match(result,/- Language practice\./);assert.ok(!/\d{1,2}:\d{2}|\| Time|\(\s*\)|from approximately/.test(result));assert.match(result,/The teacher assigned two pages/);
});
