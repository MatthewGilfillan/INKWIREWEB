const {test}=require('node:test');
const assert=require('node:assert/strict');
const page={assetId:'11111111-1111-4111-8111-111111111111',page:0,x:100,y:100,width:600,height:800,originalWidth:600,originalHeight:800,background:false};
test('PDF corners preserve original aspect ratio and the opposite corner',async()=>{
 const {resizePrintout}=await import('../src/printout-geometry.mjs');
 for(const edge of ['nw','ne','se','sw']){
  const changed=resizePrintout(page,edge,30,40);
  assert.ok(Math.abs(changed.width/changed.height-.75)<1e-10);
  if(edge.includes('w'))assert.equal(changed.x+changed.width,700);else assert.equal(changed.x,100);
  if(edge.includes('n'))assert.equal(changed.y+changed.height,900);else assert.equal(changed.y,100);
 }
});
test('PDF edges stretch only the requested dimension and cannot cross the canvas origin',async()=>{
 const {resizePrintout}=await import('../src/printout-geometry.mjs');const {cleanPrintout}=await import('../src/printout-node.mjs');
 assert.equal(resizePrintout(page,'e',100,70).height,800);assert.equal(resizePrintout(page,'s',90,100).width,600);
 for(const edge of ['nw','n','ne','e','se','s','sw','w'])for(const delta of [-10000,10000]){const changed=resizePrintout(page,edge,delta,delta);assert.doesNotThrow(()=>cleanPrintout(changed));assert.ok(changed.x>=0&&changed.y>=0);}
});
test('whole PDF scale and restore apply to all pages while preserving the document anchor',async()=>{
 const {scalePrintoutDocument,restorePrintoutDocument}=await import('../src/printout-geometry.mjs');const pages=[page,{...page,page:1,y:924}];
 const scaled=scalePrintoutDocument(pages,.5);assert.deepEqual(scaled.map(p=>[p.x,p.y,p.width,p.height]),[[100,100,300,400],[100,512,300,400]]);
 const restored=restorePrintoutDocument(scaled);assert.deepEqual(restored.map(p=>[p.x,p.y,p.width,p.height]),[[100,100,600,800],[100,924,600,800]]);
});
