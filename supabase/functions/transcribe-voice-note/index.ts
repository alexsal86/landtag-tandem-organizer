// Transcribe a voice note (m4a/wav/mp3) using OpenAI Whisper.
// Body: { audioBase64: string, mimeType?: string, language?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";
import { getCorsHeaders } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: cErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "config", message: "OPENAI_API_KEY missing" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as
      | { audioBase64?: string; mimeType?: string; language?: string }
      | null;
    if (!body?.audioBase64 || typeof body.audioBase64 !== "string") {
      return new Response(JSON.stringify({ error: "bad_request", message: "audioBase64 required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (body.audioBase64.length > 35_000_000) {
      return new Response(JSON.stringify({ error: "bad_request", message: "audio too large" }), {
        status: 413,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const mimeType = body.mimeType ?? "audio/m4a";
    const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "m4a";
    const bytes = Uint8Array.from(atob(body.audioBase64), (c) => c.charCodeAt(0));

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimeType }), `voice.${ext}`);
    form.append("model", "whisper-1");
    form.append("language", body.language ?? "de");
    form.append("response_format", "json");

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("Whisper error", resp.status, errText);
      return new Response(JSON.stringify({ error: "ai_error", status: resp.status }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json() as { text?: string };

    return new Response(JSON.stringify({ text: data.text ?? "" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("transcribe-voice-note error", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
