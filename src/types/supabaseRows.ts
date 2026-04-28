/**
 * Helper-Typen für Supabase-Query-Callbacks.
 *
 * Hintergrund: Aufgrund eines Bun-Symlink-Problems (siehe supabase-fix.d.ts) liefern
 * Supabase-Generics aktuell `any`. Damit wir trotzdem `noImplicitAny` aktivieren können,
 * verwenden wir benannte, dokumentierte Row-Typen statt impliziter oder roher `any`-Casts.
 *
 * Sobald die Generics wieder greifen, können diese Typen schrittweise gegen die
 * generierten `Database['public']['Tables'][...]['Row']`-Typen ausgetauscht werden.
 */

/** Generische Supabase-Row mit unbekannten Spalten. Bevorzugt vor `any`. */
export type SupabaseRow = Record<string, any>;

/** Generischer Datensatz aus einer RPC- oder Joined-Query. */
export type SupabaseRecord = Record<string, any>;

/** Profil-Row (subset, häufig genutzt in Joins). */
export interface ProfileRow extends SupabaseRow {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

/** Hilfsfunktion: castet ein unbekanntes Objekt in einen benannten Row-Typ. */
export const asRow = <T extends SupabaseRow = SupabaseRow>(value: unknown): T => value as T;
