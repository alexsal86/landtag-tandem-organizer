import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EMAIL_PATTERN, type LoginCredentials, type PreparedLoginState, type TenantSummary } from '@landtag/domain';
import { createAuthService } from '@landtag/api-client';

interface DashboardState {
  userName: string;
  activeTenant: TenantSummary;
}

export function LoginScreen(): React.JSX.Element {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [status, setStatus] = useState<string>('Nicht angemeldet');
  const [prepared, setPrepared] = useState<PreparedLoginState | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [dashboardState, setDashboardState] = useState<DashboardState | null>(null);

  const authService = useMemo(() => createAuthService(), []);
  const isValidEmail = EMAIL_PATTERN.test(credentials.email);

  const handleLogin = async (): Promise<void> => {
    if (!isValidEmail || !credentials.password) {
      setStatus('Bitte gültige E-Mail und Passwort eingeben.');
      return;
    }

    setStatus('Anmeldung wird vorbereitet ...');
    const result = await authService.prepareLogin(credentials);
    setStatus(result.message);

    if (!result.ok || !result.state) {
      setPrepared(null);
      setSelectedTenantId('');
      return;
    }

    setPrepared(result.state);
    setSelectedTenantId(result.state.defaultTenantId);
  };

  const handleContinue = (): void => {
    if (!prepared) {
      return;
    }

    const activeTenant = prepared.tenants.find((tenant) => tenant.id === selectedTenantId);

    if (!activeTenant) {
      setStatus('Bitte zuerst einen Tenant auswählen.');
      return;
    }

    setDashboardState({
      userName: prepared.userName,
      activeTenant,
    });
    setStatus(`Tenant aktiv: ${activeTenant.displayName}`);
  };

  if (dashboardState) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Willkommen, {dashboardState.userName}</Text>
        <Text style={styles.status}>Aktiver Tenant: {dashboardState.activeTenant.displayName}</Text>
        <Text style={styles.status}>Rolle: {dashboardState.activeTenant.roleLabel}</Text>

        <View style={styles.quickActions}>
          <Text style={styles.quickActionTitle}>Nächste mobile Schritte</Text>
          <Text style={styles.quickActionItem}>• MyWork Inbox als erste echte Liste anbinden</Text>
          <Text style={styles.quickActionItem}>• Tasks mit Offline-Cache ergänzen</Text>
          <Text style={styles.quickActionItem}>• Supabase Session sicher speichern</Text>
        </View>
      </View>
    );
  }

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

      {prepared ? (
        <View style={styles.tenantSection}>
          <Text style={styles.sectionTitle}>Tenant auswählen</Text>
          {prepared.tenants.map((tenant) => {
            const isSelected = tenant.id === selectedTenantId;
            return (
              <Pressable
                key={tenant.id}
                onPress={() => setSelectedTenantId(tenant.id)}
                style={[styles.tenantOption, isSelected && styles.tenantOptionSelected]}
              >
                <Text style={styles.tenantName}>{tenant.displayName}</Text>
                <Text style={styles.tenantRole}>{tenant.roleLabel}</Text>
              </Pressable>
            );
          })}

          <Pressable onPress={handleContinue} style={styles.button}>
            <Text style={styles.buttonText}>Weiter zu MyWork</Text>
          </Pressable>
        </View>
      ) : null}

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
  tenantSection: {
    marginTop: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  tenantOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 10,
    backgroundColor: '#F9FAFB',
  },
  tenantOptionSelected: {
    borderColor: '#155EEF',
    backgroundColor: '#EEF4FF',
  },
  tenantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101828',
  },
  tenantRole: {
    fontSize: 12,
    color: '#475467',
  },
  quickActions: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    gap: 4,
  },
  quickActionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  quickActionItem: {
    fontSize: 13,
    color: '#344054',
  },
});
