import { supabase } from "@/integrations/supabase/client";

interface AuditLogParams {
  action: string;
  details?: Record<string, unknown>;
  email?: string;
}

export const logAuditEvent = async ({ action, details, email }: AuditLogParams): Promise<void> => {
  try {
    const { error } = await supabase.functions.invoke('log-audit-event', {
      body: { action, details, email }
    });
    
    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (err) {
    // Silently fail - audit logging should not break the app
    console.error('Audit logging error:', err);
  }
};

// Common audit actions
export const AuditActions = {
  // Auth events
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  SIGNUP: 'auth.signup',
  PASSWORD_CHANGED: 'auth.password_changed',
  MFA_VERIFIED: 'auth.mfa_verified',
  MFA_FAILED: 'auth.mfa_failed',
  
  // Letter events
  LETTER_SENT: 'letter.sent',
  LETTER_DELETED: 'letter.deleted',
  
  // Document events
  DOCUMENT_DELETED: 'document.deleted',
  
  // User role events
  ROLE_CHANGED: 'user.role_changed',
  
  // Admin events
  SETTINGS_CHANGED: 'admin.settings_changed',
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];
