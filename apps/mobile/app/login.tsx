import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/AuthContext';

const BIO_FLAG_KEY = 'landtag.biometricEnabled';
const BIO_REFRESH_KEY = 'landtag.biometricRefreshToken';

export default function LoginScreen(): React.JSX.Element {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);

  useEffect(() => {
    if (session) router.replace('/home');
  }, [session]);

  useEffect(() => {
    (async () => {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBioAvailable(has && enrolled);
      const flag = await SecureStore.getItemAsync(BIO_FLAG_KEY);
      const tok = await SecureStore.getItemAsync(BIO_REFRESH_KEY);
      setBioEnabled(flag === '1' && !!tok);
    })();
  }, []);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const handlePassword = () =>
    withBusy(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        Alert.alert('Login fehlgeschlagen', error.message);
      }
    });

  const handleMagicLink = () =>
    withBusy(async () => {
      if (!email.trim()) {
        Alert.alert('E-Mail fehlt', 'Bitte E-Mail eingeben.');
        return;
      }
      const redirectTo = Linking.createURL('/auth/callback');
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) Alert.alert('Magic Link', error.message);
      else Alert.alert('Mail unterwegs', 'Login-Link geöffnet, dann zur App zurück.');
    });

  const handleGoogle = () => {
    Alert.alert(
      'Google Sign-In',
      'Google-Anmeldung ist vorbereitet, aber noch nicht konfiguriert. Bitte Client-IDs in Google Cloud + Supabase Provider einrichten.',
    );
  };

  const handleBiometric = () =>
    withBusy(async () => {
      const refresh = await SecureStore.getItemAsync(BIO_REFRESH_KEY);
      if (!refresh) return;
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Anmeldung bestätigen' });
      if (!res.success) return;
      const { error } = await supabase.auth.refreshSession({ refresh_token: refresh });
      if (error) Alert.alert('Sitzung abgelaufen', 'Bitte erneut mit E-Mail anmelden.');
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Landtag Mobile</Text>
        <Text style={styles.subtitle}>Anmeldung</Text>

        {bioAvailable && bioEnabled ? (
          <Pressable onPress={handleBiometric} disabled={busy} style={[styles.button, styles.bioBtn]}>
            <Text style={styles.buttonText}>🔒 Mit Biometrie anmelden</Text>
          </Pressable>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>E-Mail</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@buero.de"
            style={styles.input}
            editable={!busy}
          />
          <Text style={styles.label}>Passwort</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            style={styles.input}
            editable={!busy}
          />
          <Pressable onPress={handlePassword} disabled={busy} style={styles.button}>
            <Text style={styles.buttonText}>Anmelden</Text>
          </Pressable>
          <Pressable onPress={handleMagicLink} disabled={busy} style={[styles.button, styles.secondary]}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Login-Link per Mail</Text>
          </Pressable>
          <Pressable onPress={handleGoogle} disabled={busy} style={[styles.button, styles.secondary]}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Mit Google anmelden</Text>
          </Pressable>
          {busy ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, backgroundColor: '#F7F8FA', flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#0D1B2A' },
  subtitle: { fontSize: 15, color: '#415A77', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  label: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, backgroundColor: '#fff',
  },
  button: { marginTop: 8, backgroundColor: '#155EEF', borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  bioBtn: { backgroundColor: '#0D1B2A' },
  secondary: { backgroundColor: '#EEF4FF' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryText: { color: '#155EEF' },
});
