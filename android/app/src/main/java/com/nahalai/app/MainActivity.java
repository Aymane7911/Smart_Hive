package com.nahalai.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // ← REMOVE this line — it was causing the grey strip
        // WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Status bar fix
        Window window = getWindow();
        window.setStatusBarColor(Color.WHITE);
        
        // Make status bar icons dark (visible on white background)
        WindowInsetsControllerCompat controller = 
            new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);

        // Notification channel
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "hive-alerts", "Hive Alerts", NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("NahalAI hive threshold alerts");
            channel.enableVibration(true);
            channel.setShowBadge(true);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }
}