"""Verify explicitly installed, bundled offline OCR models; never fetch at scan time."""
from importlib.metadata import version
from pathlib import Path
import sys
import argparse
import hashlib
import urllib.request
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'workers/omr'))
from printed_identity import verify_ocr_models, OCR_VERSION, ENGLISH_MODEL, ENGLISH_MODEL_SHA256

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install-english',action='store_true')
    args=parser.parse_args()
    import rapidocr_onnxruntime
    package = Path(rapidocr_onnxruntime.__file__).resolve().parent
    if version('rapidocr-onnxruntime') != OCR_VERSION or not verify_ocr_models(package):raise ValueError('Offline OCR package/model checksum mismatch')
    if args.install_english and (not ENGLISH_MODEL.is_file() or hashlib.sha256(ENGLISH_MODEL.read_bytes()).hexdigest()!=ENGLISH_MODEL_SHA256):
        url='https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.2/onnx/PP-OCRv4/rec/en_PP-OCRv4_rec_mobile.onnx'
        data=urllib.request.urlopen(url,timeout=60).read(20*1024*1024+1)
        if hashlib.sha256(data).hexdigest()!=ENGLISH_MODEL_SHA256:raise ValueError('English model checksum mismatch; not installed')
        ENGLISH_MODEL.parent.mkdir(exist_ok=True)
        temporary=ENGLISH_MODEL.with_suffix('.download');temporary.write_bytes(data);temporary.replace(ENGLISH_MODEL)
    if ENGLISH_MODEL.exists() and hashlib.sha256(ENGLISH_MODEL.read_bytes()).hexdigest()!=ENGLISH_MODEL_SHA256:raise ValueError('English model checksum mismatch')
    print('Pinned offline OCR package and all three model checksums verified. No candidate data transmitted.')
    print('Verified English fallback available:',ENGLISH_MODEL.is_file())

if __name__ == '__main__':main()
