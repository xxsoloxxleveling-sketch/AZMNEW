import unittest
from unittest.mock import patch
import cv2
import numpy as np
from qr_decode import decode_qr, original_region


class QrRetryTests(unittest.TestCase):
    def test_closeup_keeps_full_sheet_dimension_rejection_separate(self):
        from engine import load_image,InvalidScan
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'closeup.png';cv2.imwrite(str(source),np.full((400,400,3),255,np.uint8))
            with self.assertRaises(InvalidScan):load_image(source)
            self.assertEqual(load_image(source,minimum_side=320).shape,(400,400,3))
    def test_actual_encoded_text_is_returned_unverified(self):
        symbol=cv2.QRCodeEncoder_create().encode('SYNTHETIC-QR-ONLY')
        image=cv2.resize(symbol,None,fx=5,fy=5,interpolation=cv2.INTER_NEAREST)
        text,details=decode_qr(image)
        self.assertEqual(text,'SYNTHETIC-QR-ONLY')
        self.assertEqual(details['reason'],'DECODED_UNVERIFIED')

    def test_blank_does_not_invent_payload(self):
        self.assertEqual(decode_qr(np.full((100,100),255,np.uint8))[0],'')

    def test_conflicting_decoders_fail_closed(self):
        with patch('qr_decode.cv2.QRCodeDetector') as constructor:
            constructor.return_value.detectAndDecode.side_effect=[('first',None,None),('second',None,None),('',None,None),('',None,None)]
            text,details=decode_qr(np.full((100,100),255,np.uint8))
        self.assertEqual(text,'');self.assertEqual(details['reason'],'CONFLICTING_QR')

    def test_original_pixel_region_uses_inverse_transform(self):
        image=np.arange(100*100,dtype=np.uint8).reshape(100,100)
        region=original_region(image,{'transform':np.diag([2.,2.,1.]).tolist()},[20,30,60,70])
        self.assertEqual(region[0,0],image[15,10]);self.assertEqual(region.shape,(21,21))
