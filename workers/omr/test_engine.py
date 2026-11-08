import json,unittest,time
from pathlib import Path
import cv2
import numpy as np
from engine import recognize,InvalidScan,classify

PROFILE=json.loads(Path(__file__).with_name('template-v2.json').read_text())

def fixture(answers=None, version='B', qr_payload=None):
    w,h=PROFILE['size']; image=np.full((h,w,3),255,np.uint8)
    for x,y in PROFILE['markers']:
        r=round(3/210*w); cv2.rectangle(image,(round(x)-r,round(y)-r),(round(x)+r,round(y)+r),(0,0,0),-1)
    for left in PROFILE['timingTracks']['xMm']:
        for row in range(25):
            x=round(left/210*w);y=round((70+row*5)/297*h)
            cv2.rectangle(image,(x,y),(round(x+2/210*w),round(y+2/297*h)),(0,0,0),-1)
    for n,centers in enumerate(PROFILE['questions']):
        marks=(answers or {}).get(n+1,'')
        for letter,(x,y) in zip('ABCD',centers):
            point=(round(x),round(y)); r=round(PROFILE['radius'])
            cv2.circle(image,point,r,(0,0,0),1)
            cv2.putText(image,letter,(point[0]-round(r/3),point[1]+round(r/3)),cv2.FONT_HERSHEY_SIMPLEX,.25*r/9,(0,0,0),1)
            if letter in marks: cv2.circle(image,point,r-2,(0,0,0),-1)
    for letter,(x,y) in zip('ABCD',PROFILE['versions']):
        cv2.circle(image,(round(x),round(y)),round(PROFILE['radius']),(0,0,0),1)
        if letter in version: cv2.circle(image,(round(x),round(y)),round(PROFILE['radius'])-2,(0,0,0),-1)
    payload={'type':'AZM_OMR','session':'2026-V','studentId':'SYNTHETIC-STUDENT','applicationNo':'SYNTHETIC-APP','rollNumber':'SYNTHETIC-ROLL','rollType':'OFFICIAL','sheetVersion':2}
    payload.update(qr_payload or {})
    qr=cv2.QRCodeEncoder_create().encode(json.dumps(payload,separators=(',',':')))
    x0,y0,x1,y1=PROFILE['qrZone']; size=min(x1-x0,y1-y0)-4
    qr=cv2.resize(qr,(size,size),interpolation=cv2.INTER_NEAREST)
    image[y0+2:y0+2+size,x0+2:x0+2+size]=cv2.cvtColor(qr,cv2.COLOR_GRAY2BGR)
    return image

class RecognitionTests(unittest.TestCase):
    def test_all_blank(self):
        result,_=recognize(fixture(),PROFILE)
        self.assertEqual([r['answer'] for r in result['responses']],['BLANK']*100)
        self.assertFalse(result['officialScoringAllowed'])
    def test_every_question_each_option(self):
        for option in 'ABCD':
            result,_=recognize(fixture({n:option for n in range(1,101)}),PROFILE)
            self.assertEqual([r['answer'] for r in result['responses']],[option]*100)
            self.assertEqual(result['paperVersion']['answer'],'B')
    def test_multiple_never_guessed(self):
        result,_=recognize(fixture({1:'AB',50:'CD'}),PROFILE)
        self.assertEqual(result['responses'][0]['answer'],'MULTIPLE')
        self.assertEqual(result['responses'][49]['answer'],'MULTIPLE')
        self.assertEqual(result['status'],'REVIEW_REQUIRED')
    def test_uncertain_measurements(self):
        self.assertEqual(classify([.4,0,0,0],PROFILE['thresholds'])['answer'],'UNCERTAIN')
    def test_erased_outline_never_becomes_a_confident_blank(self):
        image=fixture();x,y=PROFILE['questions'][0][0];r=round(PROFILE['radius'])+2
        image[round(y)-r:round(y)+r+1,round(x)-r:round(x)+r+1]=255
        result,_=recognize(image,PROFILE)
        self.assertEqual(result['responses'][0]['answer'],'UNCERTAIN')
        self.assertEqual(result['responses'][0]['reason'],'DAMAGED_PRINT_OR_GLARE')
    def test_missing_timing_track_rejected(self):
        image=fixture();h,w=image.shape[:2];x=round(3.5/210*w);y=round(71/297*h)
        image[y-12:y+13,x-12:x+13]=255
        with self.assertRaises(InvalidScan): recognize(image,PROFILE)
    def test_solid_spoofed_grid_rejected(self):
        image=fixture();x0,y0,x1,y1=PROFILE['answerZone'];image[y0:y1,x0:x1]=0
        with self.assertRaises(InvalidScan): recognize(image,PROFILE)
    def test_header_driven_shift_preserves_question_numbering(self):
        for shift in (-40,-80,70):
            self.assert_header_shift(shift)
    def assert_header_shift(self,shift):
        image=fixture({1:'A',100:'D'})
        # Printed header fixtures use the same two-pixel outline as the generated PDF.
        for row in PROFILE['questions']:
            for x,y in row: cv2.circle(image,(round(x),round(y)),round(PROFILE['radius']),(0,0,0),2)
        x0,y0,x1,y1=PROFILE['answerZone']
        region=image[y0:y1,x0:x1].copy();image[y0:y1,x0:x1]=255;image[y0+shift:y1+shift,x0:x1]=region
        for col in range(4):
            rows=PROFILE['questions'][col*25:(col+1)*25];r=PROFILE['radius']
            bottom=round(rows[0][0][1]-24+shift)
            cv2.rectangle(image,(round(rows[0][0][0]-4*r),bottom-round(2*r)),(round(rows[0][-1][0]+4*r),bottom),(0,0,0),-1)
            # A second dark instruction band must not be mistaken for the column header.
            cv2.rectangle(image,(round(rows[0][0][0]-4*r),bottom-70-round(r)),(round(rows[0][-1][0]+4*r),bottom-70),(0,0,0),-1)
        result,_=recognize(image,PROFILE)
        self.assertEqual(result['responses'][0]['answer'],'A')
        self.assertEqual(result['responses'][99]['answer'],'D')
        self.assertTrue(all(row['answer']=='BLANK' for row in result['responses'][1:99]))
    def test_rotation(self):
        for turns in [1,2,3]:
            result,_=recognize(np.rot90(fixture({1:'C',100:'D'}),turns).copy(),PROFILE)
            self.assertEqual(result['responses'][0]['answer'],'C')
            self.assertEqual(result['responses'][99]['answer'],'D')
    def test_perspective(self):
        image=fixture({n:'ABCD'[(n-1)%4] for n in range(1,101)})
        h,w=image.shape[:2]
        matrix=cv2.getPerspectiveTransform(np.float32([[0,0],[w,0],[w,h],[0,h]]),np.float32([[30,40],[w-10,10],[w-20,h-30],[10,h-5]]))
        transformed=cv2.warpPerspective(image,matrix,(w,h),borderValue=(255,255,255))
        result,_=recognize(transformed,PROFILE)
        self.assertEqual([r['answer'] for r in result['responses']],['ABCD'[(n-1)%4] for n in range(1,101)])
    def test_missing_marker_rejected(self):
        image=fixture(); image[:80,:80]=255
        with self.assertRaises(InvalidScan): recognize(image,PROFILE)
    def test_gray_camera_markers_keep_full_registration_checks(self):
        image=fixture({1:'A',100:'D'})
        for x,y in PROFILE['markers']:
            r=round(3/210*PROFILE['size'][0])
            cv2.rectangle(image,(round(x)-r,round(y)-r),(round(x)+r,round(y)+r),(130,130,130),-1)
        result,_=recognize(image,PROFILE)
        self.assertEqual(result['responses'][0]['answer'],'A')
        self.assertEqual(result['responses'][99]['answer'],'D')
        self.assertFalse(result['officialScoringAllowed'])
        x=round(3.5/210*PROFILE['size'][0]);y=round(71/297*PROFILE['size'][1])
        image[y-12:y+13,x-12:x+13]=255
        with self.assertRaisesRegex(InvalidScan,'timing_track_mismatch'): recognize(image,PROFILE)
    def test_blur_rejected(self):
        with self.assertRaises(InvalidScan): recognize(cv2.GaussianBlur(fixture(),(31,31),10),PROFILE)

    def test_gray_mark_requires_review(self):
        image=fixture(); x,y=PROFILE['questions'][0][0]
        cv2.circle(image,(round(x),round(y)),round(PROFILE['radius'])-2,(155,155,155),-1)
        result,_=recognize(image,PROFILE)
        self.assertEqual(result['responses'][0]['answer'],'UNCERTAIN')
    def test_multiple_paper_versions(self):
        result,_=recognize(fixture(version='AB'),PROFILE)
        self.assertEqual(result['paperVersion']['answer'],'MULTIPLE')
        self.assertEqual(result['status'],'REVIEW_REQUIRED')
    def test_missing_qr_requires_review(self):
        image=fixture(); x0,y0,x1,y1=PROFILE['qrZone']; image[y0:y1,x0:x1]=255
        result,_=recognize(image,PROFILE)
        self.assertEqual(result['status'],'REVIEW_REQUIRED')
        self.assertIsNone(result['identity'])
    def test_wrong_template_rejected(self):
        image=fixture(); x0,y0,x1,y1=PROFILE['answerZone']; image[y0:y1,x0:x1]=255
        with self.assertRaises(InvalidScan): recognize(image,PROFILE)

    def test_resolution_scale(self):
        result,_=recognize(cv2.resize(fixture({1:'D',100:'A'}),None,fx=.8,fy=.8),PROFILE)
        self.assertEqual(result['responses'][0]['answer'],'D')
        self.assertEqual(result['responses'][99]['answer'],'A')
    def test_sensor_noise(self):
        image=fixture({1:'B'})
        noise=np.random.default_rng(13).normal(0,5,image.shape)
        result,_=recognize(np.clip(image.astype(np.float32)+noise,0,255).astype(np.uint8),PROFILE)
        self.assertEqual(result['responses'][0]['answer'],'B')
        self.assertTrue(all(r['answer']=='BLANK' for r in result['responses'][1:]))

    def test_qr_identity_decodes_but_is_not_verified(self):
        result,_=recognize(fixture(),PROFILE)
        self.assertIsNotNone(result['identity'])
        self.assertEqual(result['identity']['studentId'],'SYNTHETIC-STUDENT')
        self.assertFalse(result['identityVerified'])
        self.assertFalse(result['officialScoringAllowed'])
    def test_every_paper_version(self):
        for option in 'ABCD':
            result,_=recognize(fixture(version=option),PROFILE)
            self.assertEqual(result['paperVersion']['answer'],option)
    def test_provisional_and_wrong_session_qr_require_review(self):
        for payload in [{'rollType':'PROVISIONAL'},{'session':'WRONG'},{'studentId':''}]:
            result,_=recognize(fixture(qr_payload=payload),PROFILE)
            self.assertIsNone(result['identity'])
            self.assertEqual(result['status'],'REVIEW_REQUIRED')

if __name__=='__main__': unittest.main()
