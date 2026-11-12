import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startDevelopment} from './start';
import {generateSheet} from './generate-sheet';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
test('durable queue recovers expired claims, bounds retries and ignores stale worker completion',{timeout:180000},async t=>{
  const image=await generateSheet(),dev=await startDevelopment({apiPort:0,workerEnabled:false});
  const {prisma}=require('../../backend/src/lib/prisma.ts');
  const {OmrQueue}=require('../../backend/src/modules/omr/queue.ts');
  const actor={id:'synthetic-super',role:'SUPER_ADMIN',status:'ACTIVE'};
  const failedQueue=new OmrQueue(prisma,async()=>{throw new Error('Synthetic worker crash');});
  try {
    const bytes=await fs.readFile(image);
    const batch=await failedQueue.upload(actor,'synthetic-omr-exam',bytes,'image/png','web');
    await t.test('worker crash retains a durable job with bounded backoff',async()=>{
      await failedQueue.tick();const value=await prisma.omrScanBatch.findUniqueOrThrow({where:{id:batch.id}});
      assert.equal(value.status,'QUEUED');assert.equal(value.attempts,1);assert.equal(value.errorCode,'FILE_INSPECTION_FAILED');assert.ok(value.nextAttemptAt>new Date());
    });
    await t.test('an expired final lease becomes terminal after a restart',async()=>{
      await prisma.omrScanBatch.update({where:{id:batch.id},data:{status:'PROCESSING',attempts:3,lockedAt:new Date(Date.now()-300000),lockedBy:'crashed-final-claim'}});
      await failedQueue.tick();const value=await prisma.omrScanBatch.findUniqueOrThrow({where:{id:batch.id}});assert.equal(value.status,'FAILED');assert.equal(value.errorCode,'WORKER_LEASE_EXHAUSTED');assert.equal(value.lockedBy,null);
    });
    await t.test('a stale completion cannot overwrite a newer lease owner',async()=>{
      const next=await failedQueue.upload(actor,'synthetic-omr-exam',bytes,'image/png','web');
      let release:()=>void=()=>{},started:()=>void=()=>{};
      const hold=new Promise<void>(resolve=>release=resolve),waiting=new Promise<void>(resolve=>started=resolve);
      const stale=new OmrQueue(prisma,async()=>{started();await hold;return {inspection:{pages:1}};});
      const running=stale.tick();await waiting;
      await prisma.omrScanBatch.update({where:{id:next.id},data:{lockedBy:'new-lease-owner'}});release();await running;
      const value=await prisma.omrScanBatch.findUniqueOrThrow({where:{id:next.id}});assert.equal(value.status,'PROCESSING');assert.equal(value.lockedBy,'new-lease-owner');assert.equal(await prisma.omrScanBatchItem.count({where:{batchId:next.id}}),0);
    });
  } finally {await dev.stop();}
});
