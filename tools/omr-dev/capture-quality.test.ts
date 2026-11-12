import test from 'node:test';
import assert from 'node:assert/strict';
import {captureStill,resolutionGuidance} from '../../src/features/omr/capture-quality';
test('low-resolution messaging captures get explicit QR guidance',()=>{
  assert.match(resolutionGuidance(720,1280),/messaging-app/);assert.match(resolutionGuidance(1920,2560),/QR squares/);
});
test('sensor still is preferred, unsupported or oversized photos fall back safely',async()=>{
  const global=globalThis as any,oldCapture=global.ImageCapture,oldBitmap=global.createImageBitmap;let fallback=0,closed=0;
  const frame=()=>{fallback++;return Promise.resolve(new Blob(['frame'],{type:'image/jpeg'}));};
  try {
    global.createImageBitmap=async()=>({width:3840,height:2880,close:()=>closed++});
    global.ImageCapture=class{async takePhoto(){return new Blob(['sensor'],{type:'image/jpeg'});}};
    assert.equal(await (await captureStill({} as any,frame))?.text(),'sensor');assert.equal(fallback,0);assert.equal(closed,1);
    global.createImageBitmap=async()=>({width:12000,height:9000,close:()=>closed++});
    assert.equal(await (await captureStill({} as any,frame))?.text(),'frame');assert.equal(closed,2);
    global.ImageCapture=class{async takePhoto(){throw Error('Unsupported');}};
    assert.equal(await (await captureStill({} as any,frame))?.text(),'frame');assert.equal(fallback,2);
  }finally{global.ImageCapture=oldCapture;global.createImageBitmap=oldBitmap;}
});
test('a stalled sensor still times out and falls back without hanging retake',async()=>{
  const global=globalThis as any,previous=global.ImageCapture;
  try{
    global.ImageCapture=class{takePhoto(){return new Promise(()=>{});}};
    const frame=new Blob(['fallback'],{type:'image/jpeg'});
    assert.equal(await captureStill({} as any,()=>Promise.resolve(frame),10),frame);
  }finally{global.ImageCapture=previous;}
});
