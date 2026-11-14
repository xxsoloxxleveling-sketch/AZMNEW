"""Synthetic browser smoke for AZM.AIO ExamScan. No connection to real backend."""
from __future__ import annotations
import json, subprocess, time, os, re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests' / 'screenshots'
OUT.mkdir(exist_ok=True)
TOKEN = 'qr_synthetic-123_1794650000000.' + 'a'*64
names = {'s1': ('Aisha Example','EXM-0001','A-01'), 's2':('Bilal Example','EXM-0002','A-02')}
state = {'role':'TEACHER','marked':{},'calls':[],'scanned':0,'closed':False,'candidatePage':1}

def response(route, data, status=200):
    return {'status':status,'payload':{'success':True,'data':data}}

def session():
    count=sum(1 for x in state['marked'].values() if x=='PRESENT')
    absent=sum(1 for x in state['marked'].values() if x=='ABSENT')
    return {'id':'synthetic-hall-s1','examHallId':'synthetic-hall','status':'CLOSED' if state['closed'] else 'OPEN',
            'isCurrent':True,'revision':5,'attemptNumber':1,'businessDate':'2026-11-15T00:00:00.000Z',
            'hallNameSnapshot':'Hall A — Synthetic Exam','roomNumberSnapshot':'Room A-11','testCenterNameSnapshot':'Test Center North',
            'stats':{'expectedCount':2,'presentCount':count,'markedCount':count+absent,'absentCount':absent,'lateCount':0,
                     'unmarkedCount':2-count-absent,'completionPercentage':(count+absent)*50,
                     'qrCount':state['scanned'],'manualCount':max(0,count-state['scanned'])}}

def candidates():
    return [{'studentId':sid,'fullNameSnapshot':name,'rollNumberSnapshot':roll,'applicationNoSnapshot':f'APP-{sid}',
             'currentClassSnapshot':'Class 9th','seatNoSnapshot':seat,'status':state['marked'].get(sid,'NOT_MARKED'),
             'method':('QR_SCAN' if sid=='s1' else 'MANUAL') if sid in state['marked'] else None,
             'markedAt':'2026-11-14T09:02:15.000Z' if sid in state['marked'] else None} for sid,(name,roll,seat) in names.items()]

def handler(url, request):
    parsed=urlparse(url)
    path=parsed.path
    parsed_body=json.loads(request.get('body') or '{}') if request.get('body') else None
    state['calls'].append({'path':path,'method':request.get('method','GET'),'payload':parsed_body,
                           'auth':request.get('headers',{}).get('Authorization')})
    if path=='/api/auth/login':
        user={'id':'staff-1','name':'Test Invigilator','email':'test@example.invalid','role':state['role'],'status':'ACTIVE'}
        return response(None,{'accessToken':'synthetic-access','refreshToken':'synthetic-refresh','user':user})
    elif path=='/api/auth/me':
        return response(None,{'user':{'id':'staff-1','name':'Test Invigilator','email':'test@example.invalid','role':state['role'],'status':'ACTIVE'}})
    elif path=='/api/auth/refresh':
        return response(None,{'accessToken':'synthetic-access-2','refreshToken':'synthetic-refresh-2'})
    elif path=='/api/attendance/sessions':
        return response(None,{'sessions':[session()],'pagination':{'page':1,'total':1,'totalPages':1}})
    elif path=='/api/attendance/sessions/synthetic-hall-s1':
        return response(None,{'session':session(),'stats':session()['stats'],'roster':candidates()})
    elif path=='/api/attendance/sessions/synthetic-hall-s1/candidates':
        result=candidates()
        query=parse_qs(parsed.query).get('search',[''])[0].lower()
        if query: result=[c for c in result if query in ' '.join((c['fullNameSnapshot'],c['rollNumberSnapshot'],c['seatNoSnapshot'])).lower()]
        return response(None,{'candidates':result,'pagination':{'page':1,'totalPages':1,'total':len(result)}})
    elif path=='/api/attendance/scan':
        incoming=parsed_body
        if incoming!={'sessionId':'synthetic-hall-s1','revision':5,'qrToken':TOKEN,'status':'PRESENT'}:
            return {'status':400,'payload':{'success':False,'error':{'message':'Unexpected QR request'}}}
        already='s1' in state['marked']
        if not already: state['marked']['s1']='PRESENT';state['scanned']+=1
        return response(None,{'attendance':{'id':'mark-s1','status':'PRESENT','method':'QR_SCAN'},
                       'student':{'id':'s1','fullName':'Aisha Example','rollNumber':'EXM-0001','currentClass':'Class 9th'},
                       'alreadyMarked':already,'message':'Already marked' if already else 'Marked'},200 if already else 201)
    elif path=='/api/attendance/sessions/synthetic-hall-s1/mark':
        incoming=parsed_body
        assert incoming=={'revision':5,'studentId':'s2','status':'PRESENT'}, incoming
        state['marked']['s2']='PRESENT'
        return response(None,{'attendance':{'id':'mark-s2','status':'PRESENT','method':'MANUAL'},'student':{'id':'s2','fullName':'Bilal Example','rollNumber':'EXM-0002','currentClass':'Class 9th'}},201)
    elif path=='/api/attendance/sessions/synthetic-hall-s1/close':
        state['closed']=True
        return response(None,{'session':session(),'stats':session()['stats'],'roster':candidates()})
    elif path=='/api/health':
        return {'status':200,'payload':{'status':'ok','database':{'status':'connected'}}}
    else:
        return {'status':404,'payload':{'success':False,'error':{'message':'Undeclared fixture endpoint'}}}

def bundle_harness():
    source='\n'.join((ROOT/name).read_text(encoding='utf-8') for name in ['api.js','camera.js','ui.js','app.js'])
    source=re.sub(r"^import .*? from ['\"].*?['\"];?$",'',source,flags=re.MULTILINE)
    source=re.sub(r'^export (?=(?:class|const|function|async function))','',source,flags=re.MULTILINE)
    css=(ROOT/'styles.css').read_text(encoding='utf-8')
    shim="""
      window.AZM_ATTENDANCE_CONFIG={apiOrigin:'https://example.invalid'};
      Object.defineProperty(window,'isSecureContext',{value:true,configurable:true});
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){},getCapabilities:()=>({torch:false})}]})}});
      Object.defineProperty(HTMLMediaElement.prototype,'readyState',{get(){return 4},configurable:true});
      Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{get(){return this._syntheticSrc||null},set(v){this._syntheticSrc=v},configurable:true});
      HTMLMediaElement.prototype.play=async function(){return;};
      HTMLMediaElement.prototype.pause=function(){};
      window.__testCode='';
      window.BarcodeDetector=class {constructor({formats}){this.formats=formats}async detect(){const s=window.__testCode;window.__testCode='';return s?[{rawValue:s}]:[]}};
      window.fetch=async(url,init={})=>{
        const ret=await window.mockRequest(url,{method:init.method||'GET',body:init.body||'',headers:init.headers||{}});
        return {ok:ret.status>=200&&ret.status<300,status:ret.status,json:async()=>ret.payload};
      };
    """
    return f'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>{css}</style></head><body><div id="app"></div><div id="sr-status" role="status" class="sr-only"></div><script>{shim}</script><script>{source}</script></body></html>'

HARNESS=bundle_harness()

def run_scenario(browser, role='TEACHER'):
    state.update({'role':role,'marked':{},'scanned':0,'closed':False,'calls':[]})
    context=browser.new_context(viewport={'width':407,'height':885},device_scale_factor=1)
    page=context.new_page()
    problems=[]
    page.on('pageerror',lambda err:problems.append(str(err)))
    page.expose_function('mockRequest',handler)
    page.set_content(HARNESS,wait_until='load',timeout=15000)
    page.get_by_role('heading',name='Staff sign in').wait_for()
    page.screenshot(path=str(OUT/f'{role.lower()}_login.png'),full_page=True)
    page.locator('#staff-email').fill('test@example.invalid')
    page.locator('#staff-pass').fill('secret-123')
    page.get_by_role('button',name='Access Attendance Workspace').click()
    page.get_by_text('Hall A — Synthetic Exam').first.wait_for()
    page.screenshot(path=str(OUT/f'{role.lower()}_sessions.png'),full_page=True)
    page.get_by_role('button',name='Start scanning').click()
    page.get_by_text('Ready for verification').wait_for()
    page.screenshot(path=str(OUT/f'{role.lower()}_scanner_idle.png'),full_page=True)
    page.get_by_role('button',name='Start camera').click()
    try: page.get_by_role('button',name='Stop camera').wait_for(timeout=5000)
    except Exception:
        print('DEBUG page errors:', problems)
        print('DEBUG body:',page.locator('body').inner_text()[-2900:])
        print('DEBUG calls:',state['calls'][-8:])
        page.screenshot(path=str(OUT/f'{role.lower()}_debug.png'),full_page=True)
        raise
    page.evaluate('(code) => window.__testCode = code','https://azmaio.com/attend?token='+TOKEN)
    page.get_by_text('Attendance confirmed and saved by AZM.AIO.',exact=True).wait_for(timeout=12000)
    assert state['marked'].get('s1')=='PRESENT', 'Backend write not received'
    assert state['scanned']==1, 'Incorrect QR marking count'
    assert page.get_by_text('Aisha Example').count()>=1
    page.screenshot(path=str(OUT/f'{role.lower()}_scanner_confirmed.png'),full_page=True)
    page.get_by_label('Primary navigation').get_by_role('button',name='Roster',exact=True).click()
    page.get_by_role('heading',name='Aisha Example').wait_for()
    page.get_by_role('heading',name='Bilal Example').wait_for()
    page.screenshot(path=str(OUT/f'{role.lower()}_roster.png'),full_page=True)
    page.get_by_role('button',name='Manual verify').click()
    page.get_by_role('heading',name='Confirm manual verification').wait_for()
    page.get_by_role('button',name='Confirm present').click()
    page.get_by_role('heading',name='Bilal Example').wait_for()
    page.wait_for_timeout(250)
    assert state['marked'].get('s2')=='PRESENT', 'Manual mark did not reach backend'
    assert len([c for c in state['calls'] if c['path']=='/api/attendance/scan'])==1
    assert state['calls'][0]['auth'] is None
    assert all(c['auth'].startswith('Bearer ') for c in state['calls'] if c['path'].startswith('/api/attendance/'))
    if role=='ADMIN':
        page.get_by_role('button',name='Close Hall session').click()
        page.get_by_role('heading',name='Close examination session').wait_for()
        page.locator('#confirm-close-text').fill('CLOSE SESSION')
        page.get_by_role('button',name='Close Hall',exact=True).click()
        page.wait_for_timeout(350)
        assert state['closed'], 'Admin close did not reach API'
    else:
        assert page.get_by_role('button',name='Close Hall session').count()==0
    assert not problems, 'Browser JS errors: '+str(problems)
    context.close()

if __name__=='__main__':
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        run_scenario(browser,'TEACHER')
        run_scenario(browser,'ADMIN')
        browser.close()
    print('PASS: synthetic browser login, Hall selection, camera decode, authenticated scan, manual mark, roles and close')
    print('Screenshots:',OUT)
