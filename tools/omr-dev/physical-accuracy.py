"""Measure physical accuracy only from explicit independent, source-matched labels."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

spec=importlib.util.spec_from_file_location('label_helper',Path(__file__).with_name('label-physical.py'))
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)


def evaluate(result, label, source_hash):
    clean=helper.validate_label(label,label['sample'])
    if label.get('sourceSha256')!=source_hash or label.get('source')!='INDEPENDENT_HUMAN_TRANSCRIPTION':raise ValueError('Source-matched independent human labels required')
    if label.get('scannerPredictionsShown') is not False or label.get('answerKeysShown') is not False or label.get('reviewerUnexposed') is not True:raise ValueError('Unblinded or unspecified exposure is not independent evidence')
    rows=result.get('responses',[])
    if len(rows)!=100 or [r['question'] for r in rows]!=list(range(1,101)):raise ValueError('Exactly 100 ordered observations required')
    judged=[(r,a) for r,a in zip(rows,clean['answers']) if a!='UNCERTAIN']
    accepted=[(r,a) for r,a in judged if not r['reviewRequired']]
    correct=sum(r['answer']==a for r,a in judged)
    false=sum(r['answer']!=a for r,a in accepted)
    return {'sample':clean['sample'],'judged':len(judged),'humanUncertain':100-len(judged),'correct':correct,'classificationAccuracy':correct/len(judged) if judged else None,'acceptedJudged':len(accepted),'falseAccepted':false,'falseAcceptanceRate':false/len(accepted) if accepted else None,'reviewRequired':sum(bool(r['reviewRequired']) for r in rows),'reviewWorkload':sum(bool(r['reviewRequired']) for r in rows)/100,'paperVersionCorrect':result['paperVersion']['answer']==clean['paperVersion'] if clean['paperVersion'] in 'ABCD' else None,'officialScoringAllowed':False}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('observation',type=Path);p.add_argument('labels',type=Path);p.add_argument('original',type=Path);a=p.parse_args()
    print(json.dumps(evaluate(json.loads(a.observation.read_text()),json.loads(a.labels.read_text()),hashlib.sha256(a.original.read_bytes()).hexdigest()),indent=2))
