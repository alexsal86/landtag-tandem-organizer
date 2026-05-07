import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/state/AuthContext';

export default function IndexScreen(): React.JSX.Element {
  const { initializing, session } = useAuth();

  useEffect(() => {
    // noop; just to satisfy hooks dep
  }, [session]);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  return <Redirect href="/home" />;
}
