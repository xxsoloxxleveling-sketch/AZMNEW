import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeCapture,CAMERA_UPLOAD_TARGET,mobileImageQuality,inspectOmrImage} from '../../src/features/omr/capture-quality';

const payload=(bytes:number,type='image/jpeg')=>new Blob([new Uint8Array(bytes)],{type});
function mockCanvas(width:number,height:number,encode:(quality:number)=>number|null) {
  const global=globalThis as any,previous={document:global.document,bitmap:global.createImageBitmap};
  let closed=0,drawn=0,canvas:any;
  global.createImageBitmap=async()=>({width,height,close:()=>{closed++;}});
  global.document={createElement:(name:string)=>{
    assert.equal(name,'canvas');
    canvas={width:0,height:0,getContext:()=>({fillStyle:'',fillRect(){},drawImage(){drawn++;},imageSmoothingEnabled:false,imageSmoothingQuality:''}),
      toBlob:(callback:(value:Blob|null)=>void,_type:string,quality:number)=>{
        const bytes=encode(quality);callback(bytes===null?null:payload(bytes));
      }};
    return canvas;
  }};
  return {restore(){global.document=previous.document;global.createImageBitmap=previous.bitmap;},stats:()=>({closed,drawn,width:canvas?.width,height:canvas?.height})};
}

test('8-10 MB camera JPEG is compressed while keeping 12 MP image pixels',async()=>{
  const fixture=mockCanvas(4000,3000,q=>Math.round((q-.5)*5*1024*1024));
  try {
    const result=await optimizeCapture(payload(9*1024*1024));
    assert.equal(result.changed,true);
    assert.equal(result.inputWidth,4000);
    assert.equal(result.outputWidth,4000);
    assert.equal(result.outputHeight,3000);
    assert.equal(result.quality,.90);
    assert.ok(result.outputBytes<=CAMERA_UPLOAD_TARGET);
    assert.ok(result.outputBytes<result.inputBytes/2);
    assert.deepEqual(fixture.stats(),{closed:1,drawn:1,width:0,height:0});
  }finally{fixture.restore();}
});
test('20 MP photo is resized to within 12 MP while preserving readable dimensions',async()=>{
  const fixture=mockCanvas(5000,4000,()=>2*1024*1024);
  try{
    const result=await optimizeCapture(payload(10*1024*1024));
    assert.equal(result.changed,true);
    assert.ok(result.outputWidth!*result.outputHeight!<=12_000_000+8000);
    assert.ok(Math.min(result.outputWidth!,result.outputHeight!)>=1800);
    assert.equal(result.blob.type,'image/jpeg');
  }finally{fixture.restore();}
});
test('low-resolution QR source is never recompressed',async()=>{
  const fixture=mockCanvas(720,1280,()=>1024);
  const original=payload(6*1024*1024);
  try{
    const result=await optimizeCapture(original);
    assert.equal(result.changed,false);
    assert.equal(result.blob,original);
    assert.equal(result.outputWidth,720);
  }finally{fixture.restore();}
});
test('small existing images are passed unchanged without opening image decoder',async()=>{
  const global=globalThis as any,prev=global.createImageBitmap;
  global.createImageBitmap=()=>{throw Error('should not decode small files');};
  const source=payload(2*1024*1024);
  try{assert.equal((await optimizeCapture(source)).blob,source);}finally{global.createImageBitmap=prev;}
});
test('failed encoder keeps the source and returns no false compression success',async()=>{
  const fixture=mockCanvas(4000,3000,()=>null);
  const source=payload(9*1024*1024);
  try{const result=await optimizeCapture(source);assert.equal(result.changed,false);assert.equal(result.blob,source);assert.equal(result.quality,null);}finally{fixture.restore();}
});
test('a larger recompressed result cannot replace the source',async()=>{
  const fixture=mockCanvas(4000,3000,()=>11*1024*1024);
  const source=payload(9*1024*1024);
  try{const result=await optimizeCapture(source);assert.equal(result.changed,false);assert.equal(result.blob,source);}finally{fixture.restore();}
});
test('ambiguous nonimage payloads are never converted',async()=>{
  const source=payload(10*1024*1024,'application/pdf');
  const result=await optimizeCapture(source);
  assert.equal(result.blob,source);assert.equal(result.changed,false);
});

test('mobile scan preflight rejects the actual 720x1280 upload but allows 12MP camera stills',()=>{
  assert.match(mobileImageQuality(720,1280)!,/too small/);
  assert.match(mobileImageQuality(1280,720)!,/too small/);
  assert.equal(mobileImageQuality(1600,2000),null);
  assert.equal(mobileImageQuality(2880,3840),null);
  assert.match(mobileImageQuality(6000,4000)!,/over 20 MP/);
  assert.match(mobileImageQuality(0,4000)!,/could not be verified/);
});

test('mobile image inspection checks decoded pixels even for tiny compressed files',async()=>{
  const fixture=mockCanvas(720,1280,()=>1000);
  try{
    const quality=await inspectOmrImage(payload(147903));
    assert.equal(quality.width,720);
    assert.equal(quality.height,1280);
    assert.match(quality.problem!,/too small/);
    assert.equal(fixture.stats().closed,1);
  }finally{fixture.restore();}
});

test('mobile image inspection keeps good high-resolution originals eligible',async()=>{
  const fixture=mockCanvas(2880,3840,()=>1024);
  try{
    const quality=await inspectOmrImage(payload(3*1024*1024));
    assert.equal(quality.problem,null);
    assert.equal(quality.width*quality.height,11059200);
    assert.equal(fixture.stats().closed,1);
  }finally{fixture.restore();}
});
