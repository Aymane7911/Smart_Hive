'use client';

import { useEffect } from 'react';
import { initPushNotifications } from '@/lib/pushNotifications'; // ← changed

export default function PushNotificationInit() {
  useEffect(() => {
    initPushNotifications(); // ← changed
  }, []);

  return null;
}