"""Private physical geometry/observation benchmark. Accuracy requires human evidence."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import sys
import time
import cv2
import numpy as np

REPO=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(REPO/'workers/omr'))
from engine import recognize,load_image,InvalidScan,annotate

OUTPUT=REPO/'tmp/omr-reference/physical-validation'
FILES=['engine.py','physical_layout.py','registration.py','responses.py','template-v2.json','template-framed-legacy-v1.json']


def recognition_hash():
    return hashlib.sha256(b''.join((REPO/'workers/omr'/name).read_bytes() for name in FILES)).hexdigest()


def compare_file(sample,result,folder):
    rows=[]
    for response in result['responses']:
        strong=[option for option,value in zip('ABCD',response['darkness']) if value>=.6817600622773171]
        candidate=strong[0] if len(strong)==1 else '/'.join(strong) if strong else 'UNREADABLE'
        rows.append({'Question':response['question'],'Detected':response['answer'],'UnconfirmedInkCandidate':candidate if response['answer']=='UNCERTAIN' else '', 'Display':candidate+'?' if response['answer']=='UNCERTAIN' else response['answer']})
    lines=[f'{sample} - PROVISIONAL PHOTO READING',f'Paper version detected: {result["paperVersion"]["answer"]}',f'Algorithm SHA-256: {recognition_hash()}','This is NOT the official key or a score. Every response requires review.','? indicates an uncertain reading; the letter is only an ink candidate to inspect.','','Questions 1-25       Questions 26-50      Questions 51-75      Questions 76-100']
    for index in range(25):lines.append(''.join(f'{rows[index+column*25]["Question"]:3d}: {rows[index+column*25]["Display"]:<14}' for column in range(4)))
    lines+=['','Please compare all 100 entries with the original photo.','Report corrections as: '+sample+': Q7=D, Q26=A, ...','A review after seeing predictions is not a blind independent transcription.']
    (folder/f'{sample}-compare.txt').write_text('\n'.join(lines),encoding='utf-8')
    with (folder/f'{sample}-compare.csv').open('w',newline='',encoding='utf-8') as stream:
        writer=csv.DictWriter(stream,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    return ''.join(row['UnconfirmedInkCandidate'] or row['Detected'] for row in rows)


def diagnostic_image(image,result,profile,target):
    diagnostics=result.get('layoutDiagnostics') or result.get('diagnostics') or {}
    attempts=diagnostics.get('attempts',[])
    if attempts:diagnostics=max(attempts,key=lambda value:len(value.get('headers',[]))*10+('transform' in value)*5+len(value))
    rotated=np.rot90(image,diagnostics.get('rotation',0)//90).copy()
    for marker in diagnostics.get('markers',[]):
        point=marker.get('center') if isinstance(marker,dict) else marker
        cv2.circle(rotated,tuple(round(float(value)) for value in point),13,(0,0,255),2)
    page=diagnostics.get('proposedPageBoundary')
    if page:cv2.polylines(rotated,[np.int32(page)],True,(255,120,0),2)
    for edge in diagnostics.get('detectedPageEdges',[]):cv2.polylines(rotated,[np.int32(edge['points'])],False,(255,0,255),1)
    left=cv2.resize(rotated,(720,1280))
    right=np.full((1280,905,3),245,np.uint8)
    if diagnostics.get('transform'):
        normalized=cv2.warpPerspective(np.rot90(image,diagnostics.get('rotation',0)//90).copy(),np.array(diagnostics['transform']),tuple(profile['size']),borderValue=(255,255,255))
        if result.get('responses'):normalized=annotate(normalized,result,profile)
        for x,y in diagnostics.get('expectedMarkers',profile['markers']):cv2.circle(normalized,(round(x),round(y)),35,(0,180,0),3)
        for x,y,w,h in diagnostics.get('headers',[]):cv2.rectangle(normalized,(x,y),(x+w,round(y+h+25*49.5)),(255,90,0),3)
        samples=diagnostics.get('timingTrackDarkFractions',[])
        for side,left_mm in enumerate(profile['timingTracks']['xMm']):
            for row in range(25):
                x=round((left_mm+1)/210*1980);y=round((71+row*5)/297*2800)
                value=samples[side*25+row] if len(samples)==50 else 0
                cv2.circle(normalized,(x,y),12,(0,150,0) if value>.5 else (0,0,255),2)
        right=cv2.resize(normalized,(905,1280))
    canvas=np.full((1420,1625,3),255,np.uint8);canvas[140:,:720]=left;canvas[140:,720:]=right
    messages=[f'{target.stem}: {result.get("status")} / {diagnostics.get("reason",result.get("template","unknown"))}', 'Red: detected markers. Blue: proposed page/grid. Purple: observed boundary edges.', 'Right: proposed transform, expected green markers, current timing positions (not legacy evidence).','No transform or timing/grid observations are invented when registration fails.']
    for index,message in enumerate(messages):cv2.putText(canvas,message,(14,26+index*29),cv2.FONT_HERSHEY_SIMPLEX,.65,(20,20,20),1)
    cv2.imwrite(str(target),canvas)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder',type=Path)
    parser.add_argument('--split',choices=['calibration','validation'],default='calibration')
    parser.add_argument('--freeze',action='store_true')
    args=parser.parse_args()
    sources=sorted(path for path in args.folder.iterdir() if path.suffix.lower() in {'.jpeg','.jpg','.png'})
    if len(sources)!=24:raise ValueError('This experiment is the fixed 24-photo dataset; explicitly define a new split for other data')
    hashes=[hashlib.sha256(path.read_bytes()).hexdigest() for path in sources]
    OUTPUT.mkdir(parents=True,exist_ok=True)
    freeze_path=OUTPUT/'frozen-validation.json'
    if args.split=='validation':
        if not freeze_path.exists():raise ValueError('Freeze the calibrated algorithm before opening held-out sheets')
        frozen=json.loads(freeze_path.read_text())
        if frozen['recognitionSha256']!=recognition_hash() or frozen['sourceHashes']!=hashes:raise ValueError('The frozen algorithm/dataset changed. Do not tune against and relabel this holdout as unseen')
    folder=OUTPUT/f'{args.split}-{recognition_hash()[:12]}'
    folder.mkdir(exist_ok=True)
    profile=json.loads((REPO/'workers/omr/template-v2.json').read_text())
    summaries=[];private_map=[]
    for index,source in enumerate(sources,1):
        if (index<=18)!=(args.split=='calibration'):continue
        sample=f'S{index:02d}';start=time.perf_counter();image=load_image(source)
        try:
            result,normalized=recognize(image,profile)
            cv2.imwrite(str(folder/f'{sample}-normalized.png'),normalized)
            fingerprint=compare_file(sample,result,folder)
            summary={'sample':sample,'status':result['status'],'layout':result['template'],'responses':100,'version':result['paperVersion']['answer'],'qrDecoded':result['identity'] is not None,'uncertain':sum(row['answer']=='UNCERTAIN' for row in result['responses']),'multiple':sum(row['answer']=='MULTIPLE' for row in result['responses']),'blank':sum(row['answer']=='BLANK' for row in result['responses']),'registration':result['quality']['registration'],'answerPatternFingerprint':hashlib.sha256(fingerprint.encode()).hexdigest()}
        except InvalidScan as error:
            result={'status':'INVALID','reason':str(error),'diagnostics':error.diagnostics}
            stages=list(dict.fromkeys(item['reason'] for item in (error.diagnostics or {}).get('attempts',[])))
            summary={'sample':sample,'status':'INVALID','reason':str(error),'rejectionStages':stages,'responses':0}
        summary['seconds']=round(time.perf_counter()-start,3)
        (folder/f'{sample}.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        diagnostic_image(image,result,profile,folder/f'{sample}-diagnostic.png')
        private_map.append({'sample':sample,'originalFile':str(source),'sha256':hashes[index-1]})
        summaries.append(summary)
        print(json.dumps({key:value for key,value in summary.items() if key!='answerPatternFingerprint'}),flush=True)
    report={'split':args.split,'recognitionSha256':recognition_hash(),'samples':summaries,'humanGroundTruthAvailable':False,'questionAccuracy':None,'sheetExactMatchAccuracy':None,'falseConfidentAnswers':None,'independentValidationSheets':None,'duplicateGrouping':'Answer-pattern fingerprints are conservative duplicate candidates, not proof of different physical sheets','officialScoringAllowed':False,'productionReady':False}
    (folder/'report.json').write_text(json.dumps(report,indent=2))
    (folder/'sample-map.json').write_text(json.dumps(private_map,indent=2))
    if args.freeze:
        if args.split!='calibration':raise ValueError('Only calibration can freeze an algorithm')
        if freeze_path.exists():raise ValueError('A freeze already exists; preserve its history rather than silently replacing it')
        freeze_path.write_text(json.dumps({'recognitionSha256':recognition_hash(),'sourceHashes':hashes,'calibrationIds':[f'S{number:02d}' for number in range(1,19)],'validationIds':[f'S{number:02d}' for number in range(19,25)],'questionAccuracy':None},indent=2))
    print(f'Private report: {folder.relative_to(REPO)}/report.json',flush=True)


if __name__=='__main__':main()
