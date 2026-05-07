import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';

interface TenantOption {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  initializing: boolean;
  session: Session | null;
  tenants: TenantOption[];
  activeTenantId: string | null;
  setActiveTenant: (tenantId: string) => Promise<void>;
  signOut: () => Promise<void>;
  reloadTenants: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const ACTIVE_TENANT_KEY = 'landtag.activeTenantId';

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  const loadTenants = async (uid: string): Promise<void> => {
    const { data, error } = await supabase
      .from('tenant_users')
      .select('tenant_id, role, tenants(name)')
      .eq('user_id', uid)
      .eq('active', true);
    if (error) {
      setTenants([]);
      return;
    }
    type Row = { tenant_id: string; role: string; tenants: { name: string } | { name: string }[] | null };
    const rows = (data ?? []) as Row[];
    const list: TenantOption[] = rows.map((r) => {
      const t = Array.isArray(r.tenants) ? r.tenants[0] : r.tenants;
      return { id: r.tenant_id, name: t?.name ?? 'Tenant', role: r.role };
    });
    setTenants(list);
    const stored = await SecureStore.getItemAsync(ACTIVE_TENANT_KEY);
    const valid = stored && list.some((t) => t.id === stored) ? stored : list[0]?.id ?? null;
    setActiveTenantId(valid);
    if (valid && valid !== stored) {
      await SecureStore.setItemAsync(ACTIVE_TENANT_KEY, valid);
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user.id) {
        await loadTenants(data.session.user.id);
      }
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      if (sess?.user.id) {
        await loadTenants(sess.user.id);
      } else {
        setTenants([]);
        setActiveTenantId(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      initializing,
      session,
      tenants,
      activeTenantId,
      setActiveTenant: async (tenantId) => {
        setActiveTenantId(tenantId);
        await SecureStore.setItemAsync(ACTIVE_TENANT_KEY, tenantId);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        await SecureStore.deleteItemAsync(ACTIVE_TENANT_KEY);
        await SecureStore.deleteItemAsync('landtag.biometricEnabled');
      },
      reloadTenants: async () => {
        if (session?.user.id) await loadTenants(session.user.id);
      },
    }),
    [initializing, session, tenants, activeTenantId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
