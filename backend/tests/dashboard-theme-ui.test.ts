import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';

async function verifyDashboardAppearance() {
  const root = path.resolve(__dirname, '../..');
  const output = path.join(root, 'tmp/dashboard-appearance-evidence');
  fs.mkdirSync(output, { recursive: true });

  const css = fs.readdirSync(path.join(root, 'dist/assets'))
    .filter(name => name.endsWith('.css'))
    .map(name => fs.readFileSync(path.join(root, 'dist/assets', name), 'utf8')).join('\n');

  const bundle = await build({
    stdin: {
      contents: `import React,{useState} from 'react';
        import {createRoot} from 'react-dom/client';
        import {AuthProvider} from './src/lib/authContext';
        import {setUser,setToken} from './src/lib/auth';
        import {AdminLayout} from './src/components/admin/layout/AdminLayout';
        import {SettingsView} from './src/components/admin/settings/SettingsView';
        import {AttendanceDialog} from './src/components/admin/attendance/AttendanceDialog';
        const account=new URLSearchParams(location.search).get('account')==='b'?'b':'a';
        const user=account==='a'
          ? {id:'theme-staff-a',name:'Synthetic Admin',email:'admin@test.invalid',role:'ADMIN'}
          : {id:'theme-staff-b',name:'Synthetic Teacher',email:'teacher@test.invalid',role:'TEACHER'};
        setToken('synthetic-theme-only');
        setUser(user);
        function Fixture() {
          const [show,setShow]=useState(false);
          return <AdminLayout currentTab="settings" onSelectTab={()=>{}} title="Dashboard settings">
            <SettingsView/>
            <button type="button" onClick={()=>setShow(true)}>Open synthetic attendance dialog</button>
            <div data-dashboard-paper className="printable-document bg-white text-slate-900">Synthetic printable paper</div>
            {show&&<AttendanceDialog title="Synthetic dialog" busy={false} onClose={()=>setShow(false)}
              footer={<button onClick={()=>setShow(false)}>Close</button>}>
              <label htmlFor="synthetic-field" className="text-slate-700">Synthetic field</label>
              <input id="synthetic-field" className="bg-white text-slate-900" />
            </AttendanceDialog>}
          </AdminLayout>;
        }
        createRoot(document.getElementById('root')).render(
          location.pathname==='/standalone'
            ? <AttendanceDialog title="Standalone synthetic dialog" busy={false} onClose={()=>{}} footer={<button>Close</button>}>
                <span>Standalone confirmation still works</span>
              </AttendanceDialog>
            : <AuthProvider><Fixture/></AuthProvider>
        );`,
      resolveDir: root,
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    define: {
      'import.meta.env.PROD': 'true',
      'import.meta.env.VITE_API_URL': 'window.location.origin',
    },
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/fixture.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(bundle.outputFiles[0].text);
      return;
    }
    if (url.pathname === '/api/auth/me') {
      const teacher = (req.headers.referer ?? '').includes('account=b');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({success:true,data:{user:teacher
        ? {id:'theme-staff-b',name:'Synthetic Teacher',email:'teacher@test.invalid',role:'TEACHER'}
        : {id:'theme-staff-a',name:'Synthetic Admin',email:'admin@test.invalid',role:'ADMIN'}}}));
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>${css}</style></head><body><div id="root">${url.pathname==='/public'?'Synthetic public site':''}</div>
      ${url.pathname==='/public'?'':'<script src="/fixture.js"></script>'}</body></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  const base = 'http://127.0.0.1:' + addr.port;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e.message)));
    await page.setViewport({width: 1250, height: 920});
    await page.goto(base + '/?account=a', {waitUntil:'networkidle0'});
    await page.waitForSelector('[data-dashboard-theme="light"]');
    const appearance = async () => {
      await page.evaluate(() => {
        const control = Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="tab"]'))
          .find(el => el.textContent?.includes('Appearance'));
        if (!control) throw Error('Settings Appearance tab missing');
        control.click();
      });
      await page.waitForSelector('input[name="dashboard-color-theme"][value="dark"]');
    };
    await appearance();
    const light = await page.evaluate(() => ({
      root:getComputedStyle(document.querySelector<HTMLElement>('[data-dashboard-theme]')!).backgroundColor,
      panel:getComputedStyle(document.querySelector<HTMLElement>('section')!).backgroundColor,
    }));
    assert.equal(light.panel, 'rgb(255, 255, 255)');
    await page.click('input[name="dashboard-color-theme"][value="dark"]');
    await page.waitForSelector('[data-dashboard-theme="dark"]');
    const dark = await page.evaluate(() => ({
      root:getComputedStyle(document.querySelector<HTMLElement>('[data-dashboard-theme]')!).backgroundColor,
      panel:getComputedStyle(document.querySelector<HTMLElement>('section')!).backgroundColor,
      stored:localStorage.getItem('azmaio.dashboard.appearance.v1:theme-staff-a'),
    }));
    assert.notEqual(dark.panel, light.panel);
    assert.notEqual(dark.root, light.root);
    assert.equal(dark.stored, 'dark');
    assert(await page.evaluate(() => document.body.textContent?.includes('Dark mode is active.')));
    await page.screenshot({path:path.join(output,'desktop-dark.png'),fullPage:true});

    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find(el=>el.textContent?.trim()==='Open synthetic attendance dialog');
      if (!button) throw Error('Synthetic dialog launcher missing');
      button.click();
    });
    await page.waitForSelector('[role="dialog"]');
    const dialogColor = await page.$eval('[role="dialog"]', e=>getComputedStyle(e).backgroundColor);
    assert.equal(dialogColor, dark.panel);
    await page.evaluate(()=>Array.from(document.querySelectorAll('button'))
      .find(el=>el.textContent?.trim()==='Close')?.click());
    await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));

    await page.emulateMediaType('print');
    const print = await page.evaluate(() => ({
      paper: getComputedStyle(document.querySelector<HTMLElement>('[data-dashboard-paper]')!).backgroundColor,
      theme: getComputedStyle(document.querySelector<HTMLElement>('[data-dashboard-theme]')!).colorScheme,
    }));
    assert.equal(print.paper,'rgb(255, 255, 255)');
    assert.equal(print.theme,'light');
    await page.emulateMediaType('screen');
    await page.reload({waitUntil:'networkidle0'});
    await page.waitForSelector('[data-dashboard-theme="dark"]');
    assert.equal(await page.evaluate(()=>localStorage.getItem('azmaio.dashboard.appearance.v1:theme-staff-a')), 'dark');

    await page.goto(base+'/?account=b',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-dashboard-theme="light"]');
    await appearance();
    assert.equal(await page.evaluate(()=>localStorage.getItem('azmaio.dashboard.appearance.v1:theme-staff-b')), null);
    await page.setViewport({width:390,height:844});
    await page.goto(base+'/?account=a',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-dashboard-theme="dark"]');
    await page.click('[aria-label="Toggle mobile navigation"]');
    await page.waitForFunction(()=>document.querySelector('aside')?.className.includes('translate-x-0'));
    await page.waitForFunction(()=>Math.abs(document.querySelector('aside')!.getBoundingClientRect().left)<1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(output,'mobile-dark.png'),fullPage:true});

    await page.goto(base+'/public',{waitUntil:'networkidle0'});
    assert.equal(await page.evaluate(()=>document.querySelector('[data-dashboard-theme]')), null);
    assert(await page.evaluate(()=>document.body.textContent?.includes('Synthetic public site')));
    await page.goto(base+'/standalone',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-dashboard-theme="light"] [role="dialog"]');
    assert(await page.evaluate(()=>document.body.textContent?.includes('Standalone confirmation still works')));
    assert.deepEqual(errors,[]);
    console.log('DASHBOARD_THEME_BROWSER_PASS: Light/Dark, account isolation, persistence, modal portal, standalone light fallback, print white, mobile, public isolation');
  } finally {
    await browser.close();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
}
verifyDashboardAppearance().catch(error=>{console.error(error);process.exitCode=1;});
