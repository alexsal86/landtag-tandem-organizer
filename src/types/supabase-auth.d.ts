// Type augmentation to bridge supabase-js v2 API used throughout codebase
// with the installed version's type declarations.
import type { SupabaseClient } from '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  export interface User {
    id: string;
    email?: string;
    [key: string]: any;
  }

  interface SupabaseAuthClient {
    getUser(): Promise<{ data: { user: User | null }; error: any }>;
    updateUser(attributes: Record<string, any>): Promise<{ data: { user: User | null }; error: any }>;
    mfa: {
      enroll(params: any): Promise<any>;
      challenge(params: any): Promise<any>;
      verify(params: any): Promise<any>;
      unenroll(params: any): Promise<any>;
      listFactors(): Promise<any>;
    };
  }
}
