"""Export the existing independent-label form as a portable private HTML file.

No scanner output or answer keys are read. Give this file to an unexposed reviewer.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
from pathlib import Path

spec=importlib.util.spec_from_file_location('label_helper',Path(__file__).with_name('label-physical.py'))
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)


def export(folder, target, selected):
    files=sorted(p for p in folder.iterdir() if p.suffix.lower() in {'.jpg','.jpeg','.png'})
    if selected==['ALL']:selected=[f'S{index:02d}' for index in range(1,len(files)+1)]
    if not selected:raise ValueError('No original photos are available to label')
    samples=[]
    for index,photo in enumerate(files,1):
        sample=f'S{index:02d}'
        if sample not in selected:continue
        raw=photo.read_bytes()
        samples.append({'id':sample,'split':'heldout' if index>18 else 'calibration','sha256':hashlib.sha256(raw).hexdigest(),'image':'data:'+('image/png' if photo.suffix.lower()=='.png' else 'image/jpeg')+';base64,'+base64.b64encode(raw).decode()})
    if {s['id'] for s in samples}!=set(selected):raise ValueError('Some selected photos are missing')
    script='''const samples=DATA;const $=id=>document.getElementById(id);let answers=Array(100).fill('');
const options=['','A','B','C','D','BLANK','MULTIPLE','UNCERTAIN'];
function ready(){$('save').disabled=answers.some(a=>!a)||!$('version').value||!$('layout').value||$('reviewer').value.trim().length<3||!$('confirm').checked}
function load(){answers=Array(100).fill('');$('version').value='';$('layout').value='';$('confirm').checked=false;const sample=samples.find(s=>s.id===$('sample').value);$('image').src=sample.image;$('split').textContent='Read the original photograph. Do not consult predictions or an answer key.';$('rows').replaceChildren();answers.forEach((_,i)=>{const row=document.createElement('label');row.className='row';const text=document.createElement('span');text.textContent='Q. '+(i+1);const select=document.createElement('select');select.setAttribute('aria-label','Question '+(i+1));options.forEach(a=>{const option=document.createElement('option');option.value=a;option.textContent=a||'Select observed mark';select.append(option)});select.onchange=()=>{answers[i]=select.value;$('confirm').checked=false;ready()};row.append(text,select);$('rows').append(row)});ready()}
$('sample').onchange=load;$('zoom').onclick=()=>$('photo').classList.toggle('zoom');['version','layout','reviewer','confirm'].forEach(id=>$(id).addEventListener('input',ready));
$('save').textContent='Download independent labels';$('save').onclick=()=>{ready();if($('save').disabled)return;const sample=samples.find(s=>s.id===$('sample').value);const labels={sample:sample.id,reviewer:$('reviewer').value.trim(),confirmed:true,answers,paperVersion:$('version').value,layout:$('layout').value,sourceSha256:sample.sha256,source:'INDEPENDENT_HUMAN_TRANSCRIPTION',scannerPredictionsShown:false,answerKeysShown:false,reviewMethod:'PORTABLE_BLIND_FORM',reviewerUnexposed:true,confirmedAt:new Date().toISOString()};const url=URL.createObjectURL(new Blob([JSON.stringify(labels,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=sample.id+'-human-labels.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('feedback').textContent='Labels downloaded. Return the JSON file privately. No marks were changed.'};
samples.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.id;$('sample').append(o)});load();'''.replace('DATA',json.dumps(samples))
    html=helper.HTML.split('<script>')[0].replace('I personally inspected every response and the visible paper version. I did not copy an answer key or scanner output.','I personally inspected every response and the version. I have not seen scanner predictions or answer keys for these sheets and did not copy them.')
    target.parent.mkdir(parents=True,exist_ok=True)
    html=html.replace('<title>', '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; base-uri \'none\'"><title>')
    target.write_text(html+'<script>'+script+'</script></html>',encoding='utf-8')
    return len(samples)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('folder',type=Path);parser.add_argument('output',type=Path);parser.add_argument('--samples',default='S01,S07,S13,S19,S20,S23');args=parser.parse_args()
    print('Exported',export(args.folder,args.output,args.samples.split(',')),'private blind forms; no predictions or keys loaded')
