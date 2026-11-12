"""Security contracts; fixtures never opt an HTTP worker out of its PDF sandbox."""
import unittest,tempfile
from pathlib import Path
from unittest.mock import patch
from engine import InvalidScan
from pdf_input import inspect_pdf,render_pdf,_run
class PdfTests(unittest.TestCase):
    def test_invalid_signature_precedes_external_parser(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'input.pdf';source.write_bytes(b'not a PDF')
            with patch('pdf_input._run') as runner:
                with self.assertRaisesRegex(InvalidScan,'invalid_pdf_signature'): inspect_pdf(source)
                runner.assert_not_called()
    def test_page_limits_encryption_and_requested_page(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'input.pdf';source.write_bytes(b'%PDF-1.7\n')
            for metadata,reason in [('Pages: 26\nEncrypted: no','pdf_page_limit'),('Pages: 1\nEncrypted: yes','encrypted_pdf'),('not metadata','pdf_page_limit')]:
                with patch('pdf_input._run',return_value=metadata):
                    with self.assertRaisesRegex(InvalidScan,reason): inspect_pdf(source)
            with patch('pdf_input._run',return_value='Pages: 2\nEncrypted: no'):
                with self.assertRaisesRegex(InvalidScan,'invalid_pdf_page'): render_pdf(source,3)
    def test_untrusted_windows_pdf_refuses_unsandboxed_parser(self):
        with patch('pdf_input.sys.platform','win32'),patch.dict('os.environ',{'OMR_TRUSTED_PDF_FIXTURE':''}),patch('pdf_input.shutil.which',return_value='C:/synthetic/pdfinfo.exe'):
            with self.assertRaisesRegex(InvalidScan,'pdf_sandbox_unavailable'): _run('pdfinfo',[],Path('C:/synthetic'))
    def test_linux_pdf_requires_bubblewrap(self):
        with patch('pdf_input.sys.platform','linux'),patch('pdf_input.shutil.which',side_effect=['/usr/bin/pdfinfo',None]):
            with self.assertRaisesRegex(InvalidScan,'pdf_sandbox_unavailable'): _run('pdfinfo',[],Path('/tmp/synthetic'))
