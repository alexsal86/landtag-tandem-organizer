import React, { useState, useEffect, createContext, useContext } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent, AuditActions } from "@/hooks/useAuditLog";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const trackSession = async (userId: string) => {
  try {
    // Upsert session based on user_id + device
    const deviceInfo = navigator.userAgent;
    
    // Check if a session with this device already exists
    const { data: existing } = await supabase
      .from('user_sessions' as any)
      .select('id')
      .eq('user_id', userId)
      .eq('device_info', deviceInfo)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update last_active_at
      await supabase
        .from('user_sessions' as any)
        .update({ last_active_at: new Date().toISOString(), is_current: true } as any)
        .eq('id', (existing[0] as any).id);
    } else {
      // Insert new session
      await supabase
        .from('user_sessions' as any)
        .insert({
          user_id: userId,
          device_info: deviceInfo,
          is_current: true,
          last_active_at: new Date().toISOString(),
        } as any);
    }
  } catch (error) {
    console.error('Error tracking session:', error);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Track session on sign in
        if (event === 'SIGNED_IN' && session?.user?.id) {
          setTimeout(() => trackSession(session.user.id), 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Track session for existing login
      if (session?.user?.id) {
        setTimeout(() => trackSession(session.user.id), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Log logout before signing out (while we still have user info)
    if (user?.email) {
      logAuditEvent({ 
        action: AuditActions.LOGOUT, 
        email: user.email,
        details: { user_id: user.id }
      });
    }
    
    // Clear tenant selection on logout to prevent cross-user tenant leakage
    localStorage.removeItem('currentTenantId');
    if (user?.id) {
      localStorage.removeItem(`currentTenantId_${user.id}`);
    }
    
    // Remove current session tracking
    if (user?.id) {
      try {
        await supabase
          .from('user_sessions' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('device_info', navigator.userAgent);
      } catch (e) {
        console.error('Error removing session:', e);
      }
    }
    
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
