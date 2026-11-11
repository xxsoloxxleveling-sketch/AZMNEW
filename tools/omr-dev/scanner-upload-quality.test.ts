import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeScanUploadProblem,nativeScanResolutionAdvisory,NATIVE_SCAN_ACCEPT_SHORT_SIDE} from '../../apps/omr-mobile/src/scanner-upload-quality';

test('1599 × 2571 native document crop is eligible for backend recognition',()=>{
 assert.equal(NATIVE_SCAN_ACCEPT_SHORT_SIDE,1536);
 assert.equal(nativeScanUploadProblem(1599,2571),null);
 assert.match(nativeScanResolutionAdvisory(1599,2571)!,/slightly below.*1600-pixel/);
 assert.equal(nativeScanUploadProblem(2571,1599),null);
});
test('native scanner still blocks grossly low resolution and invalid images',()=>{
 assert.match(nativeScanUploadProblem(1535,2571)!,/below the minimum/);
 assert.match(nativeScanUploadProblem(1000,1200)!,/below the minimum/);
 assert.match(nativeScanUploadProblem(0,2571)!,/invalid dimensions/);
 assert.match(nativeScanUploadProblem(NaN,2571)!,/invalid dimensions/);
 assert.match(nativeScanUploadProblem(5500,4000)!,/20 megapixels/);
});
test('normal full-resolution scans need no low-resolution advisory',()=>{
 assert.equal(nativeScanUploadProblem(1600,2571),null);
 assert.equal(nativeScanResolutionAdvisory(1600,2571),null);
 assert.equal(nativeScanUploadProblem(2600,4000),null);
});
