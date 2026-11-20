const path=require('path');const assert=require('assert');
const {QueueEngineClient}=require('../src/queue/queueEngineClient');
const os=require('os');const fs=require('fs');
const real=path.join(__dirname,'..','..','queue-engine',process.platform==='win32'?'queue_engine.exe':'queue_engine');
const fake=path.join(__dirname,'fake-engine.js');
const hangFlag=path.join(os.tmpdir(),'hang_flag'), garbageFlag=path.join(os.tmpdir(),'garbage_flag');
for(const f of [hangFlag,garbageFlag]) if(fs.existsSync(f)) fs.unlinkSync(f);
const quiet={log(){},error(){},warn(){}};
(async()=>{
  // A. 200 ENQ dong thoi + 2 admin duyet dong thoi
  const ids=Array.from({length:200},(_,i)=>i+1);
  const e=new QueueEngineClient({enginePath:real,getPendingIds:async()=>[],logger:quiet});
  await e.start();
  await Promise.all(ids.map(i=>e.enqueue(i)));
  assert.strictEqual(await e.size(),200);
  const approved=new Set(); const db=new Map(ids.map(i=>[i,'PENDING'])); db.set(3,'CANCELLED'); db.set(4,'CANCELLED');
  const tryApprove=async id=>{ await new Promise(r=>setImmediate(r)); if(db.get(id)==='PENDING'){db.set(id,'APPROVED');return true;} return false;};
  const results=await Promise.all(Array.from({length:100},()=>e.approveNext(tryApprove)));
  results.forEach(r=>{assert(r!==null);assert(!approved.has(r),'trung '+r);approved.add(r);});
  assert(!approved.has(3)&&!approved.has(4));
  assert.deepStrictEqual([...approved].sort((a,b)=>a-b).slice(0,3),[1,2,5]);
  // thu tu FIFO
  const e2=new QueueEngineClient({enginePath:real,getPendingIds:async()=>[],logger:quiet}); await e2.start();
  for(const i of [10,20,30]) await e2.enqueue(i);
  assert.deepStrictEqual([await e2.dequeue(),await e2.dequeue(),await e2.dequeue(),await e2.dequeue()],[10,20,30,null]);
  await e.stop(); await e2.stop();
  console.log('A OK: 200 ENQ + 100 approve dong thoi, khong trung, FIFO dung, bo qua don huy');

  // B. Timeout -> tu khoi phuc
  fs.writeFileSync(hangFlag,'1');
  const h=new QueueEngineClient({enginePath:process.execPath,engineArgs:[fake,'hang'],getPendingIds:async()=>[1,2],timeoutMs:500,logger:quiet});
  await h.start();
  let code; try{await h.size();}catch(err){code=err.code;}
  assert.strictEqual(code,'TIMEOUT');
  fs.unlinkSync(hangFlag);
  assert.strictEqual(await h.size(),0); // da khoi phuc, Engine moi tra loi
  await h.stop(); console.log('B OK: treo -> TIMEOUT -> tu khoi phuc');

  // C. Phan hoi la
  fs.writeFileSync(garbageFlag,'1');
  const g=new QueueEngineClient({enginePath:process.execPath,engineArgs:[fake,'garbage'],getPendingIds:async()=>[],logger:quiet});
  await g.start();
  code=null; try{await g.size();}catch(err){code=err.code;}
  assert.strictEqual(code,'BAD_RESPONSE');
  fs.unlinkSync(garbageFlag);
  assert.strictEqual(await g.size(),0);
  await g.stop(); console.log('C OK: phan hoi la -> BAD_RESPONSE -> tu khoi phuc');

  // D. Engine khong ton tai -> RECOVERY_FAILED
  const bad=new QueueEngineClient({enginePath:'/khong/ton/tai',getPendingIds:async()=>[],maxRecoveryAttempts:2,logger:quiet});
  code=null; try{await bad.start();}catch(err){code=err.code;}
  assert.strictEqual(code,'RECOVERY_FAILED'); console.log('D OK: sai duong dan -> RECOVERY_FAILED');

  // E. id sai chan o phia Node
  const e3=new QueueEngineClient({enginePath:real,getPendingIds:async()=>[],logger:quiet}); await e3.start();
  for(const bad of [0,-1,'abc',1.5,2147483648,null]){ code=null; try{await e3.enqueue(bad);}catch(err){code=err.code;} assert.strictEqual(code,'BAD_ID',String(bad)); }
  assert.strictEqual(await e3.size(),0); await e3.stop(); console.log('E OK: id sai bi chan');
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
