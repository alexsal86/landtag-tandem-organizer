// Foto-OCR Edge Function – Visitenkarten / Briefe
// Nimmt ein Base64-Bild entgegen, extrahiert strukturierte Daten via Gemini Vision
// und gibt sie als JSON (contact | letter) zurück. Das Anlegen in der DB übernimmt der Client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { chat, aiErrorResponse } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Mode = "contact" | "letter" | "auto";

interface Body {
  imageBase64: string;
  mimeType?: string;
  mode?: Mode;
}

const MAX_BYTES = 15 * 1024 * 1024; // ~15 MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const approxBytes = Math.floor((body.imageBase64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return new Response(
        JSON.stringify({ error: "image too large", maxBytes: MAX_BYTES }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mime = body.mimeType ?? "image/jpeg";
    const mode: Mode = body.mode ?? "auto";
    const dataUrl = `data:${mime};base64,${body.imageBase64}`;

    const systemPrompt =
      "Du bist ein OCR-Assistent für ein Abgeordnetenbüro. Analysiere das Bild " +
      "(Visitenkarte oder Brief) und extrahiere strukturierte Daten in deutscher Sprache. " +
      "Wenn ein Feld unklar ist, lasse es leer. Gib niemals erfundene Werte zurück.";

    const result = await chat({
      functionKey: "EXTRACT_PHOTO_DATA",
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          // OpenAI-kompatibel: content kann auch Array sein – wir behalten String + image über extra
          content:
            mode === "letter"
              ? "Extrahiere die Briefdaten."
              : mode === "contact"
              ? "Extrahiere die Kontaktdaten von der Visitenkarte."
              : "Erkenne automatisch, ob es sich um eine Visitenkarte oder einen Brief handelt, und extrahiere die passenden Daten.",
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_photo_data",
            description: "Strukturierte Extraktion aus Foto",
            parameters: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["contact", "letter", "unknown"] },
                contact: {
                  type: "object",
                  properties: {
                    salutation: { type: "string" },
                    first_name: { type: "string" },
                    last_name: { type: "string" },
                    organization: { type: "string" },
                    role: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    mobile: { type: "string" },
                    website: { type: "string" },
                    street: { type: "string" },
                    postal_code: { type: "string" },
                    city: { type: "string" },
                    notes: { type: "string" },
                  },
                },
                letter: {
                  type: "object",
                  properties: {
                    sender_name: { type: "string" },
                    sender_address: { type: "string" },
                    recipient_name: { type: "string" },
                    recipient_address: { type: "string" },
                    subject: { type: "string" },
                    date: { type: "string", description: "ISO Datum, falls erkennbar" },
                    body_excerpt: { type: "string", description: "Kurzer Auszug" },
                    full_text: { type: "string" },
                  },
                },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["kind"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_photo_data" } },
      extra: {
        // Vision-Anhang als zweite User-Message via "extra.messages_append"-Konvention nicht unterstützt –
        // stattdessen ergänzen wir das Bild direkt über das OpenAI-kompatible Format:
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  mode === "letter"
                    ? "Extrahiere die Briefdaten."
                    : mode === "contact"
                    ? "Extrahiere die Kontaktdaten von der Visitenkarte."
                    : "Erkenne automatisch, ob es sich um eine Visitenkarte oder einen Brief handelt, und extrahiere die passenden Daten.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        data: result.toolArgs ?? {},
        provider: result.provider,
        model: result.model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return aiErrorResponse(e, corsHeaders);
  }
});
