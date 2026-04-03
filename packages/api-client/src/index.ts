import type { LoginCredentials } from '@landtag/domain';

interface PreparedLoginResponse {
  ok: boolean;
  message: string;
}

export interface AuthService {
  prepareLogin(credentials: LoginCredentials): Promise<PreparedLoginResponse>;
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

      return {
        ok: true,
        message: 'Eingaben valide. Nächster Schritt: Supabase Auth integrieren.',
      };
    },
  };
}
