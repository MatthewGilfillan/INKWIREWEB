const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function cleanLiveBoardReference(value={}){
 const keys=['classId','boardId','snapshotId','title','x','y','width','height'];
 if(!value||typeof value!=='object'||Object.keys(value).some(key=>!keys.includes(key))||!ID.test(value.classId||'')||!ID.test(value.boardId||'')||value.snapshotId&&!ID.test(value.snapshotId)||typeof value.title!=='string'||!value.title.trim()||value.title.length>120)throw Error('Invalid Live Board reference.');
 for(const [key,min,max]of [['x',0,10000],['y',0,200000],['width',320,1800],['height',340,1800]])if(!Number.isFinite(value[key])||value[key]<min||value[key]>max)throw Error('Invalid Live Board position or size.');
 return {...Object.fromEntries(keys.map(key=>[key,value[key]])),snapshotId:value.snapshotId||'',title:value.title.trim()};
}
