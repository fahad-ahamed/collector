package com.contactcollector.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {

    // IMPORTANT: Change this to your deployed website URL
    private static final String WEBSITE_BASE_URL = "https://your-website-url.vercel.app";
    private static final int CONTACTS_PERMISSION_CODE = 100;

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

        btnAllow.setOnClickListener(v -> requestContactPermission());

        btnViewWebsite.setOnClickListener(v -> {
            if (viewUrl != null) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(viewUrl)));
            }
        });

        // Auto-check permission on open
        if (checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED) {
            readAndUploadContacts();
        } else {
            showPermissionScreen();
        }
    }

    private void showPermissionScreen() {
        layoutPermission.setVisibility(View.VISIBLE);
        layoutLoading.setVisibility(View.GONE);
        layoutSuccess.setVisibility(View.GONE);
    }

    private void requestContactPermission() {
        requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, CONTACTS_PERMISSION_CODE);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CONTACTS_PERMISSION_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                readAndUploadContacts();
            } else {
                tvStatus.setText("Permission Denied");
                tvDetail.setText("Contact permission is required. Please try again and tap Allow.");
            }
        }
    }

    private void readAndUploadContacts() {
        layoutPermission.setVisibility(View.GONE);
        layoutLoading.setVisibility(View.VISIBLE);
        layoutSuccess.setVisibility(View.GONE);
        tvStatus.setText("Reading Contacts...");
        tvDetail.setText("Please wait while we read all your contacts");

        new Thread(() -> {
            try {
                JSONArray contactsArray = readAllContacts();

                runOnUiThread(() -> {
                    tvStatus.setText("Uploading Contacts...");
                    tvDetail.setText("Sending " + contactsArray.length() + " contacts to website...");
                });

                String result = uploadContacts(contactsArray);

                if (result != null) {
                    JSONObject json = new JSONObject(result);
                    String sessionId = json.getString("id");
                    int count = json.getInt("count");
                    viewUrl = WEBSITE_BASE_URL + "/view/" + sessionId;

                    runOnUiThread(() -> {
                        layoutLoading.setVisibility(View.GONE);
                        layoutSuccess.setVisibility(View.VISIBLE);
                        tvStatus.setText("Contacts Uploaded!");
                        tvDetail.setText(count + " contacts sent to website successfully.\n\nTap 'View on Website' to see all contacts in vCard format.");
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
                    // Get phone number
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

                        // Get email
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

                        // Get organization
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

    private String uploadContacts(JSONArray contacts) throws Exception {
        JSONObject payload = new JSONObject();
        payload.put("contacts", contacts);

        URL url = new URL(WEBSITE_BASE_URL + "/api/contacts/upload");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);

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
