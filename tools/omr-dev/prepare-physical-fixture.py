"""Explicit derived fixture: replace identity only; preserve photographed response pixels."""
import argparse
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('normalized',type=Path)
parser.add_argument('detection',type=Path)
parser.add_argument('qr',type=Path)
parser.add_argument('output',type=Path)
args=parser.parse_args()
image=cv2.imread(str(args.normalized))
result=json.loads(args.detection.read_text())
if image is None or image.shape[:2]!=(2800,1980) or result.get('template')!='AZM_FRAMED_100_LEGACY_V1':raise ValueError('Use a registered provisional framed sample')
if min(y for x,y in result['geometry']['versions'])<580:raise ValueError('Identity fixture would overlap version evidence')
original=image.copy()
image[130:550]=255
for text,position,scale in [('DERIVED TEST COPY - SYNTHETIC IDENTITY ONLY',(290,175),.8),('SYNTHETIC PHOTO CANDIDATE',(300,250),.8),('Class 8 - test examination',(300,350),.8),('SYNTHETIC-PHOTO-0001',(1190,280),.7)]:
    cv2.putText(image,text,position,cv2.FONT_HERSHEY_SIMPLEX,scale,(0,0,0),2)
qr=cv2.imread(str(args.qr))
if qr is None or qr.shape[:2]!=(380,380):raise ValueError('Use the fabricated 380-pixel QR')
image[170:550,1560:1940]=qr
if not np.array_equal(original[560:],image[560:]):raise AssertionError('Photographed answer/version pixels changed')
if not np.array_equal(original[:130],image[:130]):raise AssertionError('Corner/title evidence changed')
canvas=cv2.copyMakeBorder(image,60,60,60,60,cv2.BORDER_CONSTANT,value=(65,65,65))
if not cv2.imwrite(str(args.output),canvas):raise ValueError('Fixture could not be written')
args.output.with_suffix('.lineage.json').write_text(json.dumps({'derivedTestCopy':True,'notAnOriginalCameraCapture':True,'sourceFileSha256':hashlib.sha256(args.normalized.read_bytes()).hexdigest(),'unchangedResponseRegionPixelsSha256':hashlib.sha256(original[560:].tobytes()).hexdigest(),'identityReplacementBounds':[0,130,1980,550],'actualIdentityOrQrAccuracyClaimed':False,'officialScoringAllowed':False},indent=2))
print('Created explicitly derived identity fixture; photographed response/version pixels preserved.')
