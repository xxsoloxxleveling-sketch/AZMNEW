import assert from 'node:assert/strict';
import test from 'node:test';
import {trainingConfig,fallback} from './prepare.mjs';
test('dedicated HTTPS-only package carries no write client or credentials',()=>{
 const config=trainingConfig('https://azmaio.com/omr-training/');
 assert.equal(config.appId,'com.azmaio.omr.training');
 assert.equal(config.server.cleartext,false);
 assert.equal(config.android.webContentsDebuggingEnabled,false);
 assert.equal(config.webDir,'readonly-dist');
 assert.ok(!/api\/omr|api\/upload|password\s*=|studentId|answerKeys/.test(fallback));
});
test('reject unapproved, credential-bearing and non-HTTPS URLs',()=>{
 for(const value of ['http://azmaio.com/omr-training/','https://production.example.com','https://user:secret@azmaio.com/omr-training/','https://azmaio.com/api','https://azmaio.com/omr-training/?key=secret','https://azmaio.com/omr-training/#secret','https://example.trycloudflare.com'])assert.throws(()=>trainingConfig(value));
});
