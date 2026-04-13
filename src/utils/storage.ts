/**
 * Sichere localStorage-Wrapper für private/incognito-Modus Kompatibilität.
 * In manchen Browsern wirft localStorage.getItem() in eingeschränkten Kontexten.
 */

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private/incognito Modus – ignorieren
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Private/incognito Modus – ignorieren
  }
}

export function safeParse<T>(key: string, fallback: T): T {
  try {
    const raw = safeGetItem(key);
    if (raw === null) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeStringify(key: string, value: unknown): void {
  try {
    safeSetItem(key, JSON.stringify(value));
  } catch {
    // Serialisierungsfehler – ignorieren
  }
}
