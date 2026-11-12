"""Guard tests for framed, provisional OMR recovery. No grades or private photos."""
import unittest
import cv2
from test_physical_layout import framed_sheet
from test_engine import PROFILE
from engine import recognize, InvalidScan

def erase_circle(image, x, y):
    cv2.rectangle(image,(x-21,y-21),(x+21,y+21),(255,255,255),-1)

class FramedBubbleEvidenceRecoveryTests(unittest.TestCase):
    def test_extra_decoy_circles_outside_answers_do_not_reject_valid_sheet(self):
        image=framed_sheet(camera=False)
        # Top blank area is outside the four measured answer columns.
        for row in range(8):
            for col in range(14):
                cv2.circle(image,(200+col*52,180+row*48),19,(0,0,0),2)
        result,_=recognize(image,PROFILE)
        self.assertEqual(len(result['responses']),100)
        self.assertEqual(result['status'],'REVIEW_REQUIRED')
        self.assertFalse(result['officialScoringAllowed'])
        self.assertEqual(len(result['layoutDiagnostics']['columns']),4)
        self.assertTrue(all(n>=95 for n in result['layoutDiagnostics']['gridCircleProposals']))
    def test_unobserved_printed_circle_forces_uncertain_answer(self):
        image=framed_sheet(camera=False)
        erase_circle(image,241,702)
        result,_=recognize(image,PROFILE)
        self.assertEqual(len(result['responses']),100)
        self.assertEqual(result['responses'][0]['answer'],'UNCERTAIN')
        self.assertEqual(result['responses'][0]['reason'],'UNVERIFIED_PRINTED_BUBBLE_GEOMETRY')
        self.assertIn(1,result['layoutDiagnostics']['provisionalGeometryQuestions'])
        self.assertFalse(result['officialScoringAllowed'])
    def test_erasing_two_bubbles_from_same_row_does_not_fabricate_answers(self):
        image=framed_sheet(camera=False)
        for x in (241,285):erase_circle(image,x,702)
        with self.assertRaises(InvalidScan):
            recognize(image,PROFILE)
    def test_removed_corner_or_whole_column_remains_invalid(self):
        a=framed_sheet(camera=False)
        a[:95,:95]=255
        with self.assertRaises(InvalidScan):recognize(a,PROFILE)
        b=framed_sheet(camera=False)
        b[600:2000,990:1465]=255
        with self.assertRaises(InvalidScan):recognize(b,PROFILE)

if __name__=='__main__':
    unittest.main()
