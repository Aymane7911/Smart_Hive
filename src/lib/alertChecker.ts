/**
 * lib/alertChecker.ts
 *
 * Sends native push notifications via Firebase Cloud Messaging (FCM).
 * No phone number or CallMeBot key needed — notifications go directly
 * to the logged-in user's Android device via Capacitor.
 */

import { PrismaClient } from '@prisma/client';
import admin from './firebaseAdmin';

const prisma = new PrismaClient();

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SensorReading {
  hiveNumber:  number;
  containerId: string;
  timestamp?:  string;
  int_temp?:   number | null;
  ext_temp?:   number | null;
  int_hum?:    number | null;
  ext_hum?:    number | null;
  weight?:     number | null;
  battery?:    number | null;
  CO2?:        number | null;
  NH3?:        number | null;
  O2?:         number | null;
  VOCs?:       number | null;
  CO?:         number | null;
  NO2?:        number | null;
}

interface Breach {
  param:     string;
  value:     number;
  threshold: number;
  direction: 'above' | 'below';
}

// ─── Threshold evaluation ──────────────────────────────────────────────────────

const checkThresholds = (reading: SensorReading, config: any): Breach[] => {
  const breaches: Breach[] = [];

  const chk = (
    value: number | null | undefined,
    min:   number | null | undefined,
    max:   number | null | undefined,
    label: string,
  ) => {
    if (value == null) return;
    if (max != null && value >= max)
      breaches.push({ param: label, value, threshold: max, direction: 'above' });
    if (min != null && value <= min)
      breaches.push({ param: label, value, threshold: min, direction: 'below' });
  };

  chk(reading.int_temp, config.tempInternalMin, config.tempInternalMax, 'Internal Temp');
  chk(reading.ext_temp, config.tempExternalMin, config.tempExternalMax, 'External Temp');
  chk(reading.int_hum,  config.humidityMin,     config.humidityMax,     'Humidity');
  chk(reading.weight,   config.weightMin,        config.weightMax,       'Weight');
  chk(reading.battery,  config.batteryMin,       null,                   'Battery');
  chk(reading.CO2,      null,                    config.co2Max,          'CO2');
  chk(reading.NH3,      null,                    config.nh3Max,          'NH3');
  chk(reading.O2,       config.o2Min,            null,                   'O2');
  chk(reading.VOCs,     null,                    config.vocsMax,         'VOCs');
  chk(reading.CO,       null,                    config.coMax,           'CO');
  chk(reading.NO2,      null,                    config.no2Max,          'NO2');

  return breaches;
};

// ─── FCM sender ────────────────────────────────────────────────────────────────

const sendFCMNotification = async (
  fcmToken: string,
  title:    string,
  body:     string,
): Promise<boolean> => {
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      android: {
        priority: 'high',
        notification: {
          sound:      'default',
          channelId:  'hive-alerts',
          priority:   'max',
          visibility: 'public',
        },
      },
    });
    console.log('✅ [alertChecker] FCM notification sent');
    return true;
  } catch (err) {
    console.error('❌ [alertChecker] FCM send failed:', err instanceof Error ? err.message : err);
    return false;
  }
};

// ─── Cooldown check ────────────────────────────────────────────────────────────

const isOnCooldown = (config: any): boolean => {
  if (!config.lastAlertAt) return false;
  const elapsedMinutes = (Date.now() - new Date(config.lastAlertAt).getTime()) / 60000;
  return elapsedMinutes < (config.cooldownMinutes ?? 60);
};

// ─── Format notification body ──────────────────────────────────────────────────

const formatBody = (breaches: Breach[]): string =>
  breaches
    .map(b => `${b.direction === 'above' ? '⬆' : '⬇'} ${b.param}: ${b.value.toFixed(1)} (limit ${b.threshold.toFixed(1)})`)
    .join('\n');

// ─── Main entry point ──────────────────────────────────────────────────────────

/**
 * Evaluate sensor readings against all matching AlertConfigs for this user
 * and container, then send FCM push notifications for any threshold breaches.
 *
 * @param readings    Array of sensor readings to evaluate
 * @param userId      Authenticated user ID
 * @param containerId Apiary/container ID
 * @param isTest      When true: skips cooldown, always sends, labels as TEST
 */
export const checkAndSendAlerts = async (
  readings:    SensorReading[],
  userId:      number,
  containerId: string,
  isTest       = false,
): Promise<void> => {
  try {
    // Fetch user's FCM token
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      console.warn('⚠️ [alertChecker] No FCM token for user', userId, '— skipping');
      return;
    }

    // Fetch all enabled alert configs for this user + container
    const configs = await (prisma as any).alertConfig.findMany({
      where: { userId, containerId, isEnabled: true },
    });

    if (!configs.length) {
      console.log('[alertChecker] No enabled configs for', { userId, containerId });
      return;
    }

    for (const reading of readings) {
      // Find config for this specific hive, or fall back to the "all hives" config (hiveNumber 0)
      const config =
        configs.find((c: any) => c.hiveNumber === reading.hiveNumber) ??
        configs.find((c: any) => c.hiveNumber === 0);

      if (!config) continue;

      if (!isTest && isOnCooldown(config)) {
        console.log(`⏳ [alertChecker] Hive ${reading.hiveNumber} on cooldown, skipping`);
        continue;
      }

      let breaches: Breach[];

      if (isTest) {
        breaches = checkThresholds(reading, config);
        // Guarantee a message even when no thresholds are configured yet
        if (!breaches.length) {
          breaches = [{ param: 'Test Signal', value: 42, threshold: 0, direction: 'above' }];
        }
      } else {
        breaches = checkThresholds(reading, config);
        if (!breaches.length) continue;
      }

      console.log(
        isTest
          ? `🧪 [alertChecker] Sending test notification for hive ${reading.hiveNumber}`
          : `🚨 [alertChecker] Hive ${reading.hiveNumber}: ${breaches.length} breach(es)`,
      );

      const title = isTest
        ? '🧪 NahalAI Test Alert'
        : `🐝 Hive ${reading.hiveNumber} Alert`;

      const body = isTest
        ? '✅ Your push notifications are working!'
        : formatBody(breaches);

      const sent = await sendFCMNotification(user.fcmToken, title, body);

      // Only update cooldown timestamp for real alerts
      if (sent && !isTest) {
        await (prisma as any).alertConfig.update({
          where: { id: config.id },
          data:  { lastAlertAt: new Date() },
        });
      }
    }
  } catch (err) {
    // Never crash the data pipeline
    console.error('❌ [alertChecker] Unexpected error:', err instanceof Error ? err.message : err);
  }
};