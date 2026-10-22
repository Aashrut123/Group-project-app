import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { planReminders } from '@/lib/reminders';
import type { CalendarEvent, Task } from '@/types/database';

const PREFERENCE_KEY = 'groupsync-phone-alerts';
const CHANNEL_ID = 'groupsync-reminders';

export type AlertPreference = 'on' | 'off' | 'unset';
export type AlertToggleResult = 'on' | 'off' | 'denied' | 'unsupported';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

export async function phoneAlertsPreference(): Promise<AlertPreference> {
  const value = await AsyncStorage.getItem(PREFERENCE_KEY);
  if (value === 'on' || value === 'off') return value;
  return 'unset';
}

export async function cancelPhoneAlerts(): Promise<void> {
  if (Platform.OS === 'web') return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((item) => item.identifier.startsWith('groupsync-'))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

export async function setPhoneAlerts(enabled: boolean): Promise<AlertToggleResult> {
  if (Platform.OS === 'web') return 'unsupported';
  if (!enabled) {
    await AsyncStorage.setItem(PREFERENCE_KEY, 'off');
    await cancelPhoneAlerts();
    return 'off';
  }
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    await AsyncStorage.setItem(PREFERENCE_KEY, 'off');
    return 'denied';
  }
  await AsyncStorage.setItem(PREFERENCE_KEY, 'on');
  return 'on';
}

let queue: Promise<void> = Promise.resolve();

export function syncPhoneAlerts(tasks: Task[], events: CalendarEvent[], signedIn: boolean): void {
  queue = queue
    .then(async () => {
      if (Platform.OS === 'web') return;
      if (!signedIn) {
        await cancelPhoneAlerts();
        return;
      }
      const preference = await phoneAlertsPreference();
      if (preference === 'off') return;
      if (preference === 'unset') {
        const result = await setPhoneAlerts(true);
        if (result !== 'on') return;
      } else {
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) return;
      }
      await ensureChannel();
      const planned = planReminders(tasks, events);
      await cancelPhoneAlerts();
      for (const alert of planned) {
        await Notifications.scheduleNotificationAsync({
          identifier: alert.id,
          content: {
            title: alert.title,
            body: alert.body,
            data: { href: alert.href },
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: alert.when,
            channelId: CHANNEL_ID,
          },
        });
      }
    })
    .catch(() => undefined);
}
