// Edge Function: generate-preparation-suggestions
// Uses Lovable AI to generate Talking Points, Q&A, sensitive points, background facts
// for an appointment preparation based on linked partners and event context.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { chat, aiErrorResponse } from "../_shared/aiClient.ts";
import { requireAuth, unauthorizedResponse } from "../_shared/security.ts";

interface SuggestionRequest {
  visit_reason?: string;
  visit_reason_details?: string;
  appointment_title?: string;
  partners?: Array<{
    name: string;
    role?: string;
    organization?: string;
    memory_items?: Array<{ kind: string; content?: string; question?: string; answer?: string }>;
  }>;
  phase: "fakten" | "themen";
}

interface SuggestionResponse {
  facts?: Array<{ topic: string; background: string }>;
  talking_points?: Array<{ point: string; background: string }>;
  qa?: Array<{ question: string; answer: string }>;
  sensitive?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const body = (await req.json()) as SuggestionRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const partnerSummary = (body.partners ?? [])
      .map((p) => {
        const memory = (p.memory_items ?? [])
          .map((m) => {
            if (m.kind === "qa") return `  • Q: ${m.question}\n    A: ${m.answer}`;
            return `  • [${m.kind}] ${m.content ?? ""}`;
          })
          .join("\n");
        return `- ${p.name}${p.role ? `, ${p.role}` : ""}${p.organization ? ` (${p.organization})` : ""}${memory ? `\nBekannte Punkte:\n${memory}` : ""}`;
      })
      .join("\n");

    const phaseInstructions =
      body.phase === "fakten"
        ? "Erzeuge 3-5 wichtige FAKTEN/HINTERGRÜNDE die der Abgeordnete vor dem Termin kennen sollte. Außerdem 2-3 sensible Punkte, falls relevant."
        : "Erzeuge 4-6 TALKING POINTS (was der Abgeordnete sagen sollte) und 3-5 Q&A-Paare (mit Antworten auf wahrscheinliche Fragen).";

    const systemPrompt = `Du bist ein erfahrener politischer Referent in Baden-Württemberg, der einen Abgeordneten auf Termine vorbereitet. Antworte ausschließlich auf Deutsch, sachlich, kurz und konkret.`;

    const userPrompt = `Termin: ${body.appointment_title ?? "(unbenannt)"}
Anlass: ${body.visit_reason ?? "—"}${body.visit_reason_details ? `\nDetails: ${body.visit_reason_details}` : ""}

Gesprächspartner:
${partnerSummary || "(keine erfasst)"}

Aufgabe: ${phaseInstructions}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "suggest_preparation",
          description: "Strukturierte Vorbereitungs-Vorschläge",
          parameters: {
            type: "object",
            properties: {
              facts: {
                type: "array",
                items: {
                  type: "object",
                  properties: { topic: { type: "string" }, background: { type: "string" } },
                  required: ["topic", "background"],
                },
              },
              talking_points: {
                type: "array",
                items: {
                  type: "object",
                  properties: { point: { type: "string" }, background: { type: "string" } },
                  required: ["point", "background"],
                },
              },
              qa: {
                type: "array",
                items: {
                  type: "object",
                  properties: { question: { type: "string" }, answer: { type: "string" } },
                  required: ["question", "answer"],
                },
              },
              sensitive: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    ];

    try {
      const result = await chat({
        functionKey: "GENERATE_PREPARATION_SUGGESTIONS",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "suggest_preparation" } },
      });

      const parsed: SuggestionResponse = (result.toolArgs ?? {}) as SuggestionResponse;
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (aiErr) {
      return aiErrorResponse(aiErr, corsHeaders);
    }
  } catch (e) {
    console.error("generate-preparation-suggestions error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
