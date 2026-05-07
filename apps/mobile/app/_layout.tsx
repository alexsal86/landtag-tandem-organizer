import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/state/AuthContext';
import { ToastProvider } from '@/ui/Toast';
import { flushOutbox } from '@/lib/offlineOutbox';
import { registerForPushAndStoreToken } from '@/lib/pushNotifications';

function PushRegistrar(): null {
  const { session } = useAuth();
  useEffect(() => {
    if (!session?.user.id) return;
    void registerForPushAndStoreToken();
  }, [session?.user.id]);
  return null;
}

export default function RootLayout(): React.JSX.Element {
  useEffect(() => {
    // Initial flush on app start
    void flushOutbox();
    // Flush whenever app becomes active again (likely back online)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushOutbox();
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <PushRegistrar />
          <Stack screenOptions={{ headerShown: false }} />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
