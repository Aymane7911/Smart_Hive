'use client';

import { useEffect } from 'react';
import { initPushNotifications } from '@/lib/pushNotifications'; // ← changed
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export default function PushNotificationInit() {
  useEffect(() => {
    initPushNotifications(); // ← changed
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setStyle({ style: Style.Dark });
      
    }
  }, []);


  return null;
}