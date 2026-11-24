// Edge Function: propose-task-from-intake
// Turns an incoming message (email, letter, call note, OCR text, transcript)
// into a task proposal: title, next step, due date, priority, category, topic.
// The client shows the proposal for editing and creates the task itself.
import { aiErrorResponse, chat } from "../_shared/aiClient.ts";
import {
  badRequestResponse,
  corsHeaders,
  jsonResponse,
  requireAuth,
  unauthorizedResponse,
  withSafeHandler,
} from "../_shared/security.ts";

interface IntakeRequest {
  text?: string;
  channel?: string;
  today?: string;
  people?: string[];
  topics?: string[];
}

interface TaskProposal {
  title?: string;
  next_action?: string;
  due_in_days?: number | null;
  priority?: "low" | "medium" | "high";
  category?: string;
  topic?: string | null;
  suggested_owner?: string | null;
  reason?: string;
}

const MAX_TEXT = 20_000;

Deno.serve(withSafeHandler("propose-task-from-intake", async (req) => {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

  let body: IntakeRequest;
  try {
    body = (await req.json()) as IntakeRequest;
  } catch {
    return badRequestResponse("Ungültige Anfrage");
  }

  const text = (body.text ?? "").trim();
  if (text.length < 10) return badRequestResponse("Bitte mindestens 10 Zeichen Eingangstext.");
  if (text.length > MAX_TEXT) return badRequestResponse(`Der Eingangstext ist zu lang (max. ${MAX_TEXT} Zeichen).`);

  const channel = (body.channel ?? "E-Mail").trim();
  const today = (body.today ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const people = (body.people ?? []).slice(0, 50).join(", ") || "(keine hinterlegt)";
  const topics = (body.topics ?? []).slice(0, 50).join(", ") || "(keine hinterlegt)";

  const systemPrompt =
    "Du bist erfahrener Büroassistent eines Landtagsabgeordneten in Baden-Württemberg. " +
    "Du formulierst aus einem Eingang (E-Mail, Brief, Anrufnotiz, Foto- oder Sprachnotiz) genau eine " +
    "handlungsfähige Aufgabe. Antworte ausschließlich auf Deutsch, sachlich und knapp. " +
    "Erfinde keine Namen, Fristen oder Zuständigkeiten: Wenn etwas nicht im Text steht, lass das Feld leer " +
    "und setze due_in_days auf null.";

  const userPrompt = `Heutiges Datum: ${today}
Eingangskanal: ${channel}
Büromitglieder: ${people}
Themen im Büro: ${topics}

Eingang:
"""
${text}
"""

Aufgabe:
1. title: kurzer Aufgabentitel (max. 90 Zeichen), mit Absender/Gegenstand.
2. next_action: der eine nächste konkrete Schritt (max. 120 Zeichen).
3. due_in_days: Tage ab heute, nur wenn der Text eine Frist hergibt; sonst null.
4. priority: high nur bei Frist in den nächsten 3 Tagen oder ausdrücklicher Dringlichkeit, sonst medium oder low.
5. category: legislation, committee, constituency oder personal.
6. topic: nur ein Themenname aus der Liste, falls er eindeutig passt, sonst null.
7. suggested_owner: nur ein Name aus der Mitgliederliste, wenn der Text die Zuständigkeit klar macht, sonst null.
8. reason: ein Satz, warum diese Einordnung gewählt wurde.`;

  const tools = [
    {
      type: "function" as const,
      function: {
        name: "propose_task",
        description: "Vorschlag für eine Aufgabe aus einem Eingang",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            next_action: { type: "string" },
            due_in_days: { type: ["integer", "null"], minimum: 0, maximum: 365 },
            priority: { type: "string", enum: ["low", "medium", "high"] },
            category: { type: "string", enum: ["legislation", "committee", "constituency", "personal"] },
            topic: { type: ["string", "null"] },
            suggested_owner: { type: ["string", "null"] },
            reason: { type: "string" },
          },
          required: ["title", "next_action", "priority", "category"],
          additionalProperties: false,
        },
      },
    },
  ];

  try {
    const result = await chat({
      functionKey: "PROPOSE_TASK_FROM_INTAKE",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "propose_task" } },
    });

    const proposal = (result.toolArgs ?? {}) as TaskProposal;
    return jsonResponse({ proposal, provider: result.provider, model: result.model });
  } catch (aiErr) {
    return aiErrorResponse(aiErr, corsHeaders);
  }
}));
