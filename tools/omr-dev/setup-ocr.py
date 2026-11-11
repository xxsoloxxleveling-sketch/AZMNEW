"""Verify explicitly installed, bundled offline OCR models; never fetch at scan time."""
from importlib.metadata import version
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'workers/omr'))
from printed_identity import verify_ocr_models, OCR_VERSION

def main():
    import rapidocr_onnxruntime
    package = Path(rapidocr_onnxruntime.__file__).resolve().parent
    if version('rapidocr-onnxruntime') != OCR_VERSION or not verify_ocr_models(package):raise ValueError('Offline OCR package/model checksum mismatch')
    print('Pinned offline OCR package and all three model checksums verified. No candidate data transmitted.')

if __name__ == '__main__':main()
