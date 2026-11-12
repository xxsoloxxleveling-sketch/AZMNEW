package com.azmaio.omr;

import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.moduleinstall.InstallStatusListener;
import com.google.android.gms.common.moduleinstall.ModuleInstall;
import com.google.android.gms.common.moduleinstall.ModuleInstallClient;
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest;
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate.InstallState;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Arrays;
import java.util.HashSet;
import java.util.HashMap;
import java.util.Set;
import java.util.Locale;
import java.util.regex.Pattern;
import org.json.JSONException;
import org.json.JSONObject;

/** Isolated training APK only. QR text remains in memory; never sends images or answers. */
public class MainActivity extends BridgeActivity {
    private static final Pattern REQUEST_ID = Pattern.compile("[A-Za-z0-9_-]{16,96}");
    private static final int MAX_QR_BYTES = 7000;
    private static final String RUNTIME_PATH = "/omr-training/api/device-runtime/";
    private static final Set<String> RUNTIME_ASSETS = new HashSet<>(Arrays.asList(
        "device-worker.js",
        "pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json",
        "numpy-2.0.2-cp312-cp312-pyodide_2024_0_wasm32.whl",
        "opencv_python-4.10.0.84-cp312-cp312-pyodide_2024_0_wasm32.whl",
        "engine/engine.py", "engine/bubble_evidence.py", "engine/responses.py", "engine/qr_decode.py",
        "engine/registration.py", "engine/physical_layout.py", "engine/template-v2.json",
        "engine/template-framed-legacy-v1.json"
    ));
    private final Handler main = new Handler(Looper.getMainLooper());
    private long documentEpoch;
    private boolean resumed;
    private boolean nativeScannerVisible;
    private boolean scannerHandoffPauseExpected;
    private Pending pending;

    private static final class Pending {
        final String id;
        final long epoch;
        final JavaScriptReplyProxy reply;
        boolean cancelled;
        boolean scanStarted;
        ModuleInstallClient installer;
        InstallStatusListener installListener;
        Runnable installTimeout;
        Pending(String id, long epoch, JavaScriptReplyProxy reply) {
            this.id = id;
            this.epoch = epoch;
            this.reply = reply;
        }
    }

    private boolean allowedOrigin(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && "azmaio.com".equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
    }

    private boolean allowed(Uri uri) {
        if (!allowedOrigin(uri) || uri.getPath() == null || !uri.getPath().startsWith("/omr-training/")) return false;
        String encoded = uri.getEncodedPath().toLowerCase(Locale.ROOT);
        // Do not allow encoded separators or traversal to escape the training route.
        if (encoded.contains("%2e") || encoded.contains("%2f") || encoded.contains("%5c") || encoded.contains("\\")) return false;
        for (String part : uri.getPath().split("/")) if (".".equals(part) || "..".equals(part)) return false;
        return true;
    }

    private WebResourceResponse bundledRuntime(WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!allowedOrigin(uri) || uri.getQuery() != null || uri.getFragment() != null || uri.getPath() == null) return null;
        String name;
        if ("/omr-training/api/device-worker.js".equals(uri.getPath())) name = "device-worker.js";
        else if (uri.getPath().startsWith(RUNTIME_PATH)) name = uri.getPath().substring(RUNTIME_PATH.length());
        else return null;
        if (!RUNTIME_ASSETS.contains(name)) return blocked("Bundled scanner asset unavailable");
        if (!"GET".equals(request.getMethod())) return blocked("Method not allowed");
        String mime = name.endsWith(".js") ? "text/javascript" : name.endsWith(".wasm") ? "application/wasm"
            : name.endsWith(".json") ? "application/json" : "application/octet-stream";
        try {
            InputStream stream = getAssets().open("device-runtime/" + name);
            HashMap<String,String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("X-Content-Type-Options", "nosniff");
            return new WebResourceResponse(mime, null, 200, "OK", headers, stream);
        } catch (IOException missing) {
            return blocked("Bundled scanner asset unavailable");
        }
    }

    private WebResourceResponse blocked(String message) {
        return new WebResourceResponse("text/plain", "UTF-8", 404, message,
            new HashMap<String,String>(), new ByteArrayInputStream(new byte[0]));
    }

    private boolean currentPageAllowed() {
        return getBridge() != null && getBridge().getWebView() != null
            && getBridge().getWebView().getUrl() != null
            && allowed(Uri.parse(getBridge().getWebView().getUrl()));
    }

    private boolean current(Pending request) {
        return pending == request && !request.cancelled && request.epoch == documentEpoch
            && !isFinishing() && !isDestroyed() && currentPageAllowed();
    }

    private void reply(JavaScriptReplyProxy proxy, String id, String status, String code, String text) {
        try {
            JSONObject response = new JSONObject().put("requestId", id).put("status", status);
            if (code != null) response.put("code", code);
            if (text != null) response.put("text", text);
            // Reply to the original authenticated frame, never interpolate decoded text as JavaScript.
            proxy.postMessage(response.toString());
        } catch (JSONException | IllegalStateException ignored) {
            // A navigated/destroyed frame cannot receive a result. Do not log QR data.
        }
    }

    private void stopInstallWatch(Pending request) {
        if (request.installTimeout != null) main.removeCallbacks(request.installTimeout);
        request.installTimeout = null;
        if (request.installListener != null && request.installer != null) {
            request.installer.unregisterListener(request.installListener);
            request.installListener = null;
        }
    }

    private void finish(Pending request, String status, String code, String text) {
        if (pending != request) return;
        if (current(request)) reply(request.reply, request.id, status, code, text);
        stopInstallWatch(request);
        if (pending == request) pending = null;
        if (request.scanStarted) {
            nativeScannerVisible = false;
            scannerHandoffPauseExpected = false;
        }
    }

    private void invalidateDocument() {
        documentEpoch++;
        if (pending != null) {
            pending.cancelled = true;
            stopInstallWatch(pending);
            // Google owns its Activity. Retain the busy slot until its Task ends,
            // but drop all callbacks to this document. There is no SDK cancel API.
            if (!pending.scanStarted) pending = null;
        }
    }

    private String servicesFailure() {
        int state = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(this);
        if (state == ConnectionResult.SUCCESS) return null;
        if (state == ConnectionResult.SERVICE_VERSION_UPDATE_REQUIRED || state == ConnectionResult.SERVICE_UPDATING)
            return "PLAY_SERVICES_UPDATE_REQUIRED";
        return "PLAY_SERVICES_UNAVAILABLE";
    }

    private void startScanner(Pending request, GmsBarcodeScanner scanner) {
        if (!current(request) || request.scanStarted) return;
        stopInstallWatch(request);
        if (!resumed) { finish(request, "cancelled", "APP_NOT_ACTIVE", null); return; }
        request.scanStarted = true;
        nativeScannerVisible = true;
        scannerHandoffPauseExpected = true;
        try {
            // Do not use Activity-scoped Task listeners: the Google camera Activity
            // stops this Activity and would remove those listeners before completion.
            scanner.startScan().addOnSuccessListener(barcode -> {
                String value = barcode.getRawValue();
                if (barcode.getFormat() != Barcode.FORMAT_QR_CODE || value == null || value.trim().isEmpty())
                    finish(request, "error", "INVALID_QR", null);
                else if (value.getBytes(StandardCharsets.UTF_8).length > MAX_QR_BYTES)
                    finish(request, "error", "QR_TOO_LARGE", null);
                else finish(request, "decoded", null, value);
            }).addOnCanceledListener(() -> finish(request, "cancelled", "USER_CANCELLED", null))
              .addOnFailureListener(error -> finish(request, "error", "GOOGLE_SCANNER_FAILED", null));
        } catch (RuntimeException error) {
            finish(request, "unavailable", "GOOGLE_SCANNER_UNAVAILABLE", null);
        }
    }

    private void prepareScanner(Pending request) {
        GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(this, new GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE).enableAutoZoom().build());
        request.installer = ModuleInstall.getClient(this);
        // The sideloaded APK may not have the module that Play Store normally
        // downloads at installation. Explicitly report that first-use preparation.
        request.installTimeout = () -> finish(request, "unavailable", "SCANNER_MODULE_TIMEOUT", null);
        main.postDelayed(request.installTimeout, 45000);
        request.installer.areModulesAvailable(scanner).addOnSuccessListener(availability -> {
            if (!current(request)) return;
            if (availability.areModulesAvailable()) { startScanner(request, scanner); return; }
            reply(request.reply, request.id, "preparing", "SCANNER_MODULE_DOWNLOAD", null);
            request.installListener = update -> {
                if (!current(request)) return;
                if (update.getInstallState() == InstallState.STATE_COMPLETED) startScanner(request, scanner);
                else if (update.getInstallState() == InstallState.STATE_FAILED)
                    finish(request, "unavailable", "SCANNER_MODULE_DOWNLOAD_FAILED", null);
                else if (update.getInstallState() == InstallState.STATE_CANCELED)
                    finish(request, "cancelled", "SCANNER_MODULE_CANCELLED", null);
            };
            ModuleInstallRequest install = ModuleInstallRequest.newBuilder().addApi(scanner)
                .setListener(request.installListener).build();
            request.installer.installModules(install).addOnSuccessListener(result -> {
                // Request accepted is NOT installation complete.
                if (current(request) && result.areModulesAlreadyInstalled()) startScanner(request, scanner);
            }).addOnFailureListener(error -> finish(request, "unavailable", "SCANNER_MODULE_DOWNLOAD_FAILED", null));
        }).addOnFailureListener(error -> finish(request, "unavailable", "SCANNER_MODULE_UNAVAILABLE", null));
    }

    @Override protected void load() {
        // BridgeActivity has inflated this view but has not created Bridge yet.
        // Register before super.load() calls loadUrl: WebMessage objects are
        // injected when a new document starts, including the first launch.
        WebView webView = findViewById(com.getcapacitor.android.R.id.webview);
        if (webView != null) installQrBridge(webView);
        super.load();
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setSaveFormData(false);
        settings.setDomStorageEnabled(false);
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                invalidateDocument();
                super.onPageStarted(view, url, favicon);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !allowed(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse runtime = bundledRuntime(request);
                if (runtime != null) return runtime;
                if (allowed(request.getUrl())) return super.shouldInterceptRequest(view, request);
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Read-only training origin only",
                    new HashMap<String,String>(), new ByteArrayInputStream(new byte[0]));
            }
        });
    }

    private void installQrBridge(WebView webView) {
        // Older Android System WebView versions retain the browser QR fallback.
        // Do not replace this with addJavascriptInterface (which exposes all frames).
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        WebViewCompat.addWebMessageListener(webView, "AZMNativeQr", Collections.singleton("https://azmaio.com"),
            (view, message, sourceOrigin, isMainFrame, proxy) -> {
                if (!isMainFrame || !allowedOrigin(sourceOrigin) || !currentPageAllowed()) return;
                if (message.getType() != WebMessageCompat.TYPE_STRING) return;
                String body = message.getData();
                if (body == null || body.getBytes(StandardCharsets.UTF_8).length > 512) return;
                try {
                    JSONObject input = new JSONObject(body);
                    if (input.length() != 2 || !(input.opt("requestId") instanceof String) || !(input.opt("type") instanceof String)) return;
                    String id = input.getString("requestId"), type = input.getString("type");
                    if (!REQUEST_ID.matcher(id).matches()) return;
                    if ("cancel".equals(type)) {
                        if (pending != null && pending.id.equals(id) && pending.epoch == documentEpoch) {
                            reply(proxy, id, "cancelled", "REQUEST_CANCELLED", null);
                            pending.cancelled = true;
                            stopInstallWatch(pending);
                            if (!pending.scanStarted) pending = null;
                        }
                        return;
                    }
                    if (!"scan".equals(type) && !"capabilities".equals(type)) return;
                    if (!resumed) { reply(proxy, id, "cancelled", "APP_NOT_ACTIVE", null); return; }
                    String failure = servicesFailure();
                    if (failure != null) { reply(proxy, id, "unavailable", failure, null); return; }
                    if ("capabilities".equals(type)) { reply(proxy, id, "available", null, null); return; }
                    if (pending != null || nativeScannerVisible) { reply(proxy, id, "busy", "SCAN_IN_PROGRESS", null); return; }
                    pending = new Pending(id, documentEpoch, proxy);
                    try { prepareScanner(pending); }
                    catch (RuntimeException error) { finish(pending, "unavailable", "GOOGLE_SCANNER_UNAVAILABLE", null); }
                } catch (JSONException ignored) { /* Invalid input has no side effects. */ }
            });
    }

    @Override public void onResume() {
        super.onResume();
        resumed = true;
        // Only the first pause belongs to handing control to Google's scanner.
        scannerHandoffPauseExpected = false;
    }

    @Override public void onPause() {
        resumed = false;
        boolean nativeHandoff = nativeScannerVisible && scannerHandoffPauseExpected;
        scannerHandoffPauseExpected = false;
        if (!nativeHandoff) {
            invalidateDocument();
            if (getBridge() != null && getBridge().getWebView() != null)
                getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('pagehide'))", null);
        }
        super.onPause();
    }

    @Override public void onDestroy() {
        invalidateDocument();
        super.onDestroy();
    }
}

