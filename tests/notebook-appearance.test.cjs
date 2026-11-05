const {test}=require('node:test');const assert=require('node:assert/strict');
test('theme-aware ink preserves saved and copied colours, including explicit colours on highlights',async()=>{
 const {TextFormat}=await import('../src/text-format.mjs');const attributes=TextFormat.config.addAttributes();
 const saved={color:'#243556',backgroundColor:null};const display=attributes.color.renderHTML(saved);
 assert.match(display.style,/var\(--notebook-auto-ink/);assert.equal(display['data-text-color'],'#243556');assert.deepEqual(saved,{color:'#243556',backgroundColor:null});
 const copied={style:{color:'var(--notebook-auto-ink, #243556)'},getAttribute:key=>key==='data-text-color'?display[key]:null};assert.equal(attributes.color.parseHTML(copied),'#243556');
 assert.equal(attributes.color.renderHTML({color:'#ff0000'}).style,'color: #ff0000');
 assert.equal(attributes.color.renderHTML({color:'#243556',backgroundColor:'#fff176'}).style,'color: #243556');
 assert.match(attributes.backgroundColor.renderHTML({backgroundColor:'#fff176'}).style,/color: #172b49/);
});
