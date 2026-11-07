"""Reproducible synthetic accuracy/performance report. Does not prove camera accuracy."""
import json,time
import cv2
import numpy as np
from engine import recognize,InvalidScan
from test_engine import fixture,PROFILE
cases=[]
for answer in 'ABCD': cases.append((f'all_{answer}',fixture({n:answer for n in range(1,101)}),[answer]*100))
cases.append(('blank',fixture(),['BLANK']*100))
expected=['ABCD'[n%4] for n in range(100)]
mixed=fixture({n+1:answer for n,answer in enumerate(expected)})
cases.append(('mixed',mixed,expected))
for turns in [1,2,3]: cases.append((f'rotation_{turns*90}',np.rot90(mixed,turns).copy(),expected))
h,w=mixed.shape[:2]
m=cv2.getPerspectiveTransform(np.float32([[0,0],[w,0],[w,h],[0,h]]),np.float32([[30,40],[w-10,10],[w-20,h-30],[10,h-5]]))
cases.append(('perspective',cv2.warpPerspective(mixed,m,(w,h),borderValue=(255,255,255)),expected))
matched=exact=rejected=review=0; timings=[]
for name,image,expected in cases:
    start=time.perf_counter()
    try:
        result,_=recognize(image,PROFILE)
        actual=[r['answer'] for r in result['responses']]
        matched+=sum(a==b for a,b in zip(actual,expected)); exact+=actual==expected
        review+=result['status']=='REVIEW_REQUIRED'
    except InvalidScan:
        rejected+=1
    timings.append(time.perf_counter()-start)
report={'validation':'SYNTHETIC_ONLY','sheets':len(cases),'questions':100*len(cases),'correctClassifications':matched,'questionAccuracy':matched/(100*len(cases)),'sheetExactMatch':exact/len(cases),'rejectionRate':rejected/len(cases),'reviewRate':review/len(cases),'medianSeconds':float(np.median(timings)),'maxSeconds':max(timings),'physicalCameraAccuracy':None,'officialScoringAllowed':False}
print(json.dumps(report,indent=2))
