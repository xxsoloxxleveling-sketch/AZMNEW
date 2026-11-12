import { omrQueue } from './queue';
import { prisma } from '../../lib/prisma';
import { assertRestrictedRuntimeDatabase } from '../../security/dbRuntimeSafety';
let stopping=false;
process.on('SIGTERM',()=>{stopping=true;}); process.on('SIGINT',()=>{stopping=true;});
async function main() {
  if(process.env.NODE_ENV==='production') await assertRestrictedRuntimeDatabase(prisma,{databaseUrl:process.env.DATABASE_URL||'',directUrl:process.env.DIRECT_URL||''});
  while(!stopping) {
    try { if(await omrQueue.tick()) continue; }
    catch { console.error('OMR worker iteration failed; durable jobs retained for retry'); }
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  await prisma.$disconnect();
}
main().catch(()=>{console.error('OMR worker startup failed');process.exitCode=1;});
