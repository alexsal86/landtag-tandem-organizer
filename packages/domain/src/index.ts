export interface LoginCredentials {
  email: string;
  password: string;
}

export interface TenantSummary {
  id: string;
  displayName: string;
  roleLabel: string;
}

export interface PreparedLoginState {
  userName: string;
  tenants: TenantSummary[];
  defaultTenantId: string;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
