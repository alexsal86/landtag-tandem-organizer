// Type augmentation to bridge supabase-js v2 API used throughout codebase
// with the installed version's type declarations.

declare module '@supabase/supabase-js' {
  export interface User {
    id: string;
    email?: string;
    [key: string]: any;
  }

  interface SupabaseAuthClient {
    getUser(): Promise<{ data: { user: User | null }; error: any }>;
    getSession(): Promise<{ data: { session: any | null }; error: any }>;
    updateUser(attributes: Record<string, any>): Promise<{ data: { user: User | null }; error: any }>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<any>;
    signUp(credentials: { email: string; password: string; options?: any }): Promise<any>;
    signOut(): Promise<any>;
    onAuthStateChange(callback: (event: string, session: any) => void): { data: { subscription: any } };
    resetPasswordForEmail(email: string, options?: any): Promise<any>;
    mfa: {
      enroll(params: any): Promise<any>;
      challenge(params: any): Promise<any>;
      verify(params: any): Promise<any>;
      unenroll(params: any): Promise<any>;
      listFactors(): Promise<any>;
      getAuthenticatorAssuranceLevel(): Promise<any>;
      [key: string]: any;
    };
    [key: string]: any;
  }
}
