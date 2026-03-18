import React, { useState, useEffect, createContext, useContext } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent, AuditActions } from "@/hooks/useAuditLog";
import { debugConsole } from "@/utils/debugConsole";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

type UserSessionRow = {
  id: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const trackSession = async (userId: string): Promise<void> => {
  try {
    const deviceInfo = navigator.userAgent;

    await supabase
      .from('user_sessions')
      .update({ is_current: false })
      .eq('user_id', userId)
      .eq('is_current', true);

    const { data: existing } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('device_info', deviceInfo)
      .order('last_active_at', { ascending: false })
      .limit(1);

    const existingSessions = (existing ?? []) as UserSessionRow[];
    const latestSessionId = existingSessions[0]?.id;

    if (latestSessionId) {
      await supabase
        .from('user_sessions')
        .update({ last_active_at: new Date().toISOString(), is_current: true })
        .eq('id', latestSessionId);
      return;
    }

    await supabase
      .from('user_sessions')
      .insert([
        {
          user_id: userId,
          device_info: deviceInfo,
          is_current: true,
          last_active_at: new Date().toISOString(),
        },
      ]);
  } catch (error: unknown) {
    debugConsole.error('Error tracking session:', error);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const handleAuthStateChange = (event: AuthChangeEvent, nextSession: Session | null): void => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN') {
        const signedInUserId = nextSession?.user?.id;
        if (signedInUserId) {
          setTimeout(() => {
            void trackSession(signedInUserId);
          }, 0);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    void supabase.auth.getSession().then((sessionResult: { data: { session: Session | null } }): void => {
      const existingSession = sessionResult.data.session ?? null;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);

      const existingUserId = existingSession?.user?.id;
      if (existingUserId) {
        setTimeout(() => {
          void trackSession(existingUserId);
        }, 0);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async (): Promise<void> => {
    const activeUser = user;
    if (activeUser?.email) {
      logAuditEvent({
        action: AuditActions.LOGOUT,
        email: activeUser.email,
        details: { user_id: activeUser.id },
      });
    }

    localStorage.removeItem('currentTenantId');
    if (activeUser?.id) {
      localStorage.removeItem(`currentTenantId_${activeUser.id}`);
    }

    if (activeUser?.id) {
      try {
        await supabase
          .from('user_sessions')
          .delete()
          .eq('user_id', activeUser.id)
          .eq('device_info', navigator.userAgent);
      } catch (error: unknown) {
        debugConsole.error('Error removing session:', error);
      }
    }

    await supabase.auth.signOut({ scope: 'local' });
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
