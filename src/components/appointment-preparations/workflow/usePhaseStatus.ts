import { normalizeBriefingData } from "@/hooks/useAppointmentPreparation";
import { useMemo } from "react";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";

export type PhaseId =
  | "anlass"
  | "team"
  | "fakten"
  | "themen"
  | "qa-run"
  | "freigabe"
  | "nachbereitung";

export type PhaseStatus = "done" | "active" | "todo";

export interface PhaseDescriptor {
  id: PhaseId;
  label: string;
  hint: string;
  status: PhaseStatus;
  countLabel?: string;
}

export interface UsePhaseStatusResult {
  phases: PhaseDescriptor[];
  activePhase: PhaseId;
  blockers: string[];
}

export function usePhaseStatus(
  preparation: AppointmentPreparation | null,
  selected: PhaseId | null,
  briefingStatus?: string,
): UsePhaseStatusResult {
  return useMemo(() => {
    const data = normalizeBriefingData(preparation?.preparation_data ?? {}) as Record<string, unknown>;
    const checklist = preparation?.checklist_items ?? [];

    const visitReason = (data.visit_reason as string) ?? "";
    const visitReasonDetails = (data.visit_reason_details as string) ?? "";
    const partners = (data.conversation_partners as Array<{ name?: string }>) ?? [];
    const companions = (data.companions as unknown[]) ?? [];
    const program = (data.program as unknown[]) ?? [];
    const keyTopics = (data.key_topic_items as Array<{ topic?: string }>) ?? [];
    const talkingPoints = (data.talking_point_items as Array<{ point?: string }>) ?? [];
    const qaPairs = (data.qa_pairs as Array<{ question?: string; answer?: string }>) ?? [];

    const checklistDone = checklist.every((i) => i.completed);
    const checklistTotal = checklist.length;
    const checklistChecked = checklist.filter((i) => i.completed).length;

    const anlassDone = Boolean(visitReason || visitReasonDetails.trim());
    const teamDone = partners.some(p => Boolean(p.name?.trim()));
    const faktenDone = Boolean((data.structured_facts as Array<{text?: string; fact_id?: string}> | undefined)?.some(f => f.text?.trim() || f.fact_id) || String(data.facts_figures ?? "").trim() || String(data.position_statements ?? "").trim()) || keyTopics.some((t) => (t.topic ?? "").trim().length > 0);
    const themenDone =
      talkingPoints.some((t) => (t.point ?? "").trim().length > 0) ||
      qaPairs.some((q) => Boolean(q.question?.trim() && q.answer?.trim())) || Boolean(String(data.talking_points ?? "").trim() || String(data.position_statements ?? "").trim() || (qaPairs.length === 0 && String(data.questions_answers ?? "").trim()));
    const qaRunDone = checklistDone;
    const freigabeDone = briefingStatus === "approved" || briefingStatus === "none";
    const nachDone = Boolean(String(data.debrief_summary ?? "").trim() && String(data.debrief_outcomes ?? "").trim());

    const phaseSpecs: Array<{
      id: PhaseId;
      label: string;
      hint: string;
      done: boolean;
      countLabel?: string;
    }> = [
      { id: "anlass", label: "Anlass & Annahme", hint: "Worum geht es", done: anlassDone, countLabel: visitReason ? visitReason : undefined },
      { id: "team", label: "Team & Logistik", hint: "Wer ist dabei", done: teamDone, countLabel: `${partners.length}P · ${companions.length}B` },
      { id: "fakten", label: "Fakten & Positionen", hint: "Was wir wissen", done: faktenDone, countLabel: `${keyTopics.length} Fakten` },
      { id: "themen", label: "Themen, TP & Q&A", hint: "Was wir sagen", done: themenDone, countLabel: `${keyTopics.length}T · ${talkingPoints.length}TP · ${qaPairs.length}Q` },
      { id: "qa-run", label: "Q&A-Durchgang", hint: "Checkliste", done: qaRunDone, countLabel: checklistTotal ? `${checklistChecked}/${checklistTotal}` : undefined },
      { id: "freigabe", label: "Briefing-Freigabe", hint: "Status setzen", done: freigabeDone },
      { id: "nachbereitung", label: "Nachbereitung", hint: "Nach dem Termin", done: nachDone, countLabel: program.length ? `${program.length} Programm` : undefined },
    ];

    // Determine active phase: explicit selection wins, else first not-done.
    const firstOpenIdx = phaseSpecs.findIndex((p) => !p.done);
    const fallbackActive = (firstOpenIdx >= 0 ? phaseSpecs[firstOpenIdx].id : phaseSpecs[phaseSpecs.length - 1].id);
    const activePhase: PhaseId = selected ?? fallbackActive;

    const phases: PhaseDescriptor[] = phaseSpecs.map((p) => ({
      id: p.id,
      label: p.label,
      hint: p.hint,
      status: p.id === activePhase ? "active" : p.done ? "done" : "todo",
      countLabel: p.countLabel,
    }));

    const blockers: string[] = [];
    if (!anlassDone) blockers.push("Anlass nicht festgelegt");
    if (!teamDone) blockers.push("Keine Gesprächspartner erfasst");
    if (!faktenDone) blockers.push("Fakten & Positionen leer");
    if (!themenDone) blockers.push("Talking Points / Q&A fehlen");
    if (checklistTotal > 0 && !qaRunDone) blockers.push(`Checkliste offen (${checklistChecked}/${checklistTotal})`);

    return { phases, activePhase, blockers };
  }, [preparation, selected, briefingStatus]);
}
