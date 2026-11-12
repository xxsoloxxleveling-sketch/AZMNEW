import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SavedScan {
  id:string;
  uri:string;
  width:number;
  height:number;
  bytes:number;
  createdAt:number;
}
interface NativeScanner {
  scan(options:{pageLimit:number}):Promise<{cancelled:boolean;pages:SavedScan[]}>;
  listScans():Promise<{pages:SavedScan[]}>;
  deleteScan(options:{id:string}):Promise<void>;
}
const native=registerPlugin<NativeScanner>('AzmNativeScanner');
export function scannerIsNative():boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform()==='android';
}
function check(page:SavedScan):SavedScan {
  if(!/^scan-[A-Za-z0-9-]+\.jpg$/.test(page.id))throw Error('Invalid native scan reference');
  if(!page.uri.startsWith('file://')||!page.uri.includes('/scanner-test-images/'))throw Error('Saved scan has an unexpected location');
  if(!Number.isSafeInteger(page.width)||!Number.isSafeInteger(page.height)||page.width<1||page.height<1)throw Error('Saved scan has invalid dimensions');
  if(!Number.isSafeInteger(page.bytes)||page.bytes<1024||page.bytes>20*1024*1024)throw Error('Saved scan has an invalid size');
  return page;
}
export async function listTesterScans():Promise<SavedScan[]> {
  if(!scannerIsNative())return [];
  const results=await native.listScans();
  return results.pages.map(check);
}
export async function captureTesterScans(pageLimit=10):Promise<{cancelled:boolean;pages:SavedScan[]}> {
  if(!scannerIsNative())throw Error('Automatic document capture requires the Android tablet app');
  const result=await native.scan({pageLimit});
  return {cancelled:result.cancelled,pages:result.pages.map(check)};
}
export async function removeTesterScan(page:SavedScan):Promise<void> {
  if(!scannerIsNative())throw Error('Only private Android scans can be removed this way');
  await native.deleteScan({id:check(page).id});
}
export function previewScanUrl(page:SavedScan):string {
  return Capacitor.convertFileSrc(check(page).uri);
}
export async function readTesterScan(page:SavedScan):Promise<File> {
  const response=await fetch(previewScanUrl(page),{cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('Could not open private scan for upload. The saved image has not been deleted.');
  const blob=await response.blob();
  if(blob.size!==page.bytes)throw Error('Private scan size changed; upload blocked');
  return new File([blob],page.id,{type:'image/jpeg',lastModified:page.createdAt});
}
