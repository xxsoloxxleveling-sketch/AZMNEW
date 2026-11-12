"""Refine content placement using physical timing tracks and printed column headers."""
import copy
import math
import cv2
import numpy as np

def timing_tracks(gray,profile):
    h,w=gray.shape
    track=profile['timingTracks']
    for left in track['xMm']:
        x=round((left+1)/210*w)
        for row in range(track['count']):
            y=round((track['topMm']+1+row*track['pitchMm'])/297*h)
            if np.mean(gray[y-2:y+3,x-2:x+3]<125)<.9: return False
    return True

def header_candidates(gray,rows,radius):
    first=rows[0]
    x0=max(0,math.floor(min(x for x,y in first)-4*radius))
    x1=min(gray.shape[1],math.ceil(max(x for x,y in first)+4*radius))
    center=float(np.mean([y for x,y in first]))
    pitch=float(np.median([rows[n+1][0][1]-rows[n][0][1] for n in range(len(rows)-1)]))
    expected_bottom=center-pitch/2
    # Search the entire header rectangle, including its height. Cropping only around
    # the bubble centers truncated a valid Linux-rendered header before it could be detected.
    y0=max(0,round(expected_bottom-6*radius-4*radius))
    y1=min(gray.shape[0],round(expected_bottom+6*radius+1))
    filled=np.mean(gray[y0:y1,x0:x1]<125,axis=1)>.82
    filled=cv2.morphologyEx(np.uint8(filled)[:,None],cv2.MORPH_CLOSE,np.ones((round(radius*1.2),1),np.uint8)).ravel()>0
    runs=[];start=None
    for index,value in enumerate([*filled,False]):
        if value and start is None: start=index
        if not value and start is not None:
            if .7*radius<=index-start<=4*radius: runs.append(y0+index-1)
            start=None
    return runs

def refine(gray,centers,radius,dy):
    x0=math.floor(min(x for x,y in centers)-radius-3);x1=math.ceil(max(x for x,y in centers)+radius+3)
    y0=math.floor(min(y for x,y in centers)-radius-3);y1=math.ceil(max(y for x,y in centers)+radius+3)
    margin=round(radius*.65)
    sx=max(0,x0-8);sy=max(0,y0+round(dy)-margin)
    ex=min(gray.shape[1],x1+8);ey=min(gray.shape[0],y1+round(dy)+margin)
    mask=np.zeros((y1-y0,x1-x0),np.uint8)
    for x,y in centers: cv2.circle(mask,(round(x)-x0,round(y)-y0),round(radius),255,2)
    source=np.uint8(gray[sy:ey,sx:ex]<180)*255
    if source.shape[0]<mask.shape[0] or source.shape[1]<mask.shape[1]: return (0,0),0
    scores=cv2.matchTemplate(source,mask,cv2.TM_CCORR_NORMED,mask=mask)
    scores=np.nan_to_num(scores,nan=0,posinf=0,neginf=0)
    _,score,_,location=cv2.minMaxLoc(scores)
    return (sx+location[0]-x0,sy+location[1]-y0),score*score

def boundary_support(gray,centers,radius,offset):
    # First and last rows reject a whole-row alias even if most intermediate circles align.
    dx,dy=offset;values=[]
    for x,y in centers:
        hits=[]
        for angle in np.linspace(0,2*np.pi,16,endpoint=False):
            px=round(x+dx+radius*np.cos(angle));py=round(y+dy+radius*np.sin(angle))
            hits.append(bool(np.any(gray[py-1:py+2,px-1:px+2]<180)))
        values.append(np.mean(hits))
    return float(np.median(values))

def adjusted(profile,offsets):
    result=copy.deepcopy(profile)
    for index,row in enumerate(result['questions']):
        dx,dy=offsets['columns'][index//25]
        result['questions'][index]=[[x+dx,y+dy] for x,y in row]
    dx,dy=offsets['version']
    result['versions']=[[x+dx,y+dy] for x,y in result['versions']]
    return result

def register(gray,profile):
    headers_present=False
    radius=profile['radius'];offsets={'columns':[],'version':[0,0]}
    for col in range(4):
        rows=profile['questions'][col*25:(col+1)*25]
        candidates=header_candidates(gray,rows,radius)
        if not candidates:
            offsets['columns'].append([0,0]);continue
        headers_present=True
        pitch=float(np.median([rows[n+1][0][1]-rows[n][0][1] for n in range(24)]))
        expected=profile.get('registrationAnchors',{}).get('headerBottom',[None]*4)[col]
        if expected is None: expected=rows[0][0][1]-pitch/2
        matches={}
        for bottom in candidates:
            shift=bottom-expected
            if abs(shift)>6*radius: continue
            offset,support=refine(gray,[center for row in rows for center in row],radius,shift)
            if support<.5: continue
            if min(boundary_support(gray,row,radius,offset) for row in (rows[0],rows[-1]))<.8: continue
            matches[offset]=support
        if len(matches)!=1: raise ValueError('ambiguous_column_registration')
        offset=next(iter(matches))
        offsets['columns'].append(list(offset))
    shift=float(np.median([offset[1] for offset in offsets['columns']]))
    version,support=refine(gray,profile['versions'],radius,shift) if headers_present else ((0,0),1.0)
    offsets['version']=list(version) if support>=.5 else [0,round(shift)]
    result=adjusted(profile,offsets)
    # Check paper surrounding bubbles as well as ink edges, rejecting solid/spoofed grids.
    background=[]
    for row in result['questions']:
        for x,y in row:
            for direction in [-1,1]:
                py=round(y+direction*1.3*radius);px=round(x)
                background.append(gray[py,px]>180)
    if np.mean(background)<.6: raise ValueError('invalid_grid_background')
    # Broad enough for supported text wrapping; identity still requires exact DB reconciliation.
    h,w=gray.shape;result['qrZone']=[round(.79*w),round(.07*h),round(.97*w),round(.235*h)]
    return result,offsets,support>=.5
