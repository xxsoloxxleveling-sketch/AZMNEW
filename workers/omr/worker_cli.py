"""Protected IPC entry point. No credentials, database access or publication decisions."""
import argparse
import json
from pathlib import Path
import cv2
from engine import InvalidScan, load_image, recognize, annotate
from pdf_input import inspect_pdf, render_pdf
from printed_identity import read_printed_roll

parser=argparse.ArgumentParser()
parser.add_argument('source')
parser.add_argument('--inspect',action='store_true')
parser.add_argument('--page',type=int,default=1)
parser.add_argument('--annotation')
args=parser.parse_args()
try:
    source=Path(args.source).resolve()
    with source.open('rb') as stream: is_pdf=stream.read(5)==b'%PDF-'
    if args.inspect:
        if is_pdf: count=inspect_pdf(source)
        else: load_image(source); count=1
        print(json.dumps({'pages':count,'type':'pdf' if is_pdf else 'image'}))
    else:
        if not 1<=args.page<=25 or (not is_pdf and args.page!=1): raise InvalidScan('invalid_page')
        image=render_pdf(source,args.page) if is_pdf else source
        profile=json.loads(Path(__file__).with_name('template-v2.json').read_text())
        result,normalized=recognize(load_image(image),profile)
        roll=read_printed_roll(normalized)
        result['printedRollNumber']=roll.pop('value')
        result['printedRollDiagnostics']=roll
        if args.annotation:
            ok,encoded=cv2.imencode('.png',annotate(normalized,result,profile))
            if not ok: raise InvalidScan('annotation_failed')
            import os
            fd=os.open(args.annotation,os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
            with os.fdopen(fd,'wb') as output: output.write(encoded.tobytes())
        print(json.dumps(result))
except (InvalidScan,cv2.error,OSError,ValueError) as error:
    diagnostic=getattr(error,'diagnostics',None)
    print(json.dumps({'status':'INVALID','reason':str(error) if isinstance(error,InvalidScan) else 'processing_failed','officialScoringAllowed':False,**({'layoutDiagnostics':diagnostic} if diagnostic else {})}))
    raise SystemExit(2)
