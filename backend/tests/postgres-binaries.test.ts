import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {postgresExecutable} from './postgres-binaries';
test('native discovery skips an older PATH client and continues to PostgreSQL 17',()=>{
 const result=postgresExecutable('psql',{roots:['older-path','postgres17'],exists:()=>true,probe:file=>file.includes('older-path')?'psql (PostgreSQL) 16.11':'psql (PostgreSQL) 17.11'});
 assert.equal(path.dirname(result),'postgres17');
});
test('native discovery fails clearly if every candidate is missing or incompatible',()=>{
 assert.throws(()=>postgresExecutable('psql',{roots:['missing'],exists:()=>false,probe:()=>assert.fail('missing binary was executed')}),/17\/18 test tools unavailable/);
 assert.throws(()=>postgresExecutable('postgres',{roots:['older-path'],exists:()=>true,probe:()=>'postgres (PostgreSQL) 16.11'}),/17\/18 test tools unavailable/);
});
