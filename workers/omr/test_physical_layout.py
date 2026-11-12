"""Fabricated framed print contracts; no private samples or answer keys."""
import unittest
import cv2
import numpy as np
from engine import recognize, InvalidScan
from test_engine import PROFILE, fixture


def framed_sheet(rows=25, camera=True):
    image=np.full((2800,1980,3),255,np.uint8)
    for x,y in PROFILE['markers']:
        cv2.rectangle(image,(round(x)-16,round(y)-16),(round(x)+16,round(y)+16),(0,0,0),-1)
    for column,left in enumerate((50,525,1000,1475)):
        cv2.rectangle(image,(left,640),(left+450,1915),(0,0,0),3)
        cv2.rectangle(image,(left,640),(left+450,677),(0,0,0),-1)
        cv2.putText(image,f'Q. {column*25+1}-{column*25+25}',(left+150,665),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),1)
        for row in range(rows):
            y=677+(row+.5)*(1915-677)/rows
            for option,x in enumerate((left+191,left+235,left+279,left+322)):
                cv2.circle(image,(round(x),round(y)),19,(0,0,0),2)
                cv2.putText(image,'ABCD'[option],(round(x)-4,round(y)+4),cv2.FONT_HERSHEY_SIMPLEX,.4,(0,0,0),1)
                if option==(column*25+row)%4: cv2.circle(image,(round(x),round(y)),16,(0,0,0),-1)
    for index,x in enumerate((1630,1710,1790,1870)):
        cv2.circle(image,(x,595),19,(0,0,0),2)
        if index==2:cv2.circle(image,(x,595),16,(0,0,0),-1)
    if camera:
        photo=np.full((1280,720,3),65,np.uint8)
        page=cv2.resize(image,(640,905),interpolation=cv2.INTER_AREA)
        page=np.uint8(page.astype(float)*.65+45)
        photo[20:925,40:680]=page
        return photo
    return image


class PhysicalLayoutTests(unittest.TestCase):
    def test_full_framed_grid_below_old_frame_quarter_is_mapped_and_reviewed(self):
        result,_=recognize(framed_sheet(),PROFILE)
        self.assertEqual(result['template'],'AZM_FRAMED_100_LEGACY_V1')
        self.assertEqual(len(result['responses']),100)
        self.assertEqual(result['status'],'REVIEW_REQUIRED')
        self.assertTrue(result['physicalValidationRequired'])
        self.assertFalse(result['officialScoringAllowed'])
        self.assertEqual(result['paperVersion']['answer'],'C')
        for response in result['responses']:
            self.assertIn(response['answer'],('UNCERTAIN','ABCD'[(response['question']-1)%4]))
        self.assertEqual([column['observedRowCount'] for column in result['layoutDiagnostics']['columns']],[25]*4)

    def test_four_corner_squares_without_numbered_grid_are_not_a_sheet(self):
        image=framed_sheet(camera=False);image[520:2000]=255
        with self.assertRaises(InvalidScan):recognize(image,PROFILE)

    def test_24_and_26_rows_cannot_be_shifted_into_100_questions(self):
        for rows in (24,26):
            with self.assertRaises(InvalidScan):recognize(framed_sheet(rows=rows),PROFILE)

    def test_partial_current_timing_track_never_enters_legacy_profile(self):
        image=fixture();x=round(3.5/210*1980);y=round(71/297*2800);image[y-12:y+13,x-12:x+13]=255
        with self.assertRaises(InvalidScan):recognize(image,PROFILE)

    def test_missing_framed_corner_and_missing_column_rejected(self):
        for region in ((slice(0,95),slice(0,95)),(slice(600,2000),slice(990,1465))):
            image=framed_sheet(camera=False);image[region]=255
            with self.assertRaises(InvalidScan):recognize(image,PROFILE)


if __name__=='__main__':unittest.main()
