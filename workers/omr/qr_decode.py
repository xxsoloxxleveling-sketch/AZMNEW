"""Bounded, non-generative QR retries. Decoding never establishes roster identity."""
import cv2
import numpy as np


def decode_qr(image):
    if image is None or not image.size:
        return '', {'decoded': False, 'attempts': 0, 'reason': 'EMPTY_REGION'}
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    # Limit work even when the caller supplies an original-resolution photograph.
    if max(gray.shape) > 1100:
        gray = cv2.resize(gray, None, fx=1100/max(gray.shape), fy=1100/max(gray.shape), interpolation=cv2.INTER_AREA)
    detector = cv2.QRCodeDetector()
    variants = [('gray', gray), ('contrast', cv2.createCLAHE(2.0, (8, 8)).apply(gray))]
    # Scaling changes sampling, not information. No sharpening/inpainting or guessed bits.
    if max(gray.shape) < 700:
        variants.append(('nearest2', cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST)))
    variants.append(('otsu', cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)[1]))
    payloads = set()
    attempts = 0
    detected = False
    width = None
    for name, variant in variants:
        try:
            text, points, _ = detector.detectAndDecode(cv2.copyMakeBorder(variant, 16, 16, 16, 16, cv2.BORDER_CONSTANT, value=255))
        except (cv2.error, UnicodeError):
            continue
        attempts += 1
        if points is not None:
            detected = True
            p = points.reshape(4, 2)
            width = round(float(np.mean([np.linalg.norm(p[n]-p[(n+1)%4]) for n in range(4)])) / (2 if name == 'nearest2' else 1), 2)
        if text and len(text.encode('utf-8')) <= 8192:
            payloads.add(text)
    # Distinct decodes are an ambiguity, not a reason to choose the first identity.
    safe = len(payloads) == 1
    return next(iter(payloads)) if safe else '', {'decoded': safe, 'attempts': attempts, 'detected': detected, 'symbolSidePixels': width, 'reason': 'DECODED_UNVERIFIED' if safe else 'CONFLICTING_QR' if payloads else 'QR_UNREADABLE'}


def original_region(image, diagnostic, zone):
    """Project a verified page ROI back to original camera pixels, avoiding page upsampling."""
    matrix = np.asarray(diagnostic['transform'], dtype=np.float64)
    x0, y0, x1, y1 = zone
    points = cv2.perspectiveTransform(np.float32([[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]]), np.linalg.inv(matrix))[0]
    rotated = np.rot90(image, diagnostic.get('rotation', 0)//90).copy()
    x, y, w, h = cv2.boundingRect(points)
    return rotated[max(0,y):min(rotated.shape[0],y+h), max(0,x):min(rotated.shape[1],x+w)]
