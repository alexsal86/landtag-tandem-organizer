// Lightweight Push-Token-Registrierung. Verwendet expo-notifications, falls verfügbar.
// expo-notifications ist optional – wenn das Modul fehlt, wird sauber no-op zurückgegeben.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

type Notif = {
  getPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  getExpoPushTokenAsync: (opts?: { projectId?: string }) => Promise<{ data: string }>;
  setNotificationHandler: (h: unknown) => void;
};

async function loadNotifications(): Promise<Notif | null> {
  try {
    // Dynamischer Import damit Bundler nicht hart fehlschlägt, falls Paket fehlt
    // @ts-expect-error optional dependency, may be unavailable in non-EAS builds
    const mod = await import('expo-notifications');
    return mod as unknown as Notif;
  } catch {
    return null;
  }
}

export async function registerForPushAndStoreToken(): Promise<
  { ok: true; token: string } | { ok: false; reason: string }
> {
  const N = await loadNotifications();
  if (!N) return { ok: false, reason: 'expo-notifications nicht installiert' };

  try {
    const status = await N.getPermissionsAsync();
    if (!status.granted) {
      const req = await N.requestPermissionsAsync();
      if (!req.granted) return { ok: false, reason: 'Berechtigung verweigert' };
    }

    const projectId =
      // @ts-expect-error eas projectId exists at runtime
      (Constants?.expoConfig?.extra?.eas?.projectId as string | undefined) ??
      // @ts-expect-error legacy field
      (Constants?.easConfig?.projectId as string | undefined);

    const tokenData = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenData.data;

    const { error } = await supabase.functions.invoke('register-mobile-push-token', {
      body: {
        token,
        platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        // @ts-expect-error nativeApplicationVersion exists at runtime
        app_version: Constants?.nativeApplicationVersion ?? null,
      },
    });
    if (error) return { ok: false, reason: error.message };

    return { ok: true, token };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Unbekannt' };
  }
}
