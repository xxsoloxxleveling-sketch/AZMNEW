"""Offline printed-roll candidates. OCR never proves roster identity or authorizes scoring."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import cv2
cv2.setNumThreads(1)

OCR_VERSION = '1.4.4'
ENGLISH_MODEL = Path(__file__).with_name('.models')/'en_PP-OCRv4_rec_mobile.onnx'
ENGLISH_MODEL_SHA256 = 'e8770c967605983d1570cdf5352041dfb68fa0c21664f49f47b155abd3e0e318'
OCR_MODELS = {
    'ch_PP-OCRv4_det_infer.onnx': 'd2a7720d45a54257208b1e13e36a8479894cb74155a5efe29462512d42f49da9',
    'ch_PP-OCRv4_rec_infer.onnx': '48fc40f24f6d2a207a2b1091d3437eb3cc3eb6b676dc3ef9c37384005483683b',
    'ch_ppocr_mobile_v2.0_cls_infer.onnx': 'e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c',
}
ROLL = re.compile(r'(?:AZMVS-20\d{2}-\d{4,8}|SYNTHETIC-OMR-\d{4})')


def canonical_roll(text):
    # Only whitespace and separator typography may change; no guessed characters.
    text = re.sub(r'\s+', '', text).replace('\u2013','-').replace('\u2014','-')
    return text if ROLL.fullmatch(text) else None


def verify_ocr_models(package):
    for name, expected in OCR_MODELS.items():
        model = package/'models'/name
        if not model.is_file() or hashlib.sha256(model.read_bytes()).hexdigest() != expected:return False
    return True


def reconcile_reads(reads):
    all_values = {value for result in reads for value, _ in result}
    if len(all_values) > 1:return {'value': None, 'status': 'CONFLICTING_READS'}
    votes = [result[0][0] for result in reads if len(result) == 1 and result[0][1] >= .90]
    if len(votes) >= 2 and len(set(votes)) == 1:return {'value': votes[0], 'status': 'READ_UNVERIFIED'}
    return {'value': None, 'status': 'ROLL_UNREADABLE'}


def reconcile_fallback(primary, fallback):
    combined = primary+fallback
    # A second model may recover an unreadable string, never vote away a conflict.
    if len({value for result in combined for value, _ in result}) > 1:return {'value': None, 'status': 'CONFLICTING_READS'}
    return reconcile_reads(fallback)


def recognize_crop(crop):
    try:
        import rapidocr_onnxruntime
        import onnxruntime
        from importlib.metadata import version
    except ImportError:return {'value': None, 'status': 'OCR_ENGINE_UNAVAILABLE'}
    package = Path(rapidocr_onnxruntime.__file__).resolve().parent
    if version('rapidocr-onnxruntime') != OCR_VERSION or not verify_ocr_models(package):return {'value': None, 'status': 'OCR_MODEL_CHECKSUM_MISMATCH'}
    if ENGLISH_MODEL.exists() and hashlib.sha256(ENGLISH_MODEL.read_bytes()).hexdigest() != ENGLISH_MODEL_SHA256:return {'value': None, 'status': 'OCR_MODEL_CHECKSUM_MISMATCH'}
    onnxruntime.disable_telemetry_events()
    engine = rapidocr_onnxruntime.RapidOCR(
        intra_op_num_threads=1, inter_op_num_threads=1,
        det_model_path=str(package/'models/ch_PP-OCRv4_det_infer.onnx'),
        rec_model_path=str(package/'models/ch_PP-OCRv4_rec_infer.onnx'),
        cls_model_path=str(package/'models/ch_ppocr_mobile_v2.0_cls_infer.onnx'),
        use_cuda=False, use_dml=False)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    reads, text_crops = [], []
    native_recognizer=engine.text_rec
    def retain_crops(images,*args,**kwargs):
        text_crops.append([image.copy() for image in images])
        return native_recognizer(images,*args,**kwargs)
    engine.text_rec=retain_crops
    for variant in (crop, cv2.createCLAHE(2, (4,4)).apply(gray)):
        before=len(text_crops)
        results, _ = engine(variant, use_cls=False)
        if len(text_crops)==before:text_crops.append([])
        reads.append([(value, float(result[2])) for result in results or [] if (value := canonical_roll(result[1])) is not None])
    result = reconcile_reads(reads)
    if result['status']=='ROLL_UNREADABLE' and ENGLISH_MODEL.is_file():
        from rapidocr_onnxruntime.ch_ppocr_rec import TextRecognizer
        from rapidocr_onnxruntime.utils import read_yaml
        config=read_yaml(package/'config.yaml')['Rec']
        config.update(model_path=str(ENGLISH_MODEL),intra_op_num_threads=1,inter_op_num_threads=1,use_cuda=False,use_dml=False)
        # Same detected text pixels, second recognizer: do not repeat page/text detection.
        english_recognizer=TextRecognizer(config)
        fallback=[]
        for images in text_crops:
            results,_=english_recognizer(images) if images else ([],0)
            fallback.append([(value,float(score)) for text,score in results if score>=engine.text_score and (value:=canonical_roll(text)) is not None])
        return {**reconcile_fallback(reads,fallback),'attempts':4,'reader':'ENGLISH_FALLBACK','modelSha256':ENGLISH_MODEL_SHA256}
    return {**result, 'attempts': len(reads),'reader':'BASE','modelSha256':OCR_MODELS['ch_PP-OCRv4_rec_infer.onnx']}


def read_printed_roll(image):
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    # Full roll/application box on the verified 1980x2800 page; no leading-letter clipping.
    crop = gray[round(180/2800*h):round(315/2800*h), round(1050/1980*w):round(1640/1980*w)]
    return read_roll_region(crop)


def read_roll_region(crop):
    # A supplemental header crop has no page coordinates. Bound its OCR work.
    if crop is not None and max(crop.shape[:2])>1600:
        crop=cv2.resize(crop,None,fx=1600/max(crop.shape[:2]),fy=1600/max(crop.shape[:2]),interpolation=cv2.INTER_AREA)
    if crop is None or not crop.size:return {'value': None, 'status': 'EMPTY_REGION'}
    with tempfile.TemporaryDirectory(prefix='azm-omr-ocr-') as folder:
        source = Path(folder)/'roll-region.png'
        if not cv2.imwrite(str(source), crop):return {'value': None, 'status': 'OCR_IMAGE_FAILED'}
        try:
            result = subprocess.run([sys.executable, str(Path(__file__).resolve()), str(source)], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=12, check=True)
            value = json.loads(result.stdout)
            if value.get('value') is not None and not ROLL.fullmatch(value['value']):return {'value': None, 'status': 'ROLL_UNREADABLE'}
            return value
        except (subprocess.SubprocessError, OSError, ValueError):return {'value': None, 'status': 'OCR_FAILED_OR_TIMED_OUT'}


def printed_roll(image):return read_printed_roll(image)['value']


if __name__ == '__main__':
    image = cv2.imread(sys.argv[1], cv2.IMREAD_COLOR)
    print(json.dumps(recognize_crop(image) if image is not None else {'value': None, 'status': 'OCR_IMAGE_FAILED'}))
