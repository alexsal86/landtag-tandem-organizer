import { Stack } from 'expo-router';
import { AuthProvider } from '@/state/AuthContext';
import { ToastProvider } from '@/ui/Toast';

export default function RootLayout(): React.JSX.Element {
  return (
    <AuthProvider>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ToastProvider>
    </AuthProvider>
  );
}
