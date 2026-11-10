import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
import cv2
import numpy as np
spec=importlib.util.spec_from_file_location('device_evidence',Path(__file__).with_name('device-evidence.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class DeviceEvidenceTests(unittest.TestCase):
    def test_actual_source_dimensions_hash_and_unavailable_qr_are_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'synthetic-blank.png';cv2.imwrite(str(source),np.full((600,800,3),255,np.uint8))
            result=module.inspect(source,{'status':'INVALID'})
            self.assertEqual((result['width'],result['height']),(800,600))
            self.assertEqual(result['sha256'],hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertFalse(result['qrCropAvailable']);self.assertIsNone(result['independentAccuracy'])
            self.assertNotIn('identity',result)

    def test_unblinded_labels_cannot_produce_accuracy(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'synthetic-blank.png';cv2.imwrite(str(source),np.full((600,800,3),255,np.uint8))
            label=Path(folder)/'synthetic-labels.json'
            value={'sample':'S01','reviewer':'AUTOMATED TEST FIXTURE','confirmed':True,'answers':['A']*100,'paperVersion':'A','layout':'FRAMED_100','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source':'INDEPENDENT_HUMAN_TRANSCRIPTION','scannerPredictionsShown':True,'answerKeysShown':False,'reviewerUnexposed':False}
            import json
            label.write_text(json.dumps(value))
            with self.assertRaises(ValueError):module.inspect(source,{'status':'INVALID'},labels=label)
