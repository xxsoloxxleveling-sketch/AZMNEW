"""Supplemental image decoding only. No page registration, roster or grading authority."""
import json
import sys
from engine import load_image, InvalidScan
from qr_decode import decode_qr
from printed_identity import read_roll_region

def analyze(image):
    text, diagnostic=decode_qr(image)
    try:payload=json.loads(text)
    except (ValueError,TypeError):payload=None
    roll=read_roll_region(image)
    return {'qrDecoded':bool(text),'qrPayload':payload,'printedRollNumber':roll['value'],
            'rollStatus':roll['status'],'width':image.shape[1],'height':image.shape[0]}

if __name__=='__main__':
    try:print(json.dumps(analyze(load_image(sys.argv[1],minimum_side=320))))
    except (InvalidScan,OSError,ValueError):
        print(json.dumps({'status':'INVALID'}));raise SystemExit(2)
