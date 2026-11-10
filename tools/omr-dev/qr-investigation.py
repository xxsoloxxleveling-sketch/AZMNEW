"""Extended private QR investigation; optional zxing-cpp is analysis-only, never a runtime dependency."""
import argparse,json
from pathlib import Path
import cv2
try:import zxingcpp
except ImportError:zxingcpp=None


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('folder',type=Path);a=p.parse_args();results=[]
    for photo in sorted(a.folder.glob('*-original-qr.png')):
        gray=cv2.imread(str(photo),cv2.IMREAD_GRAYSCALE);h,w=gray.shape
        # The second crop removes surrounding printed frames/text, never edits QR bits.
        crops=[gray,gray[int(.07*h):int(.75*h),int(.15*w):int(.92*w)]]
        found=set();attempts=0;zxing_attempts=0
        for crop in crops:
            variants=[crop,cv2.createCLAHE(2,(4,4)).apply(crop),cv2.threshold(crop,0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)[1],cv2.adaptiveThreshold(crop,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY,31,5)]
            variants += [cv2.resize(crop,None,fx=f,fy=f,interpolation=method) for f,method in [(2,cv2.INTER_NEAREST),(3,cv2.INTER_CUBIC),(4,cv2.INTER_LINEAR)]]
            for variant in variants:
                padded=cv2.copyMakeBorder(variant,24,24,24,24,cv2.BORDER_CONSTANT,value=255)
                detector=cv2.QRCodeDetector()
                for curved in [False,True]:
                    try:
                        text,_,_=detector.detectAndDecodeCurved(padded) if curved else detector.detectAndDecode(padded)
                        if text:found.add(text)
                    except (cv2.error,UnicodeError):pass
                    attempts+=1
                if zxingcpp:
                    decoded=zxingcpp.read_barcodes(padded,formats=zxingcpp.BarcodeFormat.QRCode)
                    found.update(d.text for d in decoded);zxing_attempts+=1
        row={'sample':photo.name[:3],'opencvAttempts':attempts,'alternateAttempts':zxing_attempts,'decoded':len(found)==1,'conflicting':len(found)>1}
        results.append(row);print(row,flush=True)
    (a.folder/'extended-qr-report.json').write_text(json.dumps({'alternateDecoder':getattr(zxingcpp,'__version__','zxing-cpp 2.3.0') if zxingcpp else None,'samples':results,'decoded':sum(r['decoded'] for r in results)},indent=2))


if __name__=='__main__':main()
