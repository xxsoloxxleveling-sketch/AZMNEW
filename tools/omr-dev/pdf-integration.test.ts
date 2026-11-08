import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {startDevelopment} from './start';
import {generateSheet} from './generate-sheet';

test('untrusted two-page PDF traverses the real API and isolated renderer', {timeout:180000,skip:process.platform!=='linux'?'Untrusted PDF isolation requires Linux bubblewrap; never bypassed locally':false},async()=>{
  assert.notEqual(process.env.OMR_TRUSTED_PDF_FIXTURE,'1','The integration test must not bypass isolation');
  const source=await generateSheet('synthetic-two-pages.pdf',{pdfPages:2});
  const development=await startDevelopment({apiPort:0,workerEnabled:false});
  try {
    const auth=await fetch(development.url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@omr.test',password:'Synthetic-Omr-Only-2026!'})});
    assert.equal(auth.status,200);const token=(await auth.json()).data.accessToken;
    const headers={Authorization:`Bearer ${token}`};
    const uploaded=await fetch(development.url+'/api/omr/exams/synthetic-omr-exam/batches',{method:'POST',headers:{...headers,'Content-Type':'application/pdf'},body:await fs.readFile(source)});
    assert.equal(uploaded.status,202);const id=(await uploaded.json()).data.id;
    for(let turn=0;turn<5;turn++)await development.tick();
    const batch=(await (await fetch(development.url+`/api/omr/batches/${id}`,{headers})).json()).data;
    assert.equal(batch.status,'COMPLETE',JSON.stringify({status:batch.status,error:batch.errorCode}));
    assert.equal(batch.items.length,2);assert.deepEqual(batch.items.map((item:any)=>item.pageIndex),[1,2]);
    assert.notEqual(batch.items[0].scan.id,batch.items[1].scan.id);
    for(const item of batch.items) {
      const response=await fetch(development.url+`/api/omr/scans/${item.scan.id}`,{headers});assert.equal(response.status,200);
      const scan=(await response.json()).data;
      assert.ok(['REVIEW_REQUIRED','RECOGNIZED'].includes(scan.status),`Unexpected PDF recognition status ${scan.status}`);
      assert.equal(scan.paperVersion,'A');assert.equal(scan.responses.length,100);
      assert.deepEqual(scan.responses.map((row:any)=>row.detectedAnswer),Array(100).fill('A'));
      const annotation=await fetch(development.url+`/api/omr/scans/${item.scan.id}/image?kind=annotation`,{headers});assert.equal(annotation.status,200);assert.match(annotation.headers.get('cache-control')||'',/no-store/);
    }
    const stats=(await (await fetch(development.url+'/api/omr/exams/synthetic-omr-exam/stats',{headers})).json()).data;
    assert.equal(stats.officialRecognitionEnabled,false);
  } finally {await development.stop();}
});
