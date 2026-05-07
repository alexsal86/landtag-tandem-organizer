import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback(): React.JSX.Element {
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string; token_hash?: string; type?: string }>();

  useEffect(() => {
    (async () => {
      try {
        if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        } else if (params.token_hash && params.type) {
          await supabase.auth.verifyOtp({
            token_hash: params.token_hash,
            type: params.type as 'magiclink' | 'email' | 'recovery' | 'invite',
          });
        }
      } finally {
        router.replace('/');
      }
    })();
  }, [params.access_token, params.refresh_token, params.token_hash, params.type]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
