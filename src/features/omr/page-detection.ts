/** Local preview-only page detector; the backend remains the authoritative OMR validator. */
export type Point={x:number;y:number};
export type Quad=[Point,Point,Point,Point];
export interface PageDetection {corners:Quad|null;reason:'found'|'page-not-found'|'move-back'|'low-contrast'|'too-small'|'bad-geometry';areaFraction:number;contrast:number;focus:number}
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const area=(q:Quad)=>Math.abs(q.reduce((sum,p,i)=>{const next=q[(i+1)%4];return sum+p.x*next.y-p.y*next.x;},0)/2);
export const AUTO_CAPTURE_HOLD_MS=1250;
export const AUTO_CAPTURE_MIN_READINGS=4;
export const AUTO_CAPTURE_STABILITY=.027;
export function cornerMovement(previous:Quad,current:Quad):number{return Math.max(...previous.map((p,i)=>dist(p,current[i])));}
export function detectPage(frame:ImageData):PageDetection {
 const {width:w,height:h,data}=frame;
 const bad=(reason:PageDetection['reason'],contrast=0,focus=0,areaFraction=0):PageDetection=>({corners:null,reason,contrast,focus,areaFraction});
 if(w<100||h<100||data.length!==w*h*4)return bad('too-small');
 const len=w*h,gray=new Uint8Array(len),hist=new Uint32Array(256);let total=0;
 for(let i=0;i<len;i++){const p=i*4,v=Math.round(.299*data[p]+.587*data[p+1]+.114*data[p+2]);gray[i]=v;hist[v]++;total+=v;}
 let weight=0,part=0,best=0,threshold=0;
 for(let t=0;t<256;t++){weight+=hist[t];if(!weight)continue;const rest=len-weight;if(!rest)break;part+=t*hist[t];const delta=part/weight-(total-part)/rest;const metric=weight*rest*delta*delta;if(metric>best){best=metric;threshold=t;}}
 if(!best)return bad('low-contrast');
 const cutoff=threshold+18,mask=new Uint8Array(len);let lightTotal=0,lightCount=0,darkTotal=0,darkCount=0;
 for(let i=0;i<len;i++){const v=gray[i];if(v>cutoff){mask[i]=1;lightTotal+=v;lightCount++;}else{darkTotal+=v;darkCount++;}}
 const contrast=lightCount&&darkCount?lightTotal/lightCount-darkTotal/darkCount:0;
 if(contrast<30||lightCount/len<.13||lightCount/len>.87)return bad('low-contrast',contrast);
 const visited=new Uint8Array(len),queue=new Int32Array(len);
 let selected:Quad|null=null,selectedCount=0,selectedMargin=1,selectedFocus=0;
 const minCount=Math.ceil(len*.14);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const start=y*w+x;if(!mask[start]||visited[start])continue;
  let front=0,end=1;queue[0]=start;visited[start]=1;
  let tl=1e9,tr=-1e9,br=-1e9,bl=1e9,ptl:Point={x:0,y:0},ptr:Point={x:0,y:0},pbr:Point={x:0,y:0},pbl:Point={x:0,y:0};
  let perimeter=0,edgeScore=0;
  while(front<end){
   const idx=queue[front++],px=idx%w,py=Math.floor(idx/w),sum=px+py,difference=px-py;
   if(sum<tl){tl=sum;ptl={x:px,y:py};}if(difference>tr){tr=difference;ptr={x:px,y:py};}
   if(sum>br){br=sum;pbr={x:px,y:py};}if(difference<bl){bl=difference;pbl={x:px,y:py};}
   if(px>0){if(mask[idx-1]){if(!visited[idx-1]){visited[idx-1]=1;queue[end++]=idx-1;}}else{perimeter++;edgeScore+=Math.abs(gray[idx]-gray[idx-1]);}}
   if(px<w-1){if(mask[idx+1]){if(!visited[idx+1]){visited[idx+1]=1;queue[end++]=idx+1;}}else{perimeter++;edgeScore+=Math.abs(gray[idx]-gray[idx+1]);}}
   if(py>0){if(mask[idx-w]){if(!visited[idx-w]){visited[idx-w]=1;queue[end++]=idx-w;}}else{perimeter++;edgeScore+=Math.abs(gray[idx]-gray[idx-w]);}}
   if(py<h-1){if(mask[idx+w]){if(!visited[idx+w]){visited[idx+w]=1;queue[end++]=idx+w;}}else{perimeter++;edgeScore+=Math.abs(gray[idx]-gray[idx+w]);}}
  }
  if(end<minCount||end<=selectedCount)continue;
  const pts:Quad=[ptl,ptr,pbr,pbl];
  selectedCount=end;selected=pts;selectedMargin=Math.min(...pts.map(p=>Math.min(p.x/w,p.y/h,1-p.x/w,1-p.y/h)));
  selectedFocus=perimeter?edgeScore/perimeter:0;
 }
 if(!selected)return bad('page-not-found',contrast);
 const fraction=area(selected)/len;
 if(selectedMargin<.04)return bad('move-back',contrast,selectedFocus,fraction);
 if(fraction<.18||fraction>.83)return bad('bad-geometry',contrast,selectedFocus,fraction);
 const [tl,tr,br,bl]=selected;
 const top=dist(tl,tr),bottom=dist(bl,br),left=dist(tl,bl),right=dist(tr,br);
 const ratio=Math.max((top+bottom)/(left+right),(left+right)/(top+bottom));
 if(Math.abs(top-bottom)/Math.max(top,bottom)>.55||Math.abs(left-right)/Math.max(left,right)>.55||ratio<1.13||ratio>1.95||dist(tl,br)<Math.min(w,h)*.35||dist(tr,bl)<Math.min(w,h)*.35)return bad('bad-geometry',contrast,selectedFocus,fraction);
 return {corners:selected.map(p=>({x:p.x/(w-1),y:p.y/(h-1)})) as Quad,reason:'found',areaFraction:fraction,contrast,focus:selectedFocus};
}
export interface Stability {corners:Quad|null;startedAt:number;count:number;ready:boolean;message:string}
export function nextStability(previous:Stability|null,observation:PageDetection,now:number):Stability {
 if(!observation.corners){
  const guidance:Record<string,string>={'page-not-found':'Place the sheet on a dark, contrasting surface','low-contrast':'Use a darker background with even lighting','move-back':'Move back and show all page edges','too-small':'Camera preview resolution is too small','bad-geometry':'Straighten the paper and keep all corners visible'};
  return {corners:null,startedAt:now,count:0,ready:false,message:guidance[observation.reason]||'Find the page'};
 }
 const corners=observation.corners;
 if(!previous?.corners||cornerMovement(previous.corners,corners)>AUTO_CAPTURE_STABILITY)return {corners,startedAt:now,count:1,ready:false,message:'Page found — hold steady'};
 const count=previous.count+1,elapsed=now-previous.startedAt;
 const ready=count>=AUTO_CAPTURE_MIN_READINGS&&elapsed>=AUTO_CAPTURE_HOLD_MS;
 return {corners,startedAt:previous.startedAt,count,ready,message:ready?'Ready — capturing automatically':'Hold steady · '+(Math.max(0,Math.ceil((AUTO_CAPTURE_HOLD_MS-elapsed)/100)/10)).toFixed(1)+'s'};
}
