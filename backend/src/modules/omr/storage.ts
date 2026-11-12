import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { r2Storage } from '../../lib/r2Storage';
import { omrError } from './access';
export const MAX_UPLOAD=20*1024*1024;
export function fileType(bytes:Buffer) {
  if(!bytes.length || bytes.length>MAX_UPLOAD) throw omrError(413,'OMR upload exceeds the 20 MB limit');
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return {extension:'png',mime:'image/png'};
  if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return {extension:'jpg',mime:'image/jpeg'};
  if(bytes.subarray(0,5).toString()==='%PDF-') return {extension:'pdf',mime:'application/pdf'};
  throw omrError(415,'Only actual PNG, JPEG and PDF files are accepted');
}
const localRoot=()=>path.resolve(process.env.OMR_PRIVATE_DIR||path.join(__dirname,'../../../uploads/omr-private'));
function safeKey(key:string) {
  if(!/^omr\/[a-f0-9-]{36}\.(png|jpg|pdf)$/.test(key)) throw omrError(400,'Invalid private scan reference');
  return key;
}
export async function storePrivate(bytes:Buffer) {
  const type=fileType(bytes), key=`omr/${randomUUID()}.${type.extension}`;
  if(r2Storage.configured) {
    const result=await r2Storage.uploadFile('student-documents',key,bytes,type.mime);
    if(result.error) throw omrError(502,'Private scan storage failed');
  } else {
    if(process.env.NODE_ENV==='production') throw omrError(503,'Private scan storage is not configured');
    const root=localRoot(); await fs.mkdir(path.join(root,'omr'),{recursive:true,mode:0o700});
    await fs.writeFile(path.join(root,key),bytes,{mode:0o600,flag:'wx'});
  }
  return key;
}
export async function readPrivate(key:string) {
  safeKey(key);
  if(r2Storage.configured) {
    const bytes=await r2Storage.downloadFile('student-documents',key);
    if(!bytes || bytes.length>MAX_UPLOAD) throw omrError(404,'Private scan is unavailable');
    return bytes;
  }
  if(process.env.NODE_ENV==='production') throw omrError(503,'Private scan storage is not configured');
  const target=path.join(localRoot(),key), stat=await fs.lstat(target);
  if(!stat.isFile() || stat.isSymbolicLink() || stat.size>MAX_UPLOAD) throw omrError(404,'Private scan is unavailable');
  return fs.readFile(target);
}
