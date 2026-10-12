import assert from 'node:assert/strict';
process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1:1/fixture';
process.env.NODE_ENV = 'test';
async function run() {
  const {resetScopeSchema,resetConfirmSchema,resetHistorySchema,sessionQuerySchema}=await import('../src/modules/attendance/attendance.schema');
  let passed=0;
  const check=(label:string,work:()=>void)=>{work();passed++;console.log('PASS: '+label);};
  const scope={mode:'HALL',businessDate:'2026-10-10',sessionIds:['one']};
  check('valid scope requires exact explicit Hall and date',()=>assert(resetScopeSchema.safeParse(scope).success));
  check('invalid date, duplicates, empty scope and unknown fields reject',()=>{for(const value of [{...scope,businessDate:'2026-02-30'},{...scope,sessionIds:['one','one']},{...scope,sessionIds:[]},{...scope,sessionIds:['one','two']},{...scope,examCycle:'implicit'}]) assert(!resetScopeSchema.safeParse(value).success);});
  check('selected bulk and complete reset modes supported with exact date and explicit IDs',()=>{for(const mode of ['SELECTED','EXAM_DATE','CURRENT']) assert(resetScopeSchema.safeParse({...scope,mode,sessionIds:['one','two']}).success);});
  check('reason and typed confirmation mandatory with strict body',()=>{assert(resetConfirmSchema.safeParse({challenge:'signed',reason:'Fixture reason',confirmationText:'RESET ATTENDANCE'}).success);for(const value of [{challenge:'signed',reason:' ',confirmationText:'RESET ATTENDANCE'},{challenge:'signed',reason:'Fixture reason',confirmationText:'RESET'},{challenge:'signed',reason:'Fixture reason',confirmationText:'RESET ATTENDANCE',sessionIds:['other']}]) assert(!resetConfirmSchema.safeParse(value).success);});
  check('history pagination bounded and history flag survives route validation',()=>{assert(!resetHistorySchema.safeParse({limit:101}).success);assert.equal(sessionQuerySchema.parse({includeHistory:'false'}).includeHistory,false);const validated=sessionQuerySchema.parse({includeHistory:'true'});assert.equal(validated.includeHistory,true);assert.equal(sessionQuerySchema.parse(validated).includeHistory,true);assert.equal(sessionQuerySchema.parse({includeHistory:false}).includeHistory,false);assert(!sessionQuerySchema.safeParse({includeHistory:'anything'}).success);});
  console.log(`Attendance reset API validation: ${passed} passed, 0 failed`);
}
run().catch(error=>{console.error(error);process.exitCode=1;});
