"""Private acceptance diagnostics. Never labels answers or emits decoded identities."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import cv2
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'workers/omr'))
from engine import load_image,markers,InvalidScan
from registration import timing_tracks
from qr_decode import original_region,decode_qr


def inspect(source, observation, crop_path=None, labels=None):
    image=load_image(source)
    result={'sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'width':image.shape[1],'height':image.shape[0],'bytes':Path(source).stat().st_size,'qrCropAvailable':False,'independentAccuracy':None}
    diagnostic=observation.get('layoutDiagnostics') or {}
    zone=[1550,170,1940,650]
    if observation.get('template')=='AZM_OMR_V2_2026_V':
        profile=json.loads((ROOT/'workers/omr/template-v2.json').read_text());poses=[]
        for turns in range(4):
            try:
                rotated=np.rot90(image,turns).copy();matrix=cv2.getPerspectiveTransform(markers(rotated),np.float32(profile['markers']))
                page=cv2.warpPerspective(rotated,matrix,tuple(profile['size']),borderValue=(255,255,255))
                if timing_tracks(cv2.cvtColor(page,cv2.COLOR_BGR2GRAY),profile):poses.append({'transform':matrix.tolist(),'rotation':turns*90})
            except (InvalidScan,cv2.error):pass
        if len(poses)==1:diagnostic=poses[0];zone=profile['qrZone']
    if observation.get('status')!='INVALID' and diagnostic.get('transform'):
        crop=original_region(image,diagnostic,zone)
        payload,quality=decode_qr(crop)
        result.update({'qrCropAvailable':bool(crop.size),'qrOriginalCropPixels':[crop.shape[1],crop.shape[0]],'qrCropQuality':quality,'qrPayloadDecoded':bool(payload)})
        if crop_path and crop.size:
            if not cv2.imwrite(str(crop_path),crop):raise ValueError('Cannot preserve private QR crop')
    else:result['qrCropUnavailableReason']='No unique verified page transform; do not guess a QR-to-sheet association'
    if labels:
        spec=importlib.util.spec_from_file_location('physical_accuracy',ROOT/'tools/omr-dev/physical-accuracy.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        result['independentAccuracy']=module.evaluate(observation,json.loads(Path(labels).read_text()),result['sha256'])
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('observation',type=Path);p.add_argument('--crop',type=Path);p.add_argument('--labels',type=Path);a=p.parse_args()
    print(json.dumps(inspect(a.source,json.loads(a.observation.read_text()),a.crop,a.labels)))
