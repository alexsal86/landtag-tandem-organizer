import { Alert, Linking, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

export type PermissionKind = 'microphone' | 'camera' | 'mediaLibrary';

type PermStatus = { granted: boolean; canAskAgain: boolean };

const COPY: Record<PermissionKind, { title: string; message: string }> = {
  microphone: {
    title: 'Mikrofon-Zugriff benötigt',
    message:
      'Für Sprachnotizen brauchen wir Zugriff auf dein Mikrofon. Du kannst das jederzeit in den Einstellungen aktivieren.',
  },
  camera: {
    title: 'Kamera-Zugriff benötigt',
    message:
      'Um Fotos und Belege aufzunehmen, brauchen wir Zugriff auf deine Kamera. Du kannst das in den Einstellungen aktivieren.',
  },
  mediaLibrary: {
    title: 'Foto-Zugriff benötigt',
    message:
      'Um Bilder aus deiner Galerie zu wählen, brauchen wir Zugriff auf deine Fotos. Du kannst das in den Einstellungen aktivieren.',
  },
};

async function getStatus(kind: PermissionKind): Promise<PermStatus> {
  if (kind === 'microphone') {
    const r = await Audio.getPermissionsAsync();
    return { granted: r.granted, canAskAgain: r.canAskAgain };
  }
  if (kind === 'camera') {
    const r = await ImagePicker.getCameraPermissionsAsync();
    return { granted: r.granted, canAskAgain: r.canAskAgain };
  }
  const r = await ImagePicker.getMediaLibraryPermissionsAsync();
  return { granted: r.granted, canAskAgain: r.canAskAgain };
}

async function request(kind: PermissionKind): Promise<PermStatus> {
  if (kind === 'microphone') {
    const r = await Audio.requestPermissionsAsync();
    return { granted: r.granted, canAskAgain: r.canAskAgain };
  }
  if (kind === 'camera') {
    const r = await ImagePicker.requestCameraPermissionsAsync();
    return { granted: r.granted, canAskAgain: r.canAskAgain };
  }
  const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return { granted: r.granted, canAskAgain: r.canAskAgain };
}

function showSettingsAlert(kind: PermissionKind): void {
  const { title, message } = COPY[kind];
  Alert.alert(title, message, [
    { text: 'Abbrechen', style: 'cancel' },
    {
      text: 'Einstellungen öffnen',
      onPress: () => {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Linking.openSettings().catch(() => {
            /* noop */
          });
        }
      },
    },
  ]);
}

/**
 * Stellt sicher, dass die Berechtigung erteilt ist.
 * - Erteilt → true
 * - Erstanfrage möglich → System-Dialog zeigen
 * - Dauerhaft verweigert → Hinweis mit „Einstellungen öffnen"
 */
export async function ensurePermission(kind: PermissionKind): Promise<boolean> {
  const initial = await getStatus(kind);
  if (initial.granted) return true;

  if (initial.canAskAgain) {
    const after = await request(kind);
    if (after.granted) return true;
    if (!after.canAskAgain) showSettingsAlert(kind);
    return false;
  }

  showSettingsAlert(kind);
  return false;
}
