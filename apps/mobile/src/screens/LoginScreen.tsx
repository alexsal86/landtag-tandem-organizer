import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EMAIL_PATTERN, type LoginCredentials } from '@landtag/domain';
import { createAuthService } from '@landtag/api-client';

export function LoginScreen(): React.JSX.Element {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [status, setStatus] = useState<string>('Nicht angemeldet');

  const authService = createAuthService();
  const isValidEmail = EMAIL_PATTERN.test(credentials.email);

  const handleLogin = async (): Promise<void> => {
    if (!isValidEmail || !credentials.password) {
      setStatus('Bitte gültige E-Mail und Passwort eingeben.');
      return;
    }

    setStatus('Anmeldung wird vorbereitet ...');
    const result = await authService.prepareLogin(credentials);
    setStatus(result.message);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>E-Mail</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="name@buero.de"
        value={credentials.email}
        onChangeText={(value) => setCredentials((current) => ({ ...current, email: value.trim() }))}
        style={styles.input}
      />

      <Text style={styles.label}>Passwort</Text>
      <TextInput
        secureTextEntry
        placeholder="••••••••"
        value={credentials.password}
        onChangeText={(value) => setCredentials((current) => ({ ...current, password: value }))}
        style={styles.input}
      />

      <Pressable onPress={handleLogin} style={styles.button}>
        <Text style={styles.buttonText}>Anmelden</Text>
      </Pressable>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#155EEF',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  status: {
    marginTop: 8,
    fontSize: 13,
    color: '#475467',
  },
});
