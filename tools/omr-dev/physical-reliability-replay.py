"""Local-only physical replay. Never treats operator comparisons as independent labels."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
import cv2

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'workers/omr'))
from engine import recognize, load_image, InvalidScan
from printed_identity import read_printed_roll

FILES = ['engine.py','physical_layout.py','registration.py','responses.py','qr_decode.py','printed_identity.py','template-v2.json','template-framed-legacy-v1.json','identity_detail.py','requirements.txt','requirements-ocr.txt']

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('originals',type=Path)
    parser.add_argument('baseline',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--stage',choices=['calibration','validation'],required=True)
    args=parser.parse_args()
    if not args.output.resolve().is_relative_to((ROOT/'tmp/omr-reference').resolve()):raise ValueError('Physical observations must stay in the ignored private evidence directory')
    sources=sorted(p for p in args.originals.iterdir() if p.suffix.lower() in {'.jpg','.jpeg','.png'})
    if len(sources)!=24:raise ValueError('This replay expects the original fixed 24-photo dataset')
    source_hashes=[hashlib.sha256(p.read_bytes()).hexdigest() for p in sources]
    code_hash=hashlib.sha256(b''.join((ROOT/'workers/omr'/name).read_bytes() for name in FILES)).hexdigest()
    args.output.mkdir(parents=True,exist_ok=True)
    freeze=args.output/'freeze.json'
    if args.stage=='calibration':
        if freeze.exists():raise ValueError('Use a new experiment folder; never overwrite a frozen replay')
        freeze.write_text(json.dumps({'recognitionSha256':code_hash,'sourceHashes':source_hashes,'historicalDatasetPreviouslySeen':True,'deviceReviewedSample':'S21','independentLabelsAvailable':False},indent=2),encoding='utf8')
    else:
        frozen=json.loads(freeze.read_text(encoding='utf8'))
        if frozen['recognitionSha256']!=code_hash or frozen['sourceHashes']!=source_hashes:raise ValueError('Algorithm or dataset changed after the calibration-stage freeze')
    profile=json.loads((ROOT/'workers/omr/template-v2.json').read_text(encoding='utf8'))
    rows=[]
    for index,source in enumerate(sources,1):
        if (index<=18)!=(args.stage=='calibration'):continue
        sample=f'S{index:02d}'
        old_path=args.baseline/f'{sample}.json'
        old=json.loads(old_path.read_text(encoding='utf8'))
        start=time.perf_counter()
        try:
            result,normalized=recognize(load_image(source),profile)
            roll=read_printed_roll(normalized)
            result['printedRollNumber']=roll['value'];result['printedRollDiagnostics']={k:v for k,v in roll.items() if k!='value'}
            cv2.imwrite(str(args.output/f'{sample}-normalized.png'),normalized)
            accepted_changes=[r['question'] for r,b in zip(result['responses'],old['responses']) if not b['reviewRequired'] and r['answer']!=b['answer']]
            row={'sample':sample,'mapped':True,'uncertain':sum(r['answer']=='UNCERTAIN' for r in result['responses']),'multiple':sum(r['answer']=='MULTIPLE' for r in result['responses']),'reviewRows':sum(r['reviewRequired'] for r in result['responses']),'qrDecoded':result.get('identity') is not None or result.get('qrEnvelope') is not None,'rollRead':bool(roll['value']),'rollStatus':roll['status'],'version':result['paperVersion']['answer'],'previouslyAcceptedChanged':len(accepted_changes)}
        except InvalidScan as error:
            result={'status':'INVALID','reason':str(error),'layoutDiagnostics':error.diagnostics}
            row={'sample':sample,'mapped':False,'reason':str(error)}
        row['seconds']=round(time.perf_counter()-start,3)
        row['sourceSha256']=source_hashes[index-1]
        (args.output/f'{sample}.json').write_text(json.dumps(result,indent=2),encoding='utf8')
        rows.append(row)
        print(json.dumps({k:v for k,v in row.items() if k!='sourceSha256'}),flush=True)
    report={'stage':args.stage,'recognitionSha256':code_hash,'samples':rows,'mapped':sum(r['mapped'] for r in rows),'uncertain':sum(r.get('uncertain',0) for r in rows),'reviewRows':sum(r.get('reviewRows',0) for r in rows),'rollRead':sum(r.get('rollRead',False) for r in rows),'qrDecoded':sum(r.get('qrDecoded',False) for r in rows),'independentQuestionAccuracy':None,'falseAcceptanceRate':None,'officialScoringAllowed':False,'publicationAllowed':False}
    (args.output/f'{args.stage}-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')

if __name__=='__main__':main()
