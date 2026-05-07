import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/state/AuthContext';

export default function IndexScreen(): React.JSX.Element {
  const { initializing, session } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('landtag.onboardingDone').then((v) => setOnboarded(v === '1'));
  }, []);

  if (initializing || onboarded === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!session) return <Redirect href="/login" />;
  return <Redirect href="/home" />;
}
