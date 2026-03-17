import { debugConsole } from '@/utils/debugConsole';

export interface HandleErrorOptions {
  /** Context label for logging (e.g. 'useAuth.signOut') */
  context?: string;
  /** Whether to show a toast notification. Requires passing toast fn. */
  toast?: {
    fn: (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
    title?: string;
    description?: string;
  };
  /** If true, rethrows the error after handling */
  rethrow?: boolean;
}

/**
 * Extracts a human-readable message from an unknown error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    // Handle Supabase PostgrestError objects: { message, details, hint, code }
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.details === 'string' && obj.details) return obj.details;
    if ('message' in obj) return String(obj.message);
  }
  return 'Ein unbekannter Fehler ist aufgetreten.';
}

/**
 * Central error handler for consistent logging, toast display, and error propagation.
 *
 * Usage:
 * ```ts
 * try { ... }
 * catch (error) {
 *   handleAppError(error, {
 *     context: 'useLetters.save',
 *     toast: { fn: toast, title: 'Speichern fehlgeschlagen' },
 *   });
 * }
 * ```
 */
export function handleAppError(error: unknown, options: HandleErrorOptions = {}): void {
  const message = getErrorMessage(error);
  const label = options.context ? `[${options.context}]` : '[AppError]';

  debugConsole.error(label, message, error);

  if (options.toast) {
    options.toast.fn({
      title: options.toast.title || 'Fehler',
      description: options.toast.description || message,
      variant: 'destructive',
    });
  }

  if (options.rethrow) {
    throw error;
  }
}
