/** Dedicated read-only APK preparation, only inside the isolated CI checkout.
 * Never bundles the ordinary scanner's upload/review/grading UI or credentials.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function trainingConfig(origin){
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.origin!=='https://azmaio.com'||url.pathname!=='/omr-training/')throw Error('The approved isolated HTTPS training endpoint is required');
 return {appId:'com.azmaio.omr.training',appName:'AZM Read-only Training',webDir:'readonly-dist',loggingBehavior:'none',
  server:{url:url.href,cleartext:false},android:{allowMixedContent:false,webContentsDebuggingEnabled:false}};
}

export const fallback='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Read-only training unavailable</title><main style="font:18px system-ui;padding:24px"><h1>AZM Read-only Training</h1><p>The authenticated test service is unavailable. Check your internet connection and ask the operator to keep the test PC and HTTPS tunnel online. Reopen the app to retry.</p><p>No scans or marks are saved by this app. No production upload or grading service is used.</p></main>';

const native=`package com.azmaio.omr;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.net.Uri;
import java.io.ByteArrayInputStream;
import java.util.HashMap;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
public class MainActivity extends BridgeActivity {
 private boolean allowed(Uri u){return "https".equals(u.getScheme())&&"azmaio.com".equals(u.getHost())&&(u.getPort()==-1||u.getPort()==443)&&u.getUserInfo()==null&&u.getPath()!=null&&u.getPath().startsWith("/omr-training/");}
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE,WindowManager.LayoutParams.FLAG_SECURE);
  if(getBridge()!=null&&getBridge().getWebView()!=null){
   WebSettings settings=getBridge().getWebView().getSettings();
   settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
   settings.setSaveFormData(false);
   settings.setDomStorageEnabled(false);
   getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()){
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !allowed(request.getUrl());}
    @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
     if(allowed(request.getUrl()))return super.shouldInterceptRequest(view,request);
     return new WebResourceResponse("text/plain","UTF-8",403,"Read-only training origin only",new HashMap<String,String>(),new ByteArrayInputStream(new byte[0]));
    }
   });
  }
 }
 @Override public void onPause(){
  if(getBridge()!=null&&getBridge().getWebView()!=null)getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('pagehide'))",null);
  super.onPause();
 }
}`;

if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.OMR_READONLY_ISOLATED_BUILD!=='true')throw Error('This preparation runs only in the disposable CI checkout');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 const {origin}=JSON.parse(await fs.readFile(path.join(root,'tools/omr-readonly-android/endpoint.json'),'utf8'));
 const config=trainingConfig(origin),app=path.join(root,'apps/omr-mobile');
 await fs.writeFile(path.join(app,'capacitor.config.ts'),'const config='+JSON.stringify(config)+';export default config;\n');
 await fs.mkdir(path.join(app,'readonly-dist'),{recursive:true});
 await fs.writeFile(path.join(app,'readonly-dist/index.html'),fallback);
 const gradle=path.join(app,'android/app/build.gradle');
 await fs.writeFile(gradle,(await fs.readFile(gradle,'utf8')).replace('applicationId "com.azmaio.omr"','applicationId "com.azmaio.omr.training"'));
 const manifest=path.join(app,'android/app/src/main/AndroidManifest.xml');
 await fs.writeFile(manifest,(await fs.readFile(manifest,'utf8')).replace('android:name=".MainActivity"','android:name="com.azmaio.omr.MainActivity"'));
 await fs.writeFile(path.join(app,'android/app/src/main/java/com/azmaio/omr/MainActivity.java'),native);
 await fs.writeFile(path.join(app,'android/app/src/main/res/xml/network_security_config.xml'),'<?xml version="1.0" encoding="utf-8"?><network-security-config><base-config cleartextTrafficPermitted="false" /></network-security-config>\n');
 console.log('Prepared separate read-only APK. HTTPS only; normal scanner UI and credentials are excluded.');
}
