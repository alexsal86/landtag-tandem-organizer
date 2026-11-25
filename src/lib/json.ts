import type { Json } from '@/integrations/supabase/types';

/**
 * Grenze zu jsonb-Spalten: Fachliche Payload-Typen (etwa Interfaces mit `extends`)
 * sind strukturell JSON, erfüllen TypeScripts `Json`-Union aber nicht, weil
 * Interfaces keine implizite Index-Signatur erhalten. Der Cast bleibt auf diese
 * eine Stelle begrenzt, statt an jeder Schreibstelle ein `as unknown as Json` zu setzen.
 */
export function asJson(value: unknown): Json {
  return value as Json;
}
