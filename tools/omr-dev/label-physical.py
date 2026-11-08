"""Private loopback human transcription. Never loads a key or scanner predictions."""
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import secrets
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2] / 'tmp/omr-reference/human-labels'
ANSWERS = {'A', 'B', 'C', 'D', 'BLANK', 'MULTIPLE', 'UNCERTAIN'}


def validate_label(value, sample):
    if not isinstance(value, dict) or value.get('sample') != sample:
        raise ValueError('Invalid sample')
    if not isinstance(value.get('reviewer'), str) or not 3 <= len(value['reviewer'].strip()) <= 100:
        raise ValueError('Enter the human reviewer name or identifier')
    if value.get('confirmed') is not True:
        raise ValueError('Human reviewer confirmation is required')
    answers = value.get('answers')
    if not isinstance(answers, list) or len(answers) != 100 or any(answer not in ANSWERS for answer in answers):
        raise ValueError('Independently transcribe all 100 questions')
    if value.get('paperVersion') not in {'A', 'B', 'C', 'D', 'UNCERTAIN'}:
        raise ValueError('Record the visible paper version')
    if value.get('layout') not in {'FRAMED_100', 'TIMING_TRACK_100', 'UNSUPPORTED', 'UNCERTAIN'}:
        raise ValueError('Record the observed layout')
    return {key: value[key] for key in ('sample', 'reviewer', 'confirmed', 'answers', 'paperVersion', 'layout')}


HTML = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Private OMR human transcription</title>
<style>body{font:16px system-ui;margin:0;background:#f1f5f9;color:#15253d}header,section{padding:16px}header{background:#174f88;color:white}main{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{width:100%;display:block}aside{max-height:72vh;overflow:auto;background:white}label{display:block;margin:8px 0}select,input,button{font:inherit;padding:8px}button{background:#174f88;color:white;border:0;border-radius:5px;cursor:pointer}button:disabled{opacity:.5;cursor:default}.row{display:grid;grid-template-columns:55px 1fr;gap:10px;padding:5px 14px;border-bottom:1px solid #ddd}#feedback{white-space:pre-wrap}#photo{max-height:78vh;overflow:auto}#photo.zoom img{width:180%;max-width:none}@media(max-width:700px){main{grid-template-columns:1fr}aside{max-height:45vh}}</style>
<header><strong>Private human transcription</strong><p>Read the marked bubbles from the photograph. No answer key or scanner prediction is shown. This creates test evidence only, never student marks.</p></header>
<section><label>Sample <select id="sample"></select></label><span id="split"></span><button id="zoom">Toggle image zoom</button><p id="feedback" role="status"></p></section>
<main><div id="photo"><img id="image" alt="Private photograph for independent human transcription"></div><div><aside id="rows"></aside><section><label>Visible paper version <select id="version"><option value="">Select</option><option>A</option><option>B</option><option>C</option><option>D</option><option>UNCERTAIN</option></select></label><label>Observed layout <select id="layout"><option value="">Select</option><option value="FRAMED_100">Four framed columns, 25 rows each</option><option value="TIMING_TRACK_100">Timing tracks alongside 100-answer grid</option><option value="UNSUPPORTED">Other layout</option><option value="UNCERTAIN">Uncertain</option></select></label><label>Human reviewer name / identifier <input id="reviewer" maxlength="100"></label><label><input type="checkbox" id="confirm"> I personally inspected every response and the visible paper version. I did not copy an answer key or scanner output.</label><button id="save" disabled>Save independent human labels</button></section></div></main>
<script>const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);const $=id=>document.getElementById(id);let samples=[],answers=Array(100).fill('');const opts=['','A','B','C','D','BLANK','MULTIPLE','UNCERTAIN'];const headers={'X-OMR-Label-Token':token};async function request(url,options={}){const response=await fetch(url,{...options,headers:{...headers,...options.headers},cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data}function ready(){$('save').disabled=answers.some(a=>!a)||!$('version').value||!$('layout').value||$('reviewer').value.trim().length<3||!$('confirm').checked}function render(){$('rows').replaceChildren();answers.forEach((value,index)=>{const row=document.createElement('label');row.className='row';const title=document.createElement('span');title.textContent=`Q. ${index+1}`;const select=document.createElement('select');select.setAttribute('aria-label',`Question ${index+1}`);opts.forEach(answer=>{const option=document.createElement('option');option.value=answer;option.textContent=answer||'Select observed mark';select.append(option)});select.value=value;select.onchange=()=>{answers[index]=select.value;$('confirm').checked=false;ready()};row.append(title,select);$('rows').append(row)});ready()}async function load(){answers=Array(100).fill('');$('confirm').checked=false;$('version').value='';$('layout').value='';const id=$('sample').value;$('feedback').textContent='';$('split').textContent=samples.find(s=>s.id===id).split;const response=await fetch(`/image/${id}`,{headers,cache:'no-store'});if(!response.ok)throw Error('Private image unavailable');if($('image').src.startsWith('blob:'))URL.revokeObjectURL($('image').src);$('image').src=URL.createObjectURL(await response.blob());const existing=await request(`/labels/${id}`);if(existing){answers=existing.answers;$('version').value=existing.paperVersion;$('layout').value=existing.layout;$('reviewer').value=existing.reviewer;$('feedback').textContent='Existing human transcription loaded. Saving creates a new preserved revision.'}render()}$('sample').onchange=()=>load().catch(e=>$('feedback').textContent=e.message);$('zoom').onclick=()=>$('photo').classList.toggle('zoom');['version','layout','reviewer','confirm'].forEach(id=>$(id).addEventListener('input',ready));$('save').onclick=async()=>{try{$('save').disabled=true;await request(`/labels/${$('sample').value}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sample:$('sample').value,answers,paperVersion:$('version').value,layout:$('layout').value,reviewer:$('reviewer').value.trim(),confirmed:$('confirm').checked})});$('feedback').textContent='Saved as private human test evidence. No examination result was created.'}catch(e){$('feedback').textContent=e.message}finally{ready()}};request('/samples').then(data=>{samples=data;samples.forEach(sample=>{const option=document.createElement('option');option.value=sample.id;option.textContent=sample.id;$('sample').append(option)});return load()}).catch(e=>$('feedback').textContent=e.message);</script></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    parser.add_argument('--port', type=int, default=5060)
    args = parser.parse_args()
    files = sorted(path for path in args.folder.iterdir() if path.suffix.lower() in {'.jpg', '.jpeg', '.png'})
    if not 1 <= len(files) <= 100:
        raise ValueError('Choose a private folder containing 1–100 images')
    samples = {f'S{index:02d}': path.resolve() for index, path in enumerate(files, 1)}
    token = secrets.token_urlsafe(32)
    origin = f'http://127.0.0.1:{args.port}'
    ROOT.mkdir(parents=True, exist_ok=True)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def send(self, status, body, content_type='application/json'):
            self.send_response(status)
            for name, value in {'Content-Type': content_type, 'Content-Length': str(len(body)), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"}.items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(body)

        def dispatch(self):
            if self.headers.get('Host') != f'127.0.0.1:{args.port}':
                return self.send(403, b'{"error":"Local host required"}')
            if self.command == 'GET' and self.path == '/':
                return self.send(200, HTML.encode(), 'text/html; charset=utf-8')
            if not secrets.compare_digest(self.headers.get('X-OMR-Label-Token', ''), token):
                return self.send(403, b'{"error":"Open the private launcher link"}')
            if self.command == 'GET' and self.path == '/samples':
                return self.send(200, json.dumps([{'id': sample, 'split': 'heldout' if index > 18 else 'calibration'} for index, sample in enumerate(samples, 1)]).encode())
            kind, _, sample = self.path.lstrip('/').partition('/')
            if sample not in samples or kind not in {'image', 'labels'}:
                return self.send(404, b'{"error":"Unknown sample"}')
            if self.command == 'GET' and kind == 'image':
                source = samples[sample]
                return self.send(200, source.read_bytes(), 'image/png' if source.suffix.lower() == '.png' else 'image/jpeg')
            target = ROOT / f'{sample}.json'
            if self.command == 'GET':
                if target.exists():
                    previous=json.loads(target.read_text())
                    if previous.get('sourceSha256')!=hashlib.sha256(samples[sample].read_bytes()).hexdigest():
                        return self.send(409,b'{"error":"Saved labels belong to a different source photograph"}')
                return self.send(200, target.read_bytes() if target.exists() else b'null')
            if kind != 'labels' or self.headers.get('Origin') != origin or self.headers.get_content_type() != 'application/json':
                return self.send(403, b'{"error":"Local labeling form required"}')
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 1 <= length <= 16384:
                    raise ValueError('Invalid label size')
                value = validate_label(json.loads(self.rfile.read(length)), sample)
                value.update({'sourceSha256': hashlib.sha256(samples[sample].read_bytes()).hexdigest(), 'source': 'INDEPENDENT_HUMAN_TRANSCRIPTION', 'scannerPredictionsShown': False, 'answerKeysShown': False, 'confirmedAt': datetime.now(timezone.utc).isoformat()})
                encoded = json.dumps(value, indent=2).encode()
                history = ROOT / f'{sample}-{secrets.token_hex(8)}.json'
                history.write_bytes(encoded)
                temporary = ROOT / f'{sample}-{secrets.token_hex(8)}.tmp'
                temporary.write_bytes(encoded)
                temporary.replace(target)
                return self.send(200, b'{"saved":true}')
            except (ValueError, TypeError, json.JSONDecodeError):
                return self.send(400, b'{"error":"Enter all 100 observed responses, paper version, layout and human confirmation"}')

        def do_GET(self):
            self.dispatch()

        def do_POST(self):
            self.dispatch()

    print(f'Private human labeling: {origin}/#{token}', flush=True)
    print('No answer key or prediction is loaded. Only a human may confirm ground truth.', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()


if __name__ == '__main__':
    main()
