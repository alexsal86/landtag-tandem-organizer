import type { LoginCredentials, PreparedLoginState } from '@landtag/domain';

interface PreparedLoginResponse {
  ok: boolean;
  message: string;
  state?: PreparedLoginState;
}

export interface AuthService {
  prepareLogin(credentials: LoginCredentials): Promise<PreparedLoginResponse>;
}

function deriveMockTenants(email: string): PreparedLoginState['tenants'] {
  const normalizedEmail = email.toLowerCase();

  if (normalizedEmail.endsWith('@fraktion.de')) {
    return [
      { id: 'gruene-fraktion', displayName: 'Fraktion Bündnis 90/Die Grünen', roleLabel: 'Mitarbeiter:in' },
      { id: 'buero-karlsruhe', displayName: 'Wahlkreisbüro Karlsruhe', roleLabel: 'Koordination' },
    ];
  }

  return [{ id: 'demo-tenant', displayName: 'Demo-Tenant', roleLabel: 'Gastzugang' }];
}

export function createAuthService(): AuthService {
  return {
    async prepareLogin(credentials): Promise<PreparedLoginResponse> {
      if (!credentials.email || !credentials.password) {
        return {
          ok: false,
          message: 'Login unvollständig. API-Aufruf wurde nicht gestartet.',
        };
      }

      const tenants = deriveMockTenants(credentials.email);
      const userName = credentials.email.split('@')[0]?.replace('.', ' ') ?? 'Nutzer:in';

      return {
        ok: true,
        message: 'Anmeldung vorbereitet. Tenant-Auswahl ist bereit.',
        state: {
          userName,
          tenants,
          defaultTenantId: tenants[0]?.id ?? 'demo-tenant',
        },
      };
    },
  };
}
