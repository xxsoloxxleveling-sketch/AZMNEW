"""Conservative response classification; measurements are not probabilities."""
import math

def classify(values, thresholds):
    blank,filled=thresholds['blank'],thresholds['filled']
    if not 0<=blank<filled<=1:
        raise ValueError('invalid_thresholds')
    if len(values)!=4 or any(not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<=v<=1 for v in values):
        raise ValueError('invalid_measurements')
    strong=['ABCD'[i] for i,v in enumerate(values) if v>=filled]
    weak=any(blank<v<filled for v in values)
    if weak: answer='UNCERTAIN'
    elif len(strong)>1: answer='MULTIPLE'
    elif strong: answer=strong[0]
    else: answer='BLANK'
    return {'answer':answer,'darkness':values,'reviewRequired':answer in ('MULTIPLE','UNCERTAIN')}
