"""Optional OCR cross-check. Missing/uncertain OCR requires authorized manual identity review."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import cv2

def printed_roll(image):
    executable=shutil.which('tesseract')
    if not executable: return None
    h,w=image.shape[:2]
    crop=image[round(.08*h):round(.12*h),round(.60*w):round(.81*w)]
    crop=cv2.copyMakeBorder(crop,16,16,16,16,cv2.BORDER_CONSTANT,value=(255,255,255))
    with tempfile.TemporaryDirectory(prefix='azm-omr-ocr-') as folder:
        source=Path(folder)/'printed-roll.png'
        if not cv2.imwrite(str(source),crop): return None
        environment={key:os.environ[key] for key in ('PATH','SYSTEMROOT','WINDIR','TEMP','TMP') if key in os.environ}
        try:
            result=subprocess.run([executable,str(source),'stdout','--psm','7','-c','tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=8,check=True,env=environment)
            text=re.sub(r'\s+','',result.stdout.decode('utf8','replace'))
            return text if re.fullmatch(r'[A-Z0-9-]{4,128}',text) else None
        except (subprocess.SubprocessError,OSError): return None
