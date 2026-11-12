"""Local-only repeatability/QR/confidence investigation; never reads answer keys."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import cv2
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'workers/omr'))
from engine import recognize,load_image,InvalidScan
from qr_decode import original_region,decode_qr


def finder_modules(gray):
    binary=cv2.threshold(gray,0,255,cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)[1]
    contours,hierarchy=cv2.findContours(binary,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    sizes=[]
    if hierarchy is not None:
        for i,c in enumerate(contours):
            child=hierarchy[0,i,2]
            if child<0 or hierarchy[0,child,2]<0:continue
            x,y,w,h=cv2.boundingRect(c)
            if .7<w/h<1.4 and 5<=min(w,h)<=.4*gray.shape[1]:sizes.append((w+h)/14)
    return round(float(np.median(sizes)),2) if sizes else None


def main():
    if os.environ.get('CI'):raise ValueError('Private evidence is local-only')
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('folder',type=Path);p.add_argument('--output',type=Path,default=ROOT/'tmp/omr-reference/reliability-20261110');args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    profile=json.loads((ROOT/'workers/omr/template-v2.json').read_text());summaries=[];version_crops=[]
    baseline=ROOT/'tmp/omr-reference/physical-validation'
    for i,source in enumerate(sorted(p for p in args.folder.iterdir() if p.suffix.lower() in {'.jpeg','.jpg','.png'}),1):
        sample=f'S{i:02d}';image=load_image(source)
        group='calibration' if i<=18 else 'validation';previous=json.loads((baseline/f'{group}-59a7779250d1'/f'{sample}.json').read_text())
        try:
            result,normalized=recognize(image,profile)
            assert previous['status']!='INVALID','A rejected source unexpectedly mapped'
            assert [r['answer'] for r in result['responses']]==[r['answer'] for r in previous['responses']],'Answer classifications changed without independent evidence'
            assert result['paperVersion']['answer']==previous['paperVersion']['answer']
            crop=original_region(image,result['layoutDiagnostics'],[1550,170,1940,650]);gray=cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY)
            _,qr=decode_qr(crop);module=finder_modules(gray)
            uncertain=[r for r in result['responses'] if r['answer']=='UNCERTAIN']
            summary={'sample':sample,'status':result['status'],'size':[image.shape[1],image.shape[0]],'mapped':True,'qrDecoded':result['identity'] is not None or result.get('qrEnvelope') is not None,'qrOriginal':qr,'qrCropPixels':[crop.shape[1],crop.shape[0]],'estimatedFinderModulePixels':module,'uncertain':len(uncertain),'uncertainReasons':{reason:sum(r.get('reason')==reason for r in uncertain) for reason in set(r.get('reason') for r in uncertain)},'paperVersion':result['paperVersion']['answer'],'versionDarkness':result['paperVersion']['darkness'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'responsesUnchanged':True}
            cv2.imwrite(str(args.output/(sample+'-original-qr.png')),crop)
            if summary['paperVersion']=='UNCERTAIN':
                centers=result['geometry']['versions'];x0=int(min(c[0] for c in centers))-55;x1=int(max(c[0] for c in centers))+55;y=int(np.mean([c[1] for c in centers]))
                vc=normalized[y-60:y+60,x0:x1];cv2.imwrite(str(args.output/(sample+'-version.png')),vc)
                vc=cv2.resize(vc,(800,210));cv2.putText(vc,sample,(10,25),cv2.FONT_HERSHEY_SIMPLEX,.7,(0,0,255),2);version_crops.append(vc)
        except InvalidScan as error:
            assert previous['status']=='INVALID','Previously mapped source rejected'
            result={'status':'INVALID','reason':str(error),'officialScoringAllowed':False};summary={'sample':sample,'status':'INVALID','mapped':False,'reason':str(error),'size':[image.shape[1],image.shape[0]]}
        (args.output/(sample+'.json')).write_text(json.dumps(result,indent=2));summaries.append(summary)
        print(sample,summary['status'],'QR',summary.get('qrDecoded',False),flush=True)
    if version_crops:cv2.imwrite(str(args.output/'uncertain-versions.png'),np.vstack(version_crops))
    report={'samples':summaries,'mapped':sum(s['mapped'] for s in summaries),'rejected':sum(not s['mapped'] for s in summaries),'qrDecoded':sum(s.get('qrDecoded',False) for s in summaries),'uncertain':sum(s.get('uncertain',0) for s in summaries),'uncertainVersions':sum(s.get('paperVersion')=='UNCERTAIN' for s in summaries),'independentAccuracy':None,'officialScoringAllowed':False}
    (args.output/'private-report.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='samples'}))


if __name__=='__main__':main()
