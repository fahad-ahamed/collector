package com.contactcollector.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Foreground service that sends heartbeat pings to the server every 30 seconds.
 * This lets the web dashboard know the device is still online and connected.
 * Includes device information for multi-device support.
 */
public class HeartbeatService extends Service {

    private static final String CHANNEL_ID = "heartbeat_channel";
    private static final int NOTIFICATION_ID = 2001;
    private static final long HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
    private static final int MSG_HEARTBEAT = 1;

    private HeartbeatHandler handler;
    private String sessionId;
    private String baseUrl;
    private String deviceId;
    private String deviceName;
    private String deviceModel;
    private String deviceBrand;
    private String androidVersion;

    // Static handler class to avoid inner class issues with d8
    private static class HeartbeatHandler extends Handler {
        private HeartbeatService service;

        HeartbeatHandler(HeartbeatService svc) {
            super(Looper.getMainLooper());
            service = svc;
        }

        @Override
        public void handleMessage(Message msg) {
            if (msg.what == MSG_HEARTBEAT && service != null) {
                service.performHeartbeat();
                sendEmptyMessageDelayed(MSG_HEARTBEAT, HEARTBEAT_INTERVAL_MS);
            }
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new HeartbeatHandler(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            sessionId = intent.getStringExtra("sessionId");
            baseUrl = intent.getStringExtra("baseUrl");
            deviceId = intent.getStringExtra("deviceId");
            deviceName = intent.getStringExtra("deviceName");
            deviceModel = intent.getStringExtra("deviceModel");
            deviceBrand = intent.getStringExtra("deviceBrand");
            androidVersion = intent.getStringExtra("androidVersion");
        }

        // Fallback: read from SharedPreferences if not provided
        SharedPreferences prefs = getSharedPreferences("CollectorPrefs", Context.MODE_PRIVATE);
        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = prefs.getString("sessionId", null);
        }
        if (baseUrl == null || baseUrl.isEmpty()) {
            baseUrl = prefs.getString("baseUrl", "https://your-website-url.vercel.app");
        }
        if (deviceId == null || deviceId.isEmpty()) {
            deviceId = prefs.getString("deviceId", null);
        }

        // Set device info from Build if not provided
        if (deviceName == null || deviceName.isEmpty()) {
            deviceName = Build.MANUFACTURER + " " + Build.MODEL;
        }
        if (deviceModel == null || deviceModel.isEmpty()) {
            deviceModel = Build.MODEL;
        }
        if (deviceBrand == null || deviceBrand.isEmpty()) {
            deviceBrand = Build.BRAND;
        }
        if (androidVersion == null || androidVersion.isEmpty()) {
            androidVersion = Build.VERSION.RELEASE;
        }

        createNotificationChannel();

        // Build notification without AndroidX
        Notification notification;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notification = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Collector")
                .setContentText("Keeping connection alive...")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .build();
        } else {
            notification = new Notification.Builder(this)
                .setContentTitle("Collector")
                .setContentText("Keeping connection alive...")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setPriority(Notification.PRIORITY_LOW)
                .build();
        }

        startForeground(NOTIFICATION_ID, notification);

        // Start heartbeat loop - send first one immediately
        handler.sendEmptyMessage(MSG_HEARTBEAT);

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null) {
            handler.removeMessages(MSG_HEARTBEAT);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // Called by HeartbeatHandler - sends the heartbeat in a new thread
    public void performHeartbeat() {
        if (sessionId == null || sessionId.isEmpty()) return;

        new Thread(new SendHeartbeatTask(sessionId, baseUrl, deviceId, deviceName, deviceModel, deviceBrand, androidVersion)).start();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Heartbeat Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps the connection to the server alive");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    // Static task class - no reference to outer class, no inner class issues
    private static class SendHeartbeatTask implements Runnable {
        private String sessionId;
        private String baseUrl;
        private String deviceId;
        private String deviceName;
        private String deviceModel;
        private String deviceBrand;
        private String androidVersion;

        SendHeartbeatTask(String sid, String url, String devId, String devName, String devModel, String devBrand, String devVersion) {
            sessionId = sid;
            baseUrl = url;
            deviceId = devId;
            deviceName = devName;
            deviceModel = devModel;
            deviceBrand = devBrand;
            androidVersion = devVersion;
        }

        @Override
        public void run() {
            HttpURLConnection conn = null;
            try {
                JSONObject payload = new JSONObject();
                payload.put("sessionId", sessionId);
                // Include device info in heartbeat for multi-device tracking
                if (deviceId != null && !deviceId.isEmpty()) {
                    payload.put("deviceId", deviceId);
                    payload.put("deviceName", deviceName);
                    payload.put("deviceModel", deviceModel);
                    payload.put("deviceBrand", deviceBrand);
                    payload.put("androidVersion", androidVersion);
                }

                URL url = new URL(baseUrl + "/api/heartbeat");
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
            } catch (Exception e) {
                // Silently fail - heartbeat is best-effort
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
    }
}
