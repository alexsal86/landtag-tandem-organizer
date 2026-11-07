import { groupByZone, isOnResubmission, stafetteEvents, taskZone, type StafetteTask } from "@/features/tasks/stafette";
import type { TestScenario } from "../types";

const NOW = new Date(2026, 10, 7, 12);
const ME = "me";

export const taskStafetteLifecycleScenario: TestScenario = {
  id: "task-stafette-lifecycle",
  title: "Aufgaben-Stafette (Am Zug, Wiedervorlage, Freigabe)",
  description: "Spielt den Weg einer Aufgabe durch: Schritt festlegen, Wiedervorlage, Freigabe vorlegen, Rückgabe und Abschluss.",
  features: ["tasks"],
  touches: [],
  checks: ["Zonen Mein Zug / Wartet / Wiedervorlage", "Verlaufseinträge bei Übergaben und Erledigungen"],
  limitations: ["Prüft die Regeln ohne Datenbank; Speichern wird im Aufgaben-Lebenszyklus geprüft."],
  steps: [
    {
      id: "set-step", label: "Schritt mit Frist in der Zukunft → Wiedervorlage", kind: "logic",
      run: async () => {
        const t: StafetteTask = { ball_owner: "office", next_action: "Entwurf schreiben", next_action_due: "2026-11-14" };
        const ok = taskZone(t, ME, NOW) === "resubmission" && isOnResubmission(t, NOW) && taskZone(t, ME, new Date(2026, 10, 14, 9)) === "mine";
        return { ok, message: ok ? "Wiedervorlage und Rückkehr am Stichtag korrekt." : "Zone weicht ab." };
      },
    },
    {
      id: "handover", label: "Zur Freigabe vorlegen → Wartet auf andere + Verlauf", kind: "logic",
      run: async () => {
        const before: StafetteTask = { ball_owner: "office", next_action: "Entwurf schreiben" };
        const after: StafetteTask = { ball_owner: "deputy", next_action: "Freigabe prüfen" };
        const ev = stafetteEvents(before, after, { now: NOW }).map((e) => e.text);
        const ok = taskZone(after, ME, NOW) === "waiting" && ev.includes("Am Zug: Büro → Abgeordnete/r") && ev.some((t) => t.startsWith("Schritt erledigt"));
        return { ok, message: ok ? "Übergabe protokolliert." : "Übergabe fehlt im Verlauf.", details: ev };
      },
    },
    {
      id: "return", label: "Rückgabe ans Büro → wieder Mein Zug", kind: "logic",
      run: async () => {
        const back: StafetteTask = { ball_owner: "office", ball_assignee_id: ME, next_action: "Korrekturen einarbeiten" };
        const other: StafetteTask = { ball_owner: "office", ball_assignee_id: "kollegin" };
        const ok = taskZone(back, ME, NOW) === "mine" && taskZone(other, ME, NOW) === "waiting";
        return { ok, message: ok ? "Rückgabe korrekt zugeordnet." : "Rückgabe falsch zugeordnet." };
      },
    },
    {
      id: "complete", label: "Abschluss: verschwindet aus allen Zonen + Verlauf", kind: "logic",
      run: async () => {
        const done: StafetteTask = { status: "completed" };
        const g = groupByZone([done], ME, NOW);
        const ev = stafetteEvents({ status: "todo" }, done, { now: NOW }).map((e) => e.text);
        const ok = g.mine.length + g.waiting.length + g.resubmission.length === 0 && ev.includes("Aufgabe abgeschlossen");
        return { ok, message: ok ? "Abschluss korrekt." : "Abschluss weicht ab.", details: ev };
      },
    },
  ],
};
