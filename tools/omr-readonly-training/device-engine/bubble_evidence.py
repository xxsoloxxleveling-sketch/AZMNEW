"""Independent second-pass optical evidence for framed OMR only.

An answer can be upgraded from UNCERTAIN only if a SINGLE strongly inked
bubble dominates in three distinct spatial regions AND every weak competitor
still contains optically white paper. A uniformly light second pencil mark must
not be mistaken for a clean blank; geometry review and official grade locks are
never bypassed. This code deliberately does not use answer keys or identities.
"""
import numpy as np

OPTIONS = "ABCD"


def optical_evidence(gray, centers, radius):
    """Per-choice core, inner annulus, inner p20, std, and p90-p10 spread."""
    r = int(np.ceil(1.12*radius))
    yy, xx = np.ogrid[-r:r+1, -r:r+1]
    dist2 = xx*xx+yy*yy
    center_mask = dist2 <= (.36*radius)**2
    inner_mask = (dist2 >= (.33*radius)**2)&(dist2 <= (.60*radius)**2)
    core, inner, p20, texture, spread = [], [], [], [], []
    for center in centers:
        x,y=map(lambda t:int(round(t)), center)
        patch=gray[y-r:y+r+1,x-r:x+r+1]
        if patch.shape != (2*r+1,2*r+1):
            raise ValueError("bubble evidence patch outside page")
        darkness=(255.0-patch.astype(np.float32))/255.0
        contents=darkness[inner_mask]
        lo, hi = np.percentile(contents,(10,90))
        core.append(float(np.mean(darkness[center_mask])))
        inner.append(float(np.mean(contents)))
        p20.append(float(np.percentile(contents,20)))
        texture.append(float(np.std(contents)))
        spread.append(float(hi-lo))
    return core,inner,p20,texture,spread


def verify_dominant_fill(ring_dark, center_dark, inner_dark, inner_p20,
                         inner_std, inner_span, thresholds):
    """Return one A/B/C/D only with strong, independent evidence; else None."""
    series=(ring_dark,center_dark,inner_dark,inner_p20,inner_std,inner_span)
    if any(len(a)!=4 for a in series):
        return None
    if not np.isfinite(np.asarray(series)).all():
        return None
    try:
        if not .05<=thresholds['blank']<thresholds['filled']<=.95:
            return None
    except (KeyError,TypeError,ValueError):
        return None
    winner=int(np.argmax(ring_dark))
    others=[i for i in range(4) if i!=winner]
    if sum(v>=thresholds['filled'] for v in ring_dark)!=1:
        return None
    other_top=max(ring_dark[i] for i in others)
    if not (ring_dark[winner]>=.84 and other_top<=.38 and
            ring_dark[winner]-other_top>=.48):
        return None
    if not (inner_dark[winner]>=.78 and max(inner_dark[i] for i in others)<=.38 and
            inner_dark[winner]-max(inner_dark[i] for i in others)>=.42):
        return None
    weak=[i for i in others if ring_dark[i]>thresholds['blank']]
    if not weak:
        return None
    # A real faint pencil fill lifts the entire inner annulus. Optical noise
    # from a printed letter/outline instead leaves substantial white paper and
    # high ink-to-paper texture, not a uniform gray patch.
    if any(inner_p20[i]>.12 or inner_std[i]<.105 or inner_span[i]<.28 for i in weak):
        return None
    # Central preprinted A/B/C/D letters can be dark even in an unfilled cell.
    # Bound all cores but evaluate the winner's margin against weak competitors.
    if not (center_dark[winner]>=.78 and max(center_dark[i] for i in others)<=.76
            and center_dark[winner]-max(center_dark[i] for i in weak)>=.20):
        return None
    return OPTIONS[winner]

