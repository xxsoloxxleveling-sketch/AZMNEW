"""Extract geometry only from a private blank Template 2 PDF raster. No identity retained."""
import argparse,json
from pathlib import Path
import cv2
import numpy as np
p=argparse.ArgumentParser(); p.add_argument('image'); p.add_argument('output'); args=p.parse_args()
image=cv2.imread(args.image,0)
h,w=image.shape
circles=cv2.HoughCircles(image,cv2.HOUGH_GRADIENT,1,15,param1=120,param2=17,minRadius=7,maxRadius=12)
if circles is None: raise SystemExit('No circles found')
rows=[]
for col in range(4):
    zone=[c for c in circles[0] if (.11+.235*col)*w<c[0]<(.21+.235*col)*w and .277*h<c[1]<.71*h]
    zone.sort(key=lambda c:c[1])
    groups=[]
    for c in zone:
        group=next((g for g in groups if abs(np.mean([v[1] for v in g])-c[1])<5),None)
        if group is None: groups.append([c])
        else: group.append(c)
    if len(groups)!=25 or any(len(g)!=4 for g in groups):
        raise SystemExit(f'Column {col} invalid: {[len(g) for g in groups]}')
    rows.extend([[[float(c[0]),float(c[1])] for c in sorted(g,key=lambda c:c[0])] for g in groups])
versions=sorted([c for c in circles[0] if .80*w<c[0]<.95*w and .24*h<c[1]<.255*h],key=lambda c:c[0])
if len(versions)!=4: raise SystemExit(f'Invalid version bubbles: {len(versions)}')
profile={'id':'AZM_OMR_V2_2026_V','size':[w,h],'pageMm':[210,297],'markers':[[5.5/210*w,5.5/297*h],[(210-5.5)/210*w,5.5/297*h],[(210-5.5)/210*w,(297-5.5)/297*h],[5.5/210*w,(297-5.5)/297*h]],'radius':9.3,'questions':rows,'versions':[[float(c[0]),float(c[1])] for c in versions],'answerZone':[int(.10*w),int(.27*h),int(.96*w),int(.72*h)],'qrZone':[int(.817*w),int(.086*h),int(.945*w),int(.171*h)],'thresholds':{'blank':.20,'filled':.60,'registration':.65,'focus':75},'validation':'PROVISIONAL_SYNTHETIC_ONLY','timingTracks':{'xMm':[2.5,205.5],'topMm':70,'pitchMm':5,'count':25}}
# Normalize to roughly 240 DPI; tiny QR modules cannot be decoded reliably at preview resolution.
profile['size']=[2*w,2*h]
for field in ['markers','versions']:
    profile[field]=[[2*x,2*y] for x,y in profile[field]]
profile['questions']=[[[2*x,2*y] for x,y in row] for row in profile['questions']]
for field in ['answerZone','qrZone']:
    profile[field]=[2*v for v in profile[field]]
profile['radius']*=2
from engine import normalize,measurements
aligned=cv2.cvtColor(normalize(cv2.cvtColor(image,cv2.COLOR_GRAY2BGR),profile),cv2.COLOR_BGR2GRAY)
blank_values=[v for row in profile['questions'] for v in measurements(aligned,row,profile['radius'])]
maximum_blank=max(blank_values)
if maximum_blank>.55: raise SystemExit('Blank reference contains marks or registration is unreliable')
profile['thresholds']['blank']=maximum_blank+.10*(1-maximum_blank)
profile['thresholds']['filled']=maximum_blank+.65*(1-maximum_blank)
profile['calibrationEvidence']={'referenceBlankBubbles':len(blank_values),'maximumBlankDarkness':maximum_blank,'physicalSamples':0,'provisional':True}
Path(args.output).write_text(json.dumps(profile,indent=2))
print('Extracted 400 answer centers, 4 version centers; no candidate data saved.')
