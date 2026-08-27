package com.sri.tracerjemputan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

public class PushWakeReceiver extends BroadcastReceiver {
    private static PowerManager.WakeLock wakeLock;

    @Override
    public void onReceive(Context context, Intent intent) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            // Acquire wake lock to forcefully turn the screen on for 5 seconds
            wakeLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                PowerManager.ON_AFTER_RELEASE,
                "TRACER:PushWakeLock"
            );
            wakeLock.acquire(5000); // 5 seconds duration
        }
    }
}
