import { Stack } from 'expo-router';
import { AuthProvider } from '@/state/AuthContext';

export default function RootLayout(): React.JSX.Element {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
