"""Bounded PDF rendering. Untrusted PDFs require Linux bubblewrap isolation."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from engine import InvalidScan, MAX_BYTES

def _limits():
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3))
    resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
    resource.setrlimit(resource.RLIMIT_FSIZE, (32*1024**2, 32*1024**2))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64,64))

def _run(binary, arguments, folder):
    executable=shutil.which(binary)
    if not executable: raise InvalidScan('pdf_renderer_unavailable')
    executable=str(Path(executable).resolve())
    environment={key:os.environ[key] for key in ('PATH','SYSTEMROOT','WINDIR') if key in os.environ}
    environment.update({'HOME':'/tmp','TMPDIR':'/tmp','LC_ALL':'C'})
    command=[executable,*arguments]
    if sys.platform.startswith('linux'):
        sandbox=shutil.which('bwrap')
        if not sandbox: raise InvalidScan('pdf_sandbox_unavailable')
        translated=[str(v).replace(str(folder),'/work') for v in arguments]
        command=[sandbox,'--unshare-all','--die-with-parent','--new-session','--ro-bind','/usr','/usr','--ro-bind','/lib','/lib']
        if Path('/lib64').exists(): command+=['--ro-bind','/lib64','/lib64']
        if Path('/etc/fonts').exists(): command+=['--ro-bind','/etc/fonts','/etc/fonts']
        command+=['--proc','/proc','--dev','/dev','--tmpfs','/tmp','--bind',str(folder),'/work','--chdir','/work',executable,*translated]
    elif os.environ.get('OMR_TRUSTED_PDF_FIXTURE')!='1':
        raise InvalidScan('pdf_sandbox_unavailable')
    try:
        completed=subprocess.run(command,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
            timeout=25,check=True,env=environment,preexec_fn=_limits if os.name=='posix' else None)
        if len(completed.stdout)>1024*1024: raise InvalidScan('pdf_metadata_too_large')
        return completed.stdout.decode('utf8','replace')
    except (subprocess.SubprocessError,OSError): raise InvalidScan('pdf_processing_failed')

def inspect_pdf(source):
    source=Path(source).resolve()
    if source.stat().st_size>MAX_BYTES: raise InvalidScan('oversized_pdf')
    with source.open('rb') as stream:
        if not stream.read(8).startswith(b'%PDF-'): raise InvalidScan('invalid_pdf_signature')
    metadata=_run('pdfinfo',[str(source)],source.parent)
    pages=re.search(r'^Pages:\s+(\d+)',metadata,re.M)
    if not pages or not 1<=int(pages.group(1))<=25: raise InvalidScan('pdf_page_limit')
    if re.search(r'^Encrypted:\s+yes',metadata,re.M): raise InvalidScan('encrypted_pdf')
    return int(pages.group(1))

def render_pdf(source,page):
    source=Path(source).resolve()
    count=inspect_pdf(source)
    if not 1<=page<=count: raise InvalidScan('invalid_pdf_page')
    target=source.parent/('rendered-page-'+str(page))
    _run('pdftoppm',['-f',str(page),'-l',str(page),'-scale-to','2800','-singlefile','-png',str(source),str(target)],source.parent)
    image=target.with_suffix('.png')
    if not image.exists() or image.stat().st_size>MAX_BYTES: raise InvalidScan('invalid_rendered_page')
    return image
