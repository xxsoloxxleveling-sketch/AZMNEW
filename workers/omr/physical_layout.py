"""Explicit, provisional framed-sheet geometry. No keys, grades or database access."""
import copy
import itertools
import json
from pathlib import Path
import cv2
import numpy as np

SPEC = json.loads(Path(__file__).with_name('template-framed-legacy-v1.json').read_text())


class LayoutFailure(ValueError):
    def __init__(self, reason, diagnostics=None):
        super().__init__(reason)
        self.diagnostics = diagnostics or {}


def marker_proposals(gray):
    h, w = gray.shape
    proposals = []
    for fraction in (.07, .10, .13):
        block = max(31, min(151, round(fraction*w) | 1))
        for offset in (7, 11, 15):
            binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, block, offset)
            # A dark tabletop can form a closed contour around the entire page.
            # Markers inside that contour still require individual inspection.
            contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            for contour in contours:
                x, y, bw, bh = cv2.boundingRect(contour)
                if not (.6 < bw/bh < 1.6 and .012*w < bw < .065*w and np.mean(binary[y:y+bh, x:x+bw] > 0) > .85):
                    continue
                if not ((x < .25*w or x > .75*w) and (y < .35*h or y > .55*h)):
                    continue
                if x <= 0 or y <= 0 or x+bw >= w-1 or y+bh >= h-1:
                    continue
                center = [x+bw/2, y+bh/2]
                if all(np.linalg.norm(np.array(center)-p['center']) > .009*w for p in proposals):
                    proposals.append({'center': center, 'box': [x, y, bw, bh]})
    return proposals


def marker_quads(gray, proposals):
    h, w = gray.shape
    groups = [[p for p in proposals if (p['center'][0] > .75*w if right else p['center'][0] < .25*w) and (p['center'][1] > .55*h if bottom else p['center'][1] < .35*h)] for right, bottom in ((False, False), (True, False), (True, True), (False, True))]
    if any(not group for group in groups) or np.prod([len(group) for group in groups]) > 16:
        raise LayoutFailure('physical_missing_or_ambiguous_markers', {'markers': proposals})
    for chosen in itertools.product(*groups):
        points = np.float32([p['center'] for p in chosen])
        widths = [np.linalg.norm(points[1]-points[0]), np.linalg.norm(points[2]-points[3])]
        heights = [np.linalg.norm(points[3]-points[0]), np.linalg.norm(points[2]-points[1])]
        if not (cv2.isContourConvex(points) and cv2.contourArea(points) > .45*w*h and .5 < np.mean(widths)/np.mean(heights) < .9 and .75 < widths[0]/widths[1] < 1.35 and .8 < heights[0]/heights[1] < 1.25):
            continue
        yield points, chosen


def illumination(gray):
    # A 6.9 mm closing removes print smaller than the reference patch, while
    # retaining broad camera lighting gradients. No bubble-dependent black point.
    background = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, np.ones((65, 65), np.uint8))
    return cv2.divide(gray, background, scale=255)


def boundary_observations(gray, proposed):
    edges=[]
    for index,start in enumerate(proposed):
        end=proposed[(index+1)%4];vector=end-start;normal=np.array([-vector[1],vector[0]],np.float32)/np.linalg.norm(vector)
        points=[];contrasts=[]
        for fraction in np.linspace(.1,.9,25):
            center=start+fraction*vector;offsets=np.arange(-14,15,dtype=np.float32)
            probes=np.asarray(center[None,:]+offsets[:,None]*normal,dtype=np.float32)
            a=cv2.remap(gray,(probes[:,0]-normal[0]).reshape(1,-1),(probes[:,1]-normal[1]).reshape(1,-1),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE).astype(float)[0]
            b=cv2.remap(gray,(probes[:,0]+normal[0]).reshape(1,-1),(probes[:,1]+normal[1]).reshape(1,-1),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE).astype(float)[0]
            best=int(np.argmax(np.abs(a-b)));points.append(probes[best].tolist());contrasts.append(float(abs(a[best]-b[best])))
        edges.append({'points':points,'edgeSupport':float(np.mean(np.array(contrasts)>8)),'medianContrast':float(np.median(contrasts))})
    return edges


def headers(light):
    binary = np.uint8(light < 180)*255
    mask = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((3, 17), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((9, 230), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    result = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if SPEC['headerY'][0] <= y <= SPEC['headerY'][1] and SPEC['headerWidth'][0] <= w <= SPEC['headerWidth'][1] and SPEC['headerHeight'][0] <= h <= SPEC['headerHeight'][1]:
            result.append([x, y, w, h])
    result.sort()
    if len(result) != 4 or np.ptp([y for x, y, w, h in result]) > 14 or np.ptp([w for x, y, w, h in result]) > 35:
        raise LayoutFailure('physical_four_headers_required', {'headers': result})
    if any(not 10 <= result[n+1][0]-(result[n][0]+result[n][2]) <= 45 for n in range(3)):
        raise LayoutFailure('physical_column_spacing_mismatch', {'headers': result})
    return result


def runs(values):
    result = []
    start = None
    for index, value in enumerate([*values, False]):
        if value and start is None:
            start = index
        if not value and start is not None:
            result.append((start, index))
            start = None
    return result


def refine_printed_circle(gray, center):
    # Hough proposals can land on an inner edge or a printed letter. Fit only a
    # complete, nearly circular external outline; do not optimize answer darkness.
    center=[float(value) for value in center]
    x,y=map(round,center)
    margin=28
    patch=gray[y-margin:y+margin+1,x-margin:x+margin+1]
    if patch.shape!=(57,57): return list(center),False
    binary=np.uint8(patch<150)*255
    contours,_=cv2.findContours(binary,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    matches=[]
    for contour in contours:
        bx,by,bw,bh=cv2.boundingRect(contour)
        if bx<=0 or by<=0 or bx+bw>=57 or by+bh>=57 or not (29<bw<45 and 29<bh<45) or len(contour)<5: continue
        (cx,cy),(ew,eh),_=cv2.fitEllipse(contour)
        if not (.85<ew/eh<1.18 and 16<np.mean([ew,eh])/2<22 and np.hypot(cx-margin,cy-margin)<5): continue
        matches.append([float(x-margin+cx),float(y-margin+cy)])
    return (matches[0],True) if len(matches)==1 else (list(center),False)


def independent_circle_outline(light, center, radius=18.6):
    """Support around the PRINTED circumference, not the selected ink value."""
    h,w=light.shape
    x,y=center
    observations=[]
    for angle in np.linspace(0,2*np.pi,16,endpoint=False):
        px=round(x+radius*np.cos(angle))
        py=round(y+radius*np.sin(angle))
        if px<2 or py<2 or px>=w-2 or py>=h-2:
            return 0.0
        observations.append(bool(np.any(light[py-1:py+2,px-1:px+2]<180)))
    return float(np.mean(observations))


def recover_printed_circle(light, expected):
    """Low-threshold LOCAL confirmation of a previously missed Hough circle.

    A lower accumulator threshold only proposes geometry; acceptance still
    requires one circular object near the already measured row and independent
    circumference support. No bubble can be inserted based on darkness alone.
    """
    x,y=map(round,expected)
    margin=29
    patch=light[y-margin:y+margin+1,x-margin:x+margin+1]
    if patch.shape!=(2*margin+1,2*margin+1):
        return None
    proposed=cv2.HoughCircles(patch,cv2.HOUGH_GRADIENT,1,30,
                             param1=70,param2=17,minRadius=14,maxRadius=23)
    if proposed is None:
        return None
    candidates=[]
    for cx,cy,radius in proposed[0]:
        center=[float(x-margin+cx),float(y-margin+cy)]
        if (np.linalg.norm(np.asarray(center)-np.asarray(expected))<=6.5
            and 15.0<=float(radius)<=23.0
            and independent_circle_outline(light,center)>=.72):
            candidates.append(center)
    return candidates[0] if len(candidates)==1 else None


def column_grid(light, circles, header):
    x, y, w, h = header
    top = y+h-1
    lo, hi = round(top+25*SPEC['rowPitch'][0]), round(top+25*SPEC['rowPitch'][1])
    bottom_rules = runs(np.mean(light[lo:hi, x+5:x+w-5] < 220, axis=1) > .82)
    matches = []
    for first, last in bottom_rules:
        if last-first > 10:
            continue
        bottom = lo+(first+last-1)/2
        pitch = (bottom-top)/25
        # Curved paper changes the spacing relative to a single homography.
        # Count the observed rows first; never force 24/26 rows into 25 slots.
        evidence_points=sorted([p for p in circles if x+.36*w<p[0]<x+.78*w and top+10<p[1]<bottom-10],key=lambda p:p[1])
        clusters=[]
        for point in evidence_points:
            if not clusters or point[1]-np.mean([p[1] for p in clusters[-1]])>10: clusters.append([point])
            else: clusters[-1].append(point)
        clusters=[cluster for cluster in clusters if len(cluster)>=3]
        if len(clusters)!=25 or any(len(cluster)>4 for cluster in clusters): continue
        row_centers=[float(np.mean([p[1] for p in cluster])) for cluster in clusters]
        gaps=np.diff(row_centers)
        if min(gaps)<SPEC['rowPitch'][0] or max(gaps)>SPEC['rowPitch'][1]: continue
        if abs(row_centers[0]-(top+pitch/2))>8 or abs(row_centers[-1]-(bottom-pitch/2))>8: continue
        rows = []
        residuals = []
        missing = 0
        provisional_rows = []
        recovered_rows = []
        used = set()
        frame_hits = []
        for number in range(25):
            missing_before_row = missing
            expected_y = row_centers[number]
            for edge in (x, x+w-1):
                patch = light[round(expected_y)-2:round(expected_y)+3, max(0, edge-10):edge+11]
                frame_hits.append(float(np.mean(patch < 220)) > .07)
            row = []
            for fraction in SPEC['optionFractions']:
                expected_x = x+fraction*w
                candidates = [(index, p) for index, p in enumerate(circles) if abs(p[0]-expected_x) < .04*w and abs(p[1]-expected_y) < 8]
                if len(candidates) > 1:
                    row = []
                    break
                if candidates:
                    index, p = candidates[0]
                    if index in used:
                        row = []
                        break
                    used.add(index)
                    row.append([float(p[0]), float(p[1])])
                    residuals.append(abs(float(p[1])-expected_y))
                else:
                    recovery=recover_printed_circle(light,[float(expected_x), float(expected_y)])
                    if recovery is not None:
                        row.append(recovery)
                        recovered_rows.append(number)
                        residuals.append(abs(float(recovery[1])-expected_y))
                    else:
                        missing += 1
                        row.append([float(expected_x), float(expected_y)])
            if len(row) != 4:
                break
            observed = [p for p in circles if x+.36*w < p[0] < x+.78*w and abs(p[1]-expected_y) < 8]
            if len(observed) < 3 or len(observed) > 4:
                break
            row_spread = max(p[1] for p in row)-min(p[1] for p in row)
            if row_spread > 14:
                break
            if row_spread > 9 or missing > missing_before_row:
                provisional_rows.append(number)
            if any(not 32 < row[n+1][0]-row[n][0] < 55 for n in range(3)):
                break
            rows.append(row)
        if len(rows) == 25 and missing <= 6 and len(provisional_rows) <= 8 and np.mean(frame_hits) >= .94 and max(residuals, default=99) < 8:
            matches.append((rows, {'bottom': bottom, 'pitch': pitch, 'observedRowCount':len(row_centers),'minimumObservedPitch':float(min(gaps)),'maximumObservedPitch':float(max(gaps)),'missingCircleProposals': missing, 'provisionalRowIndices': provisional_rows, 'recoveredRowIndices': sorted(set(recovered_rows)), 'maximumRowResidual': max(residuals), 'frameSupport': float(np.mean(frame_hits))}))
    if len(matches) != 1:
        raise LayoutFailure('physical_row_ruler_mismatch', {'header': header, 'bottomRules': [[lo+a, lo+b] for a, b in bottom_rules], 'validMappings': len(matches)})
    return matches[0]


def layout_from_quad(image, points, chosen, base):
    dst = np.float32(base['markers'])
    matrix = cv2.getPerspectiveTransform(points, dst)
    if not np.isfinite(matrix).all():
        raise LayoutFailure('physical_invalid_transform')
    page = cv2.perspectiveTransform(np.float32([[[0, 0], [1979, 0], [1979, 2799], [0, 2799]]]), np.linalg.inv(matrix))[0]
    h, w = image.shape[:2]
    diagnostic = {'method': 'FRAMED_ROW_RULERS_V1', 'markers': points.tolist(), 'expectedMarkers': dst.tolist(), 'proposedPageBoundary': page.tolist(), 'transform': matrix.tolist()}
    diagnostic['detectedPageEdges']=boundary_observations(cv2.cvtColor(image,cv2.COLOR_BGR2GRAY),page)
    if any(px < 0 or py < 0 or px >= w or py >= h for px, py in page):
        raise LayoutFailure('physical_page_cropped', diagnostic)
    marker_sizes = []
    for proposal in chosen:
        x, y, bw, bh = proposal['box']
        warped = cv2.perspectiveTransform(np.float32([[[x, y], [x+bw, y], [x+bw, y+bh], [x, y+bh]]]), matrix)[0]
        marker_sizes.append(float(np.mean([np.linalg.norm(warped[n]-warped[(n+1)%4]) for n in range(4)])))
    diagnostic['markerWidths'] = marker_sizes
    if any(not SPEC['markerWidth'][0] <= size <= SPEC['markerWidth'][1] for size in marker_sizes):
        raise LayoutFailure('physical_marker_design_mismatch', diagnostic)
    normalized = cv2.warpPerspective(image, matrix, tuple(SPEC['size']), borderValue=(255, 255, 255))
    light = illumination(cv2.cvtColor(normalized, cv2.COLOR_BGR2GRAY))
    # A damaged current timing-track template must never become a no-track profile.
    track_samples = []
    for left in base['timingTracks']['xMm']:
        tx = round((left+1)/210*1980)
        for row in range(25):
            ty = round((71+row*5)/297*2800)
            track_samples.append(float(np.mean(light[ty-4:ty+5, tx-4:tx+5] < 160)))
    diagnostic['timingTrackDarkFractions'] = track_samples
    if sum(value > .5 for value in track_samples) > 2:
        raise LayoutFailure('physical_timing_layout_requires_its_own_profile', diagnostic)
    bars = headers(light)
    diagnostic['headers'] = bars
    # Higher accumulator threshold reduces lettering/glare decoys. Check only
    # the four known answer columns; extra circles elsewhere are not evidence.
    proposed = cv2.HoughCircles(light, cv2.HOUGH_GRADIENT, 1, 29, param1=70, param2=23, minRadius=14, maxRadius=23)
    if proposed is None:
        raise LayoutFailure('physical_circle_evidence_incomplete', diagnostic)
    circles = proposed[0]
    grid_counts = []
    for x, y, width, height in bars:
        top = y+height-1
        bottom = top+25*SPEC['rowPitch'][1]+20
        grid_counts.append(int(sum(x+.36*width < circle[0] < x+.78*width and top+10 < circle[1] < bottom for circle in circles)))
    diagnostic['gridCircleProposals'] = grid_counts
    if any(not 90 <= count <= 105 for count in grid_counts):
        raise LayoutFailure('physical_circle_evidence_incomplete', diagnostic)
    measured = copy.deepcopy(base)
    measured.update({'id': SPEC['id'], 'questions': [], 'radius': SPEC['radius'], 'qrZone': [1550, 170, 1940, 650]})
    adjusted = light.copy()
    column_evidence = []
    provisional_questions = []
    for column_index, header in enumerate(bars):
        try:
            rows, evidence = column_grid(light, circles, header)
        except LayoutFailure as error:
            raise LayoutFailure(str(error), {**diagnostic, **error.diagnostics})
        measured['questions'].extend(rows)
        provisional_questions.extend(column_index*25 + row + 1 for row in evidence['provisionalRowIndices'])
        x, y, width, height = header
        ink = float(np.percentile(light[y+4:y+height-4, x+8:x+width-8], 20))
        if not 0 <= ink <= 150:
            raise LayoutFailure('physical_print_reference_unreliable', diagnostic)
        # The black reference is exclusively printed header ink, never a response.
        patch = light[:, x:x+width].astype(np.float32)
        adjusted[:, x:x+width] = np.uint8(np.clip((patch-ink)*255/(255-ink), 0, 255))
        column_evidence.append({**evidence, 'printedInkReference': ink})
    diagnostic['columns'] = column_evidence
    measured['provisionalGeometryQuestions'] = sorted(set(provisional_questions))
    diagnostic['provisionalGeometryQuestions'] = measured['provisionalGeometryQuestions']
    refined_count=0
    for index,row in enumerate(measured['questions']):
        next_row=[]
        for center in row:
            refined,supported=refine_printed_circle(adjusted,center)
            next_row.append(refined);refined_count+=supported
        measured['questions'][index]=next_row
    diagnostic['completeOutlineRefinements']=refined_count
    last_x, last_y, last_width, last_height = bars[-1]
    versions = [p for p in circles if last_x < p[0] < last_x+last_width and last_y-100 < p[1] < last_y-25]
    versions.sort(key=lambda p: p[0])
    if len(versions) != 4 or max(p[1] for p in versions)-min(p[1] for p in versions) > 8 or any(not 65 < versions[n+1][0]-versions[n][0] < 95 for n in range(3)):
        raise LayoutFailure('physical_version_region_unverified', diagnostic)
    measured['versions'] = [refine_printed_circle(adjusted,p[:2])[0] for p in versions]
    diagnostic['versionCenters'] = measured['versions']
    return normalized, adjusted, measured, diagnostic


def align(image, base):
    accepted = []
    failures = []
    for turns in range(4):
        rotated = np.rot90(image, turns).copy()
        gray = cv2.cvtColor(rotated, cv2.COLOR_BGR2GRAY)
        proposals = marker_proposals(gray)
        try:
            quads = list(marker_quads(gray, proposals))
            if not quads:
                raise LayoutFailure('physical_marker_geometry_mismatch', {'markers': proposals})
            for points, chosen in quads:
                try:
                    mapped=layout_from_quad(rotated, points, chosen, base)
                    mapped[3]['rotation']=turns*90
                    accepted.append(mapped)
                except LayoutFailure as error:
                    failures.append({'rotation': turns*90, 'reason': str(error), **error.diagnostics})
        except LayoutFailure as error:
            failures.append({'rotation': turns*90, 'reason': str(error), **error.diagnostics})
    if len(accepted) != 1:
        raise LayoutFailure('physical_unsupported_or_ambiguous_layout', {'attempts': failures, 'acceptedMappings': len(accepted)})
    return accepted[0]
