import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function isExpoGo(): boolean {
  return isRunningInExpoGo();
}

export async function registerForPushNotifications(): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('Push obaveštenja možete uključiti u mobilnoj aplikaciji.');
  }
  if (isExpoGo()) {
    throw new Error('Push obaveštenja zahtevaju instaliranu FixHome development ili produkcionu aplikaciju. Expo Go ih ne podržava.');
  }

  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    throw new Error('Push obaveštenja nisu podešena: nedostaje EAS project ID.');
  }

  const Notifications = await import('expo-notifications');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Novi poslovi',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  const permission = currentPermission.granted
    ? currentPermission
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Dozvolite push obaveštenja u podešavanjima telefona.');
  }

  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
