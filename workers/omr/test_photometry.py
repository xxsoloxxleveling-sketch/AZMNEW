"""Fabricated optical evidence: darkness and faint competing marks stay distinct."""
import unittest
import cv2
import numpy as np
from engine import paper_relative_measurements, measurements, InvalidScan
from responses import classify

T = {'blank': .18166873157024382, 'filled': .6817600622773171}

def row(paper=220, marks=None):
    image = np.full((100, 240), paper, np.uint8)
    centers = [(40+50*i, 50) for i in range(4)]
    for i, center in enumerate(centers):
        cv2.circle(image, center, 19, 0, 2)
        if i in (marks or {}): cv2.circle(image, center, 16, marks[i], -1)
    return image, centers

class PaperReferenceTests(unittest.TestCase):
    def test_gray_paper_is_not_ink(self):
        image, centers = row(paper=190, marks={0: 10})
        self.assertEqual(classify(measurements(image, centers, 18.6), T)['answer'], 'UNCERTAIN')
        values, white = paper_relative_measurements(image, centers, 18.6)
        self.assertEqual(classify(values, T)['answer'], 'A')
        self.assertEqual(white, [190]*4)

    def test_real_faint_competing_mark_still_requires_review(self):
        for secondary in (100, 150):
            image, centers = row(marks={0: 10, 1: secondary})
            values, _ = paper_relative_measurements(image, centers, 18.6)
            self.assertEqual(classify(values, T)['answer'], 'UNCERTAIN')

    def test_multiple_blank_and_partial_marks_remain_distinct(self):
        for marks, expected in [({}, 'BLANK'), ({0: 10, 3: 20}, 'MULTIPLE'), ({2: 120}, 'UNCERTAIN')]:
            image, centers = row(marks=marks)
            values, _ = paper_relative_measurements(image, centers, 18.6)
            self.assertEqual(classify(values, T)['answer'], expected)

    def test_reference_does_not_follow_answer_darkness(self):
        for ink in (0, 80, 150, 220):
            image, centers = row(marks={0: ink})
            _, white = paper_relative_measurements(image, centers, 18.6)
            self.assertEqual(white, [220]*4)

    def test_cropped_reference_rejected(self):
        with self.assertRaises(InvalidScan):paper_relative_measurements(np.full((40,40),255,np.uint8), [(1,1)], 18.6)

if __name__ == '__main__':unittest.main()
