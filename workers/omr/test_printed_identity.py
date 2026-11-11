import unittest
from unittest.mock import patch
from pathlib import Path
import tempfile
import subprocess
import numpy as np
import cv2
import importlib.util
from printed_identity import canonical_roll, reconcile_reads, verify_ocr_models, read_printed_roll, recognize_crop

class PrintedIdentityTests(unittest.TestCase):
    def test_complete_roll_and_synthetic_fixture_only(self):
        self.assertEqual(canonical_roll('AZMVS-2026-9876'), 'AZMVS-2026-9876')
        self.assertEqual(canonical_roll('SYNTHETIC-OMR-0001'), 'SYNTHETIC-OMR-0001')
        for value in ['APP-2026-9876','ZMVS-2026-9876','AZMVS-2O26-9876','AZMVS-2026-9876extra']:
            self.assertIsNone(canonical_roll(value))

    def test_two_agreeing_reads_and_no_conflict_required(self):
        good=[('AZMVS-2026-9876',.95)]
        self.assertEqual(reconcile_reads([good,good])['status'],'READ_UNVERIFIED')
        self.assertIsNone(reconcile_reads([good,[]])['value'])
        self.assertIsNone(reconcile_reads([good,[('AZMVS-2026-9875',.1)]])['value'])
        self.assertIsNone(reconcile_reads([[('AZMVS-2026-9876',.89)]]*2)['value'])

    def test_missing_or_modified_model_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertFalse(verify_ocr_models(Path(folder)))
            (Path(folder)/'models').mkdir()
            (Path(folder)/'models/ch_PP-OCRv4_det_infer.onnx').write_bytes(b'not-the-model')
            self.assertFalse(verify_ocr_models(Path(folder)))

    def test_ocr_timeout_never_returns_an_identity(self):
        with patch('printed_identity.subprocess.run',side_effect=subprocess.TimeoutExpired('ocr',8)):
            self.assertIsNone(read_printed_roll(np.full((2800,1980),255,np.uint8))['value'])

    @unittest.skipUnless(importlib.util.find_spec('rapidocr_onnxruntime'), 'Install the optional pinned offline OCR bundle')
    def test_actual_offline_model_reads_fabricated_rolls_not_application_numbers(self):
        for roll in ['AZMVS-2026-9876','AZMVS-2026-4321']:
            crop=np.full((135,590,3),255,np.uint8)
            cv2.putText(crop,roll,(20,50),cv2.FONT_HERSHEY_SIMPLEX,.8,(0,0,0),2)
            cv2.putText(crop,'APP-2026-1234',(20,105),cv2.FONT_HERSHEY_SIMPLEX,.8,(0,0,0),2)
            result=recognize_crop(crop)
            self.assertEqual(result['value'],roll)
            self.assertEqual(result['status'],'READ_UNVERIFIED')

if __name__ == '__main__':unittest.main()
