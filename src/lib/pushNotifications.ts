// src/lib/pushNotifications.ts
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Call this once on app load (inside your root useEffect).
 * Requests permission, registers with FCM, and saves the token to your backend.
 * Safe to call in browser — it no-ops if not running as a native app.
 */
export const initPushNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Request permission
    const { receive } = await PushNotifications.requestPermissions();
    if (receive !== 'granted') {
      console.warn('[push] Permission denied');
      return;
    }

    await PushNotifications.register();

    // Token received from FCM
    PushNotifications.addListener('registration', async (token) => {
      console.log('[push] FCM token:', token.value);
      try {
        await fetch('/api/smart-hive/alerts/register-token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ fcmToken: token.value }),
        });
        console.log('[push] Token saved to server');
      } catch (e) {
        console.error('[push] Failed to save token:', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[push] Registration error:', err);
    });

    // Foreground notification received
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
  const title = notification.title ?? (notification.data?.title) ?? '🐝 NahalAI Alert';
  const body  = notification.body  ?? (notification.data?.body)  ?? '';

  await LocalNotifications.schedule({
    notifications: [{
      title,
      body,
      id:        Math.floor(Math.random() * 100000),
      channelId: 'hive-alerts',
      schedule:  { at: new Date(Date.now() + 300) },
    }],
  });
});

    // User tapped a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[push] Notification tapped:', action.notification);
    });

  } catch (err) {
    console.error('[push] Init error:', err);
  }
};

/**
 * Call this on logout to clear the FCM token from the server.
 */
export const clearPushToken = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await fetch('/api/smart-hive/alerts/register-token', { method: 'DELETE' });
  } catch (e) {
    console.error('[push] Failed to clear token:', e);
  }
};