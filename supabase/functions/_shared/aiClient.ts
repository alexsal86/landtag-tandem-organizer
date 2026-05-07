// Shared AI Client for Supabase Edge Functions
// Switches between Lovable AI Gateway and OpenAI directly via ENV.
//
// Provider resolution order:
//   1. explicit `provider` argument
//   2. AI_PROVIDER_<FUNCTION_KEY>  (e.g. AI_PROVIDER_GENERATE_PREPARATION_SUGGESTIONS=openai)
//   3. AI_PROVIDER (global)
//   4. "lovable" (default)

export type AiProvider = "lovable" | "openai";

export interface AiTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  // OpenAI-style optional fields tolerated by both providers
  name?: string;
  tool_call_id?: string;
}

export interface AiChatOptions {
  messages: AiMessage[];
  tools?: AiTool[];
  tool_choice?: { type: "function"; function: { name: string } } | "auto" | "none";
  model?: string;
  /** Optional override; otherwise resolved from ENV. */
  provider?: AiProvider;
  /** Used to look up AI_PROVIDER_<FUNCTION_KEY> override. */
  functionKey?: string;
  /** Extra fields passed through to the provider unchanged. */
  extra?: Record<string, unknown>;
}

export interface AiChatResult {
  /** OpenAI-shaped raw response (both providers return this shape). */
  raw: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Convenience: first choice's text content (may be empty when tool calls were used). */
  text: string;
  /** Convenience: first tool call's parsed JSON arguments, if any. */
  toolArgs: Record<string, unknown> | null;
  /** Provider that was actually used. */
  provider: AiProvider;
  /** Model that was actually sent. */
  model: string;
}

export class AiError extends Error {
  status: number;
  code: "rate_limited" | "payment_required" | "unauthorized" | "ai_error" | "config";
  constructor(
    code: AiError["code"],
    message: string,
    status: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_LOVABLE_MODEL = "google/gemini-3-flash-preview";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

/** Map a model name from one provider's namespace to the other when no explicit model is given for the chosen provider. */
function mapModel(model: string | undefined, provider: AiProvider): string {
  if (model && model.length > 0) {
    if (provider === "openai") {
      // Strip the "openai/" prefix when the caller passed a Lovable-namespaced OpenAI model.
      if (model.startsWith("openai/")) return model.slice("openai/".length);
      // If the caller asked for a Gemini model but we're on OpenAI, fall back to default.
      if (model.startsWith("google/")) return DEFAULT_OPENAI_MODEL;
      return model;
    }
    // provider === "lovable"
    // If caller passed a bare OpenAI name, namespace it for the gateway.
    if (/^gpt-/.test(model)) return `openai/${model}`;
    return model;
  }
  return provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_LOVABLE_MODEL;
}

export function resolveProvider(opts: { provider?: AiProvider; functionKey?: string }): AiProvider {
  if (opts.provider) return opts.provider;
  if (opts.functionKey) {
    const fnEnv = Deno.env.get(`AI_PROVIDER_${opts.functionKey.toUpperCase()}`);
    if (fnEnv === "openai" || fnEnv === "lovable") return fnEnv;
  }
  const global = Deno.env.get("AI_PROVIDER");
  if (global === "openai" || global === "lovable") return global;
  return "lovable";
}

export async function chat(options: AiChatOptions): Promise<AiChatResult> {
  const provider = resolveProvider({ provider: options.provider, functionKey: options.functionKey });
  const model = mapModel(options.model, provider);

  const apiKey = provider === "openai"
    ? Deno.env.get("OPENAI_API_KEY")
    : Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    throw new AiError(
      "config",
      provider === "openai"
        ? "OPENAI_API_KEY missing — add it as a Supabase secret."
        : "LOVABLE_API_KEY missing.",
      500,
    );
  }

  const url = provider === "openai"
    ? "https://api.openai.com/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";

  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    ...(options.tools ? { tools: options.tools } : {}),
    ...(options.tool_choice ? { tool_choice: options.tool_choice } : {}),
    ...(options.extra ?? {}),
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    if (resp.status === 429) throw new AiError("rate_limited", "Rate-Limit erreicht. Bitte später erneut versuchen.", 429);
    if (resp.status === 402) {
      throw new AiError(
        "payment_required",
        provider === "openai"
          ? "OpenAI-Guthaben aufgebraucht. Bitte Billing prüfen."
          : "Lovable AI Guthaben aufgebraucht. Bitte aufladen.",
        402,
      );
    }
    if (resp.status === 401) throw new AiError("unauthorized", "Ungültiger AI-API-Key.", 401);
    console.error(`AI ${provider} error`, resp.status, errText);
    throw new AiError("ai_error", `AI provider error (${resp.status})`, 500);
  }

  const raw = await resp.json();
  const message = raw?.choices?.[0]?.message;
  const text: string = typeof message?.content === "string" ? message.content : "";
  let toolArgs: Record<string, unknown> | null = null;
  const toolCall = message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      toolArgs = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args", e);
    }
  }

  return { raw, text, toolArgs, provider, model };
}

/** Helper to convert AiError into a CORS-aware HTTP Response. */
export function aiErrorResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  if (err instanceof AiError) {
    return new Response(
      JSON.stringify({ error: err.code, message: err.message }),
      { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  console.error("Unexpected AI error", err);
  return new Response(
    JSON.stringify({ error: "ai_error", message: err instanceof Error ? err.message : "Unknown" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
