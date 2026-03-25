import React, { useState, useEffect, createContext, useContext } from "react";
import type {
  Session,
  User,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logAuditEvent, AuditActions } from "@/hooks/useAuditLog";
import { debugConsole } from "@/utils/debugConsole";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

type UserSessionRow = Pick<Database["public"]["Tables"]["user_sessions"]["Row"], "id">;

type OnAuthStateChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;
type GetSessionResult = { data: { session: Session | null }; error: unknown | null };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isUserSessionRow = (value: unknown): value is UserSessionRow => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<UserSessionRow>;
  return typeof candidate.id === "string";
};

const normalizeSessionRows = (value: unknown): UserSessionRow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isUserSessionRow);
};

const normalizeLatestSession = (rows: UserSessionRow[]): UserSessionRow | null => {
  if (rows.length === 0) {
    return null;
  }

  return rows[0] ?? null;
};

const trackSession = async (userId: string): Promise<void> => {
  try {
    const deviceInfo = navigator.userAgent;

    const { error: clearExistingError } = await supabase
      .from("user_sessions")
      .update({ is_current: false })
      .eq("user_id", userId)
      .eq("is_current", true);

    if (clearExistingError) {
      throw clearExistingError;
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("user_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("device_info", deviceInfo)
      .order("last_active_at", { ascending: false })
      .limit(1)
      .returns();

    if (existingError) {
      throw existingError;
    }

    const sessionRows = normalizeSessionRows(existingRows);
    const latestSession = normalizeLatestSession(sessionRows);

    if (latestSession) {
      const { error: updateError } = await supabase
        .from("user_sessions")
        .update({ last_active_at: new Date().toISOString(), is_current: true })
        .eq("id", latestSession.id);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    const { error: insertError } = await supabase.from("user_sessions").insert([
      {
        user_id: userId,
        device_info: deviceInfo,
        is_current: true,
        last_active_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      throw insertError;
    }
  } catch (error: unknown) {
    debugConsole.error("Error tracking session:", error);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect((): (() => void) => {
    const handleAuthStateChange: OnAuthStateChangeCallback = (event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (event === "SIGNED_IN") {
        const signedInUserId = nextSession?.user?.id;
        if (signedInUserId) {
          setTimeout((): void => {
            void trackSession(signedInUserId);
          }, 0);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    void supabase.auth.getSession().then((result: GetSessionResult): void => {
      const { data, error } = result;
      if (error) {
        debugConsole.error("Error loading initial session:", error);
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const existingSession = data.session ?? null;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);

      const existingUserId = existingSession?.user?.id;
      if (existingUserId) {
        setTimeout((): void => {
          void trackSession(existingUserId);
        }, 0);
      }
    });

    return (): void => {
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

    localStorage.removeItem("currentTenantId");
    if (activeUser?.id) {
      localStorage.removeItem(`currentTenantId_${activeUser.id}`);
    }

    if (activeUser?.id) {
      try {
        const { error: deleteSessionError } = await supabase
          .from("user_sessions")
          .delete()
          .eq("user_id", activeUser.id)
          .eq("device_info", navigator.userAgent);

        if (deleteSessionError) {
          throw deleteSessionError;
        }
      } catch (error: unknown) {
        debugConsole.error("Error removing session:", error);
      }
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      throw signOutError;
    }
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
