"""Simulated native WebView/Google bridge walkthrough. Does NOT test a physical camera.
All backend responses are intercepted and synthetic; it never reaches azmaio.com.
"""
from __future__ import annotations
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_smoke import handler, state, TOKEN, bundle_harness

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests'/'screenshots'
# Use a synthetic in-memory HTML harness; container browser policy forbids localhost navigation.
HARNESS=bundle_harness().replace(
    'window.AZM_ATTENDANCE_CONFIG=',
    'window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android"};window.__syntheticGoogleScans=[];window.AZM_ATTENDANCE_CONFIG='
).replace(
    "await import('./native-bridge.js')",
    'await Promise.resolve({prepareGoogleScanner:async()=>({ready:true,downloading:false}),scanWithGoogle:async()=>window.__syntheticGoogleScans.shift()||null})'
)

def scenario(browser,role):
    state.update({'role':role,'marked':{},'scanned':0,'closed':False,'calls':[]})
    context=browser.new_context(viewport={'width':393,'height':852},device_scale_factor=1)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.expose_function('mockRequest',handler)
    page.set_content(HARNESS,wait_until='load')
    page.get_by_role('heading',name='Staff sign in').wait_for()
    page.locator('#staff-email').fill('test@example.invalid')
    page.locator('#staff-pass').fill('secret-123')
    page.get_by_role('button',name='Access Attendance Workspace').click()
    page.get_by_text('Hall A — Synthetic Exam').first.wait_for()
    page.get_by_role('button',name='Start scanning').click()
    page.get_by_text('Google Code Scanner',exact=True).first.wait_for()
    assert page.locator('video').count()==0, 'Android should delegate camera to Google'
    assert page.locator('#qr-photo').count()==0, 'Android should not expose unsupported gallery decoder'
    page.evaluate('(code) => window.__syntheticGoogleScans.push(code)','https://azmaio.com/attend?token='+TOKEN)
    page.get_by_role('button',name='Open Google camera').click()
    page.get_by_text('Attendance confirmed and saved by AZM.AIO.',exact=True).wait_for(timeout=12000)
    assert state['marked'].get('s1')=='PRESENT'
    assert state['scanned']==1
    page.screenshot(path=str(OUT/f'{role.lower()}_google_native_confirmed.png'),full_page=True)
    page.evaluate('(code) => window.__syntheticGoogleScans.push(code)','https://azmaio.com/attend?token='+TOKEN)
    page.get_by_role('button',name='Open Google camera').click()
    page.get_by_text('Already recorded as PRESENT in this Hall.',exact=False).wait_for(timeout=12000)
    assert state['scanned']==1, 'Duplicate must never create a second mark'
    scans=[c for c in state['calls'] if c['path']=='/api/attendance/scan']
    assert len(scans)==2 and all(c['auth']=='Bearer synthetic-access' for c in scans)
    assert scans[0]['payload']=={'sessionId':'synthetic-hall-s1','revision':5,'qrToken':TOKEN,'status':'PRESENT'}
    page.get_by_label('Primary navigation').get_by_role('button',name='Roster',exact=True).click()
    page.get_by_role('heading',name='Aisha Example').wait_for()
    if role=='TEACHER':assert page.get_by_role('button',name='Close Hall session').count()==0
    if role=='ADMIN':
        page.get_by_role('button',name='Close Hall session').click()
        page.locator('#confirm-close-text').fill('CLOSE SESSION')
        page.get_by_role('button',name='Close Hall',exact=True).click()
        page.wait_for_timeout(400)
        assert state['closed']
    assert not errors,errors
    context.close()

if __name__=='__main__':
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        scenario(browser,'TEACHER')
        scenario(browser,'ADMIN')
        browser.close()
    print('PASS: synthetic Android Google scanner bridge, authenticated attendance, duplicates and roles')
