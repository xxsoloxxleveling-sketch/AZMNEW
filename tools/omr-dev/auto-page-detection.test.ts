import test from 'node:test';
import assert from 'node:assert/strict';
import {detectPage,nextStability,AUTO_CAPTURE_HOLD_MS,cornerMovement,Quad} from '../../src/features/omr/page-detection';
const inside=(px:number,py:number,quad:Quad)=>{
 let result=false;for(let i=0,j=quad.length-1;i<quad.length;j=i++){
  const a=quad[i],b=quad[j];if((a.y>py)!==(b.y>py)&&px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x)result=!result;
 }return result;
};
function sheet(w=180,h=240,opts:{shift?:number;cropped?:boolean;uniform?:boolean;noise?:boolean}={}){
 const data=new Uint8ClampedArray(w*h*4);
 const shift=opts.shift||0;
 const points:Quad=opts.cropped?[{x:-1,y:10},{x:w-5,y:14},{x:w-5,y:h-10},{x:-1,y:h-8}]:[{x:29+shift,y:19},{x:149+shift,y:24},{x:151+shift,y:216},{x:26+shift,y:210}];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const frame=opts.uniform?128:inside(x,y,points)?236:35;
  const bubbles=!opts.uniform&&inside(x,y,points)&&y>44&&y<192&&((x+7)%25)<2&&((y+3)%16)<2;
  let v=bubbles?50:frame;
  if(opts.noise&&((x*153+y*17)%109===0))v=Math.max(0,v-60);
  const i=4*(y*w+x);data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
 }
 return {data,width:w,height:h,colorSpace:'srgb'} as ImageData;
}
test('CamScanner-style detector finds stable 4 page corners on contrasting background',()=>{
 const frame=sheet(),found=detectPage(frame);
 assert.equal(found.reason,'found');
 assert.ok(found.corners);
 assert.ok(found.areaFraction>.3&&found.areaFraction<.75);
 assert.ok(found.contrast>80);
 const [tl,tr,br,bl]=found.corners!;
 assert.ok(tl.x<.25&&tl.y<.2);
 assert.ok(tr.x>.7&&tr.y<.2);
 assert.ok(br.x>.7&&br.y>.8);
 assert.ok(bl.x<.25&&bl.y>.8);
 let state=null;
 for(let ms=0;ms<=1400;ms+=350)state=nextStability(state,found,ms);
 assert.ok(state!.ready,'page should be ready only after the hold interval');
});
test('rejects partial pages, uniform surfaces and unsupported shapes',()=>{
 assert.notEqual(detectPage(sheet(180,240,{cropped:true})).reason,'found');
 assert.equal(detectPage(sheet(180,240,{uniform:true})).reason,'low-contrast');
 const empty=new Uint8ClampedArray(180*240*4);for(let i=3;i<empty.length;i+=4)empty[i]=255;
 assert.notEqual(detectPage({data:empty,width:180,height:240} as ImageData).reason,'found');
});
test('moving pages reset lock and cannot auto capture immediately',()=>{
 const a=detectPage(sheet()),b=detectPage(sheet(180,240,{shift:18}));
 assert.ok(a.corners&&b.corners);
 assert.ok(cornerMovement(a.corners!,b.corners!)>.027);
 let state=nextStability(null,a,0);
 state=nextStability(state,a,350);
 state=nextStability(state,b,700);
 assert.equal(state.ready,false);
 assert.equal(state.count,1);
 state=nextStability(state,b,800);
 assert.equal(state.ready,false);
});
test('automatic capture never fires from one detection alone',()=>{
 const observation=detectPage(sheet(180,240,{noise:true}));
 assert.equal(observation.reason,'found');
 const first=nextStability(null,observation,0);
 assert.equal(first.ready,false);
 const second=nextStability(first,observation,AUTO_CAPTURE_HOLD_MS+100);
 assert.equal(second.ready,false,'minimum distinct camera frames are mandatory');
});
