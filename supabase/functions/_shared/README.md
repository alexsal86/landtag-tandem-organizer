# Shared AI Client

`aiClient.ts` ist ein einheitlicher Wrapper um die beiden möglichen KI-Provider:

- **Lovable AI Gateway** (`https://ai.gateway.lovable.dev`) – Default
- **OpenAI direkt** (`https://api.openai.com`) – mit eigenem `OPENAI_API_KEY`

Beide Provider sprechen das gleiche OpenAI-Chat-Completions-Schema; der Wrapper kapselt nur Auth, URL und Modell-Mapping.

## ENV-Variablen

| Name | Pflicht | Zweck |
|---|---|---|
| `LOVABLE_API_KEY` | für Lovable | wird automatisch gesetzt |
| `OPENAI_API_KEY` | für OpenAI | als Supabase Secret hinterlegen |
| `AI_PROVIDER` | optional | `lovable` (Default) oder `openai` – globaler Schalter |
| `AI_PROVIDER_<FUNCTION_KEY>` | optional | überschreibt `AI_PROVIDER` für eine bestimmte Funktion, z. B. `AI_PROVIDER_GENERATE_PREPARATION_SUGGESTIONS=openai` |

## Provider-Auswahl-Reihenfolge

1. Explizites `provider` im `chat({ provider: "openai" })`-Call
2. `AI_PROVIDER_<FUNCTION_KEY>` (Großbuchstaben, Bindestriche durch Unterstriche ersetzt)
3. `AI_PROVIDER` (global)
4. `lovable` (Fallback)

## Modell-Mapping

| Lovable | OpenAI |
|---|---|
| `google/gemini-3-flash-preview` *(Default Lovable)* | `gpt-5-mini` *(Default OpenAI)* |
| `openai/gpt-5` | `gpt-5` |
| `openai/gpt-5-mini` | `gpt-5-mini` |

Wird kein Modell übergeben, nutzt der Wrapper den Default des aktiven Providers.

## Beispiel

```ts
import { chat, aiErrorResponse, AiError } from "../_shared/aiClient.ts";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const result = await chat({
      functionKey: "MY_FUNCTION", // → AI_PROVIDER_MY_FUNCTION wird beachtet
      messages: [
        { role: "system", content: "Sei prägnant." },
        { role: "user", content: "Hallo" },
      ],
    });
    return new Response(JSON.stringify({ text: result.text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return aiErrorResponse(e, corsHeaders);
  }
});
```

## Fehler-Codes

`AiError.code` ∈ `rate_limited` | `payment_required` | `unauthorized` | `ai_error` | `config`

`aiErrorResponse(err, corsHeaders)` formt sie in eine konsistente JSON-Antwort um.
