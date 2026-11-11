"""Isolated deterministic recognition. Never writes grades or contacts a database."""
import os
os.environ.setdefault('OPENCV_IO_MAX_IMAGE_PIXELS', '20000000')
import json
import math
from pathlib import Path
import cv2
import numpy as np

cv2.setNumThreads(1)
from responses import classify
from qr_decode import decode_qr,original_region
from registration import timing_tracks,register,adjusted
OPTIONS = 'ABCD'
MAX_BYTES = 20 * 1024 * 1024

class InvalidScan(ValueError):
    def __init__(self, reason, diagnostics=None):
        super().__init__(reason)
        self.diagnostics=diagnostics

def load_image(path):
    with open(path, 'rb') as stream:
        data = stream.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES or not (data.startswith(b'\x89PNG\r\n\x1a\n') or data.startswith(b'\xff\xd8\xff')):
        raise InvalidScan('unsupported_or_oversized_image')
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None or min(image.shape[:2]) < 600 or image.shape[0] * image.shape[1] > 20000000:
        raise InvalidScan('invalid_dimensions')
    return image

def markers(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    _, binary = cv2.threshold(gray, 70, 255, cv2.THRESH_BINARY_INV)
    try:
        return marker_points(binary)
    except InvalidScan:
        # Camera exposure can make a solid printed marker gray. Local contrast only
        # proposes corners; timing tracks and the full bubble grid still must validate.
        block = max(31, min(151, round(.07*w) | 1))
        local = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,block,15)
        return marker_points(local)

def marker_points(binary):
    h,w=binary.shape
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        area = cv2.contourArea(contour)
        if .6 < bw / bh < 1.6 and .012*w < bw < .065*w and np.mean(binary[y:y+bh,x:x+bw] > 0) > .85:
            candidates.append((x+bw/2, y+bh/2, area))
    result = []
    for right, bottom in [(False, False), (True, False), (True, True), (False, True)]:
        corner = [c for c in candidates if (c[0] > .75*w if right else c[0] < .25*w) and (c[1] > .75*h if bottom else c[1] < .25*h)]
        if len(corner) != 1:
            raise InvalidScan('missing_or_ambiguous_corner_marker')
        result.append(corner[0][:2])
    points = np.float32(result)
    if cv2.contourArea(points) < .45*w*h:
        raise InvalidScan('cropped_or_excessive_perspective')
    return points

def normalize(image, profile):
    width, height = profile['size']
    src = markers(image)
    dst = np.float32(profile['markers'])
    matrix = cv2.getPerspectiveTransform(src, dst)
    if not np.isfinite(matrix).all():
        raise InvalidScan('invalid_registration')
    return cv2.warpPerspective(image, matrix, (width, height), borderValue=(255,255,255))

def measurements(gray, centers, radius):
    values = []
    for x, y in centers:
        x, y = int(round(x)), int(round(y))
        r = int(math.ceil(radius))
        patch = gray[y-r:y+r+1, x-r:x+r+1]
        if patch.shape != (2*r+1, 2*r+1):
            raise InvalidScan('bubble_outside_page')
        yy, xx = np.ogrid[-r:r+1, -r:r+1]
        # Outer interior annulus avoids the preprinted central option letter and outline.
        ring = ((xx*xx+yy*yy) >= (.48*radius)**2) & ((xx*xx+yy*yy) <= (.76*radius)**2)
        values.append(float(np.mean((255.0 - patch[ring].astype(np.float32)) / 255.0)))
    return values


def paper_relative_measurements(gray, centers, radius):
    """Use nearby unprinted paper as white, never another answer as a reference.

    A bright percentile resists nearby outlines without treating a dark erasure as
    paper. This corrects photometry; the original blank/filled thresholds remain.
    """
    r = int(math.ceil(1.65*radius))
    yy, xx = np.ogrid[-r:r+1, -r:r+1]
    distance = xx*xx+yy*yy
    paper_mask = (distance >= (1.20*radius)**2) & (distance <= (1.65*radius)**2)
    ring = (distance >= (.48*radius)**2) & (distance <= (.76*radius)**2)
    values, references = [], []
    for x, y in centers:
        x, y = round(x), round(y)
        patch = gray[y-r:y+r+1, x-r:x+r+1]
        if patch.shape != (2*r+1, 2*r+1):
            raise InvalidScan('bubble_outside_page')
        white = float(np.percentile(patch[paper_mask], 90))
        references.append(white)
        values.append(float(np.mean(np.clip((white-patch[ring].astype(np.float32))/max(white, 1), 0, 1))))
    return values, references

def registration_score(gray, profile):
    scores = []
    radius = profile['radius']
    for row in profile['questions']:
        for x,y in row:
            edge=[]
            for angle in np.linspace(0,2*np.pi,16,endpoint=False):
                px=round(x+radius*np.cos(angle)); py=round(y+radius*np.sin(angle))
                edge.append(bool(np.any(gray[py-1:py+2,px-1:px+2] < 180)))
            scores.append(np.mean(edge) >= .65)
    return float(np.mean(scores))

def outline_support(gray,centers,radius):
    values=[]
    for x,y in centers:
        hits=[]
        for angle in np.linspace(0,2*np.pi,16,endpoint=False):
            px=round(x+radius*np.cos(angle));py=round(y+radius*np.sin(angle))
            hits.append(bool(np.any(gray[py-1:py+2,px-1:px+2]<180)))
        values.append(float(np.mean(hits)))
    return values

def recognize(image, profile):
    choices = []
    aligned_without_tracks = False
    for turns in range(4):
        rotated = np.rot90(image, turns).copy()
        try:
            aligned = normalize(rotated, profile)
            gray = cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY)
            if not timing_tracks(gray,profile):
                aligned_without_tracks = True
                continue
            registered,offsets,version_supported=register(gray,profile)
            choices.append((registration_score(gray,registered),aligned,gray,registered,offsets,version_supported))
        except (InvalidScan,ValueError):
            continue
    if not choices:
        from physical_layout import align,LayoutFailure
        try:
            normalized,gray,measured_profile,diagnostic=align(image,profile)
        except LayoutFailure as error:
            raise InvalidScan('timing_track_mismatch' if aligned_without_tracks else 'registration_failed',error.diagnostics)
        score=registration_score(gray,measured_profile)
        result=observations(normalized,gray,measured_profile,profile,score,None,True,original_region(image,diagnostic,measured_profile['qrZone']))
        result.update({'template':measured_profile['id'],'status':'REVIEW_REQUIRED','physicalValidationRequired':True,'layoutDiagnostics':diagnostic,'geometry':{key:measured_profile[key] for key in ('questions','versions','radius')}})
        return result,normalized
    score, normalized, gray, measured_profile, offsets, version_supported = max(choices, key=lambda item:item[0])
    return observations(normalized,gray,measured_profile,profile,score,offsets,version_supported),normalized

def observations(normalized,gray,measured_profile,profile,score,offsets,version_supported,original_qr=None):
    if score < profile['thresholds']['registration']:
        raise InvalidScan('template_registration_failed')
    x0,y0,x1,y1 = profile['answerZone']
    focus = float(cv2.Laplacian(gray[y0:y1,x0:x1], cv2.CV_64F).var())
    if focus < profile['thresholds']['focus']:
        raise InvalidScan('image_too_blurry')
    responses = []
    for index, centers in enumerate(measured_profile['questions']):
        original = measurements(gray, centers, profile['radius'])
        physical = measured_profile['id'] == 'AZM_FRAMED_100_LEGACY_V1'
        values, paper = paper_relative_measurements(gray, centers, profile['radius']) if physical else (original, None)
        item = classify(values, profile['thresholds'])
        if physical:
            item.update({'rawDarkness': original, 'paperReference': paper, 'measurementMethod': 'LOCAL_PAPER_P90_V1'})
        item['outlineSupport']=outline_support(gray,centers,profile['radius'])
        if paper is not None and min(paper) < 180:
            item.update({'answer':'UNCERTAIN','reviewRequired':True,'reason':'LOCAL_PAPER_REFERENCE_UNRELIABLE'})
        elif min(item['outlineSupport'])<.2:
            item.update({'answer':'UNCERTAIN','reviewRequired':True,'reason':'DAMAGED_PRINT_OR_GLARE'})
        elif item['answer']=='UNCERTAIN': item['reason']='AMBIGUOUS_INK'
        elif item['answer']=='MULTIPLE': item['reason']='MULTIPLE_MARKS'
        item['question'] = index+1
        responses.append(item)
    version = classify(measurements(gray, measured_profile['versions'], profile['radius']), profile['thresholds'])
    if not version_supported: version={'answer':'UNCERTAIN','darkness':version['darkness'],'reviewRequired':True}
    x0,y0,x1,y1 = measured_profile['qrZone']
    qr,qr_diagnostic = decode_qr(normalized[y0:y1,x0:x1])
    if original_qr is not None:
        original_text,original_diagnostic=decode_qr(original_qr)
        qr_diagnostic={'normalized':qr_diagnostic,'original':original_diagnostic}
        if qr_diagnostic['normalized'].get('reason')=='CONFLICTING_QR' or original_diagnostic.get('reason')=='CONFLICTING_QR' or (qr and original_text and qr!=original_text):
            qr='';qr_diagnostic['reason']='CONFLICTING_QR'
        elif original_text: qr=original_text
    try:
        identity = json.loads(qr)
    except (ValueError, TypeError):
        identity = None
    envelope = identity if isinstance(identity,dict) and identity.get('type')=='AZM_OMR_SIGNED' else None
    supported = isinstance(identity, dict) and identity.get('type') == 'AZM_OMR' and identity.get('sheetVersion') == 2 and identity.get('rollType') == 'OFFICIAL' and identity.get('session') == '2026-V'
    supported = supported and all(isinstance(identity.get(k),str) and 0<len(identity[k])<=128 for k in ('studentId','applicationNo','rollNumber'))
    if supported:
        identity={k:identity[k] for k in ('type','session','sheetVersion','rollType','studentId','applicationNo','rollNumber','examId') if k in identity}
    review = not supported or version['answer'] not in OPTIONS or any(r['reviewRequired'] for r in responses)
    result = {'template':profile['id'], 'status':'REVIEW_REQUIRED' if review else 'RECOGNIZED', 'responses':responses, 'paperVersion':version, 'identity':identity if supported else None, 'qrEnvelope':envelope, 'qrDiagnostics':qr_diagnostic, 'identityVerified':False, 'officialScoringAllowed':False, 'quality':{'registration':score,'focus':focus}, 'registrationOffsets':offsets, 'calibration':'SYNTHETIC_ONLY'}
    return result

def annotate(image, result, profile):
    if result.get('geometry'): profile={**profile,**result['geometry']}
    if result.get('registrationOffsets'): profile=adjusted(profile,result['registrationOffsets'])
    output = image.copy()
    for item, centers in zip(result['responses'], profile['questions']):
        for option, (x,y) in zip(OPTIONS, centers):
            color = (0,0,220) if item['reviewRequired'] else (0,150,0) if item['answer']==option else (180,130,0)
            cv2.circle(output, (round(x),round(y)), round(profile['radius']), color, 1)
    return output

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('image')
    parser.add_argument('--profile', default=str(Path(__file__).with_name('template-v2.json')))
    parser.add_argument('--annotation')
    args = parser.parse_args()
    try:
        profile = json.loads(Path(args.profile).read_text())
        result, normalized = recognize(load_image(args.image), profile)
        if args.annotation:
            ok, encoded = cv2.imencode('.png', annotate(normalized,result,profile))
            if not ok: raise InvalidScan('annotation_encoding_failed')
            flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0)
            fd=os.open(args.annotation,flags,0o600)
            with os.fdopen(fd,'wb') as output: output.write(encoded.tobytes())
        print(json.dumps(result))
    except (InvalidScan, cv2.error) as error:
        print(json.dumps({'status':'INVALID','reason':str(error) if isinstance(error,InvalidScan) else 'image_processing_failed','officialScoringAllowed':False}))
        raise SystemExit(2)
