import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Proceeding } from "./documents";

export const pageSize = 20;

type PageArgs = Database["public"]["Functions"]["parlis_page"]["Args"];

type ProceedingsPage = {
  rows: Proceeding[];
  count: number | null;
  total: number | null;
  groups: [string, number][];
};

type ProceedingsOptions = { kinds: string[]; parties: string[]; topics: string[] };

export async function loadPage(args: PageArgs, signal: AbortSignal) {
  const { data, error } = await supabase.rpc("parlis_page", args).abortSignal(signal);
  if (error) throw error;
  return data as unknown as ProceedingsPage;
}

export async function loadOptions(period: number, signal: AbortSignal) {
  const { data, error } = await supabase.rpc("parlis_page", { period, options_only: true }).abortSignal(signal);
  if (error) throw error;
  return data as unknown as ProceedingsOptions;
}
