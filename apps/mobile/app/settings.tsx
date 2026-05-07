import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/AuthContext';

const BIO_FLAG_KEY = 'landtag.biometricEnabled';
const BIO_REFRESH_KEY = 'landtag.biometricRefreshToken';

export default function SettingsScreen(): React.JSX.Element {
  const { session, tenants, activeTenantId, setActiveTenant, signOut } = useAuth();
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBioAvailable(has && enrolled);
      const flag = await SecureStore.getItemAsync(BIO_FLAG_KEY);
      setBioEnabled(flag === '1');
    })();
  }, []);

  const toggleBio = async (next: boolean) => {
    if (next) {
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Biometrie aktivieren' });
      if (!res.success) return;
      const refresh = session?.refresh_token;
      if (!refresh) {
        Alert.alert('Keine Session', 'Bitte erneut anmelden.');
        return;
      }
      await SecureStore.setItemAsync(BIO_REFRESH_KEY, refresh);
      await SecureStore.setItemAsync(BIO_FLAG_KEY, '1');
      setBioEnabled(true);
    } else {
      await SecureStore.deleteItemAsync(BIO_REFRESH_KEY);
      await SecureStore.deleteItemAsync(BIO_FLAG_KEY);
      setBioEnabled(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Zurück</Text></Pressable>
        <Text style={styles.title}>Einstellungen</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Konto</Text>
        <Text style={styles.muted}>{session?.user.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tenant</Text>
        {tenants.map((t) => {
          const active = t.id === activeTenantId;
          return (
            <Pressable
              key={t.id}
              onPress={() => setActiveTenant(t.id)}
              style={[styles.row, active && styles.rowActive]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t.name}</Text>
                <Text style={styles.muted}>{t.role}</Text>
              </View>
              {active ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {bioAvailable ? (
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Biometrie-Login</Text>
              <Text style={styles.muted}>Face ID / Fingerabdruck statt Passwort</Text>
            </View>
            <Switch value={bioEnabled} onValueChange={toggleBio} />
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={async () => { await signOut(); router.replace('/login'); }}
        style={[styles.row, { marginTop: 24, justifyContent: 'center' }]}
      >
        <Text style={{ color: '#DC2626', fontWeight: '700' }}>Abmelden</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  back: { color: '#155EEF', fontSize: 16, width: 60 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#0D1B2A' },
  section: { marginTop: 16, paddingHorizontal: 16, gap: 8 },
  sectionTitle: { fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB',
  },
  rowActive: { borderColor: '#155EEF', backgroundColor: '#EEF4FF' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#0D1B2A' },
  muted: { color: '#6B7280', fontSize: 13 },
  check: { color: '#155EEF', fontSize: 18, fontWeight: '700' },
});
