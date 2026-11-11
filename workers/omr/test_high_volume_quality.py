"""100-question pilot fixtures: no unverified bubbles promoted into official marks.

Synthetic rendering only, not a physical throughput/accuracy acceptance dataset.
"""
import unittest
import cv2
from engine import recognize
from test_engine import PROFILE
from test_physical_layout import framed_sheet

class HighVolumeOpticalSafety(unittest.TestCase):
    def test_printed_100_answer_fixture_has_zero_false_or_flagged_answers(self):
        for camera in (False,True):
            with self.subTest(camera=camera):
                result,_=recognize(framed_sheet(camera=camera),PROFILE)
                self.assertEqual(len(result['responses']),100)
                self.assertEqual(sum(bool(r['reviewRequired']) for r in result['responses']),0)
                for response in result['responses']:
                    self.assertEqual(response['answer'],'ABCD'[(response['question']-1)%4])
                self.assertFalse(result['officialScoringAllowed'])
                self.assertTrue(result['physicalValidationRequired'])

    def test_full_faint_second_marks_are_not_silently_ignored(self):
        for shade in (165,185):
            with self.subTest(gray=shade):
                image=framed_sheet(camera=False)
                cv2.circle(image,(285,702),16,(shade,shade,shade),-1)
                result,_=recognize(image,PROFILE)
                self.assertEqual(result['responses'][0]['answer'],'UNCERTAIN')
                self.assertTrue(result['responses'][0]['reviewRequired'])
                self.assertFalse(result['officialScoringAllowed'])

    def test_obvious_double_mark_keeps_multiple_state(self):
        img=framed_sheet(camera=False)
        cv2.circle(img,(285,702),16,(0,0,0),-1)
        result,_=recognize(img,PROFILE)
        self.assertEqual(result['responses'][0]['answer'],'MULTIPLE')
        self.assertTrue(result['responses'][0]['reviewRequired'])
        self.assertFalse(result['officialScoringAllowed'])

if __name__=='__main__':unittest.main()
