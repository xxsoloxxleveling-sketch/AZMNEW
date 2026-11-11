package com.azmaio.omr;

import android.app.Activity;
import android.graphics.BitmapFactory;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.UUID;

@CapacitorPlugin(name = "AzmNativeScanner")
public class AzmNativeScannerPlugin extends Plugin {
    private static final String DIR = "scanner-test-images";
    private static final int MAX_SCANS = 40;
    private static final int MAX_BYTES = 20 * 1024 * 1024;
    private ActivityResultLauncher<IntentSenderRequest> documentLauncher;
    private PluginCall activeCall;

    @Override public void load() {
        documentLauncher = bridge.registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            this::onScanResult
        );
    }

    private File folder() throws IOException {
        File base = new File(getContext().getFilesDir(), DIR);
        if (!base.isDirectory() && !base.mkdirs()) throw new IOException("Private scan storage unavailable");
        return base;
    }

    private File[] savedFiles() throws IOException {
        File[] files = folder().listFiles(file -> file.isFile() &&
            file.getName().matches("scan-[A-Za-z0-9-]+\\.jpg"));
        if (files == null) return new File[0];
        Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
        return files;
    }

    private JSObject describe(File image) throws IOException {
        BitmapFactory.Options decode = new BitmapFactory.Options();
        decode.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(image.getAbsolutePath(), decode);
        if (decode.outWidth < 1 || decode.outHeight < 1) throw new IOException("Invalid captured JPEG");
        JSObject item = new JSObject();
        item.put("id", image.getName());
        item.put("uri", Uri.fromFile(image).toString());
        item.put("width", decode.outWidth);
        item.put("height", decode.outHeight);
        item.put("bytes", image.length());
        item.put("createdAt", image.lastModified());
        return item;
    }

    @PluginMethod public void listScans(PluginCall call) {
        try {
            JSArray pages = new JSArray();
            for (File f : savedFiles()) pages.put(describe(f));
            JSObject result = new JSObject();
            result.put("pages", pages);
            call.resolve(result);
        } catch (IOException error) { call.reject("Cannot read saved tester images"); }
    }

    @PluginMethod public void deleteScan(PluginCall call) {
        String id = call.getString("id", "");
        if (!id.matches("scan-[A-Za-z0-9-]+\\.jpg")) {
            call.reject("Invalid scan identifier"); return;
        }
        try {
            File image = new File(folder(), id);
            if (!image.isFile()) { call.reject("Saved scan does not exist"); return; }
            if (!image.delete()) { call.reject("Could not delete saved scan"); return; }
            call.resolve();
        } catch (IOException error) { call.reject("Private scan storage inaccessible"); }
    }

    @PluginMethod public void scan(PluginCall call) {
        if (activeCall != null) { call.reject("Scanner already running"); return; }
        try {
            if (savedFiles().length >= MAX_SCANS) {
                call.reject("Scanner tester storage is full (40 scans). Delete old scans before continuing.");
                return;
            }
            int pages = Math.max(1, Math.min(10, call.getInt("pageLimit", 10)));
            GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
                .setGalleryImportAllowed(false)
                .setPageLimit(pages)
                .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
                .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_BASE)
                .build();
            activeCall = call;
            GmsDocumentScanning.getClient(options)
                .getStartScanIntent(getActivity())
                .addOnSuccessListener(sender -> {
                    try {
                        documentLauncher.launch(new IntentSenderRequest.Builder(sender).build());
                    } catch (Exception error) {
                        rejectPending("Unable to launch native document scanner");
                    }
                })
                .addOnFailureListener(error ->
                    rejectPending("Android document scanner is unavailable. Update Google Play services; its scanner components may need an initial download.")
                );
        } catch (Exception error) {
            rejectPending("Could not start native document scanner");
        }
    }

    private void rejectPending(String message) {
        PluginCall pending = activeCall;
        activeCall = null;
        if (pending != null) pending.reject(message);
    }

    private void onScanResult(ActivityResult result) {
        PluginCall pending = activeCall;
        activeCall = null;
        if (pending == null) return;
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            cancelled.put("pages", new JSArray());
            pending.resolve(cancelled);
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK) {
            pending.reject("Native scanner did not finish successfully"); return;
        }
        GmsDocumentScanningResult images = GmsDocumentScanningResult.fromActivityResultIntent(result.getData());
        if (images == null || images.getPages() == null || images.getPages().isEmpty()) {
            pending.reject("No document pages were captured"); return;
        }
        try {
            File privateFolder = folder();
            if (savedFiles().length + images.getPages().size() > MAX_SCANS)
                throw new IOException("Private tester storage limit reached");
            JSArray pages = new JSArray();
            for (GmsDocumentScanningResult.Page page : images.getPages()) {
                File dest = new File(privateFolder,
                    "scan-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString() + ".jpg");
                boolean finished = false;
                try (InputStream source = getContext().getContentResolver().openInputStream(page.getImageUri());
                     FileOutputStream target = new FileOutputStream(dest)) {
                    if (source == null) throw new IOException("Document image not readable");
                    byte[] buffer = new byte[65536];
                    long total = 0;
                    int count;
                    while ((count = source.read(buffer)) != -1) {
                        total += count;
                        if (total > MAX_BYTES) throw new IOException("Document image larger than 20 MB");
                        target.write(buffer, 0, count);
                    }
                    target.flush();
                    if (total < 1024) throw new IOException("Document image is empty");
                    finished = true;
                } finally {
                    if (!finished) dest.delete();
                }
                try {
                    pages.put(describe(dest));
                } catch (IOException error) {
                    dest.delete();
                    throw error;
                }
            }
            JSObject output = new JSObject();
            output.put("cancelled", false);
            output.put("pages", pages);
            pending.resolve(output);
        } catch (IOException error) {
            pending.reject("Could not save scanned images privately: " + error.getMessage());
        }
    }
}
