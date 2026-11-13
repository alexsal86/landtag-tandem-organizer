import { canConfirmGdpr, hasReadToEnd, isValidDeclaration, DEFAULT_GDPR_DECLARATION } from "@/features/onboarding-hr/gdpr";
import {
  hrDueDay,
  hrProgress,
  overdueMandatory,
  canViewHr,
  upcomingDeparture,
} from "@/features/onboarding-hr/progress";
import {
  HR_DEFAULT_TEMPLATES,
  hrEditorFields,
  hrStepsFromEditor,
} from "@/features/onboarding-hr/templates";
import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
export const onboardingHrScenario: TestScenario = {
  id: "onboarding-hr",
  title: "HR-Onboarding und Offboarding",
  description:
    "Kalendertage, Pflichtfortschritt, Rollensichtbarkeit und echter Paketstart mit zurückgerollten Testdaten.",
  touches: [
    "employee_lifecycle",
    "employee_hr_templates",
    "routine_package_runs",
    "routine_package_steps",
    "employee_hr_evidence",
    "employee_hr_gdpr_declarations",
    "employee_hr_reminder_log",
    "notification_types",
    "notifications",
    "tasks",
    "subtasks",
  ],
  features: ["employees", "automation", "permissions"],
  requiredRoles: ["abgeordneter", "bueroleitung"],
  limitations: [
    "Der Servertest rollt seine vollständigen Fixtures zurück. Echte Zustellung und der 15-Minuten-Job benötigen eine bereitgestellte Datenbank.",
  ],
  steps: [
    {
      id: "gdpr-edit-validation",
      label: "Datenschutztext: vollständige Vorlage und Eingabegrenzen prüfen",
      kind: "logic",
      run: async () => ({
        ok: isValidDeclaration(DEFAULT_GDPR_DECLARATION.text) && !isValidDeclaration(" ".repeat(100)) && !isValidDeclaration("a".repeat(50001)),
        message: "Nur vollständige Texte innerhalb der zulässigen Länge können gespeichert werden.",
      }),
    },
    {
      id: "gdpr-personal-confirmation",
      label: "DSGVO: nur persönlich und erst nach dem Textende bestätigen",
      kind: "logic",
      run: async () => ({
        ok: !hasReadToEnd(0, 300, 1200) && hasReadToEnd(900, 300, 1200)
          && !canConfirmGdpr("leitung", "person", true)
          && !canConfirmGdpr("person", "person", false)
          && canConfirmGdpr("person", "person", true),
        message: "Scrollfreigabe und persönliche Bestätigung geprüft.",
      }),
    },
    {
      id: "deadlines",
      label: "Eintrittsfristen, Überfälligkeit und anstehende Austritte",
      kind: "logic",
      run: async () => ({
        ok:
          hrDueDay("2026-12-20", 14) === "2027-01-03" &&
          overdueMandatory(
            [{ id: "a", is_mandatory: true, due_day: "2026-11-12" }],
            "2026-11-01",
            "2026-11-13",
          ).length === 1 &&
          upcomingDeparture("2026-12-01", "2026-11-13"),
        message:
          "Kalendertage und ausschließlich überfällige Pflichtpunkte erkannt.",
      }),
    },
    {
      id: "progress",
      label: "Pflicht und optionale Punkte getrennt zählen",
      kind: "logic",
      run: async () => ({
        ok:
          hrProgress([
            { id: "a", is_mandatory: true, status: "completed" },
            { id: "b", is_mandatory: false, status: "active" },
          ]).mandatory.percent === 100,
        message: "Pflichtfortschritt bleibt unabhängig von optionalen Punkten.",
      }),
    },
    {
      id: "roles",
      label: "Betroffene sehen nur eigene HR-Punkte; Leitung sieht das Team",
      kind: "logic",
      run: async () => ({
        ok:
          canViewHr("mitarbeiter", "a", "a") &&
          !canViewHr("mitarbeiter", "a", "b") &&
          canViewHr("bueroleitung", "a", "b"),
        message: "Gemeinsame Sichtbarkeitsregel geprüft.",
      }),
    },
    {
      id: "templates",
      label:
        "Drei Rollenvorlagen und Offboarding behalten Phasen und Nachweise",
      kind: "logic",
      run: async () => ({
        ok:
          HR_DEFAULT_TEMPLATES.length === 4 &&
          HR_DEFAULT_TEMPLATES.every((t) => {
            const e = hrEditorFields(t.steps);
            const converted = hrStepsFromEditor(
              e.value,
              e.kinds,
              e.settings,
              e.metadata,
            );
            return t.steps.every((step, i) =>
              Object.entries(step).every(
                ([key, value]) =>
                  converted[i][key as keyof typeof step] === value,
              ),
            );
          }),
        message: "Bestehender Schritte-Editor erhält die HR-Metadaten.",
      }),
    },
    {
      id: "start-once",
      label:
        "Vorlage starten, wiederholen und Nachweissperre prüfen (vollständig zurückgerollt)",
      kind: "workflow",
      run: async (ctx) => {
        const result = await supabase.rpc("selftest_employee_hr", {
          p_tenant: ctx.tenantId,
        });
        const value = result.data as Record<string, unknown> | null;
        return {
          ok:
            !result.error &&
            !!value &&
            [
              "idempotent",
              "single_step",
              "evidence_guard",
              "single_daily_reminder",
              "proof_saved",
              "completed",
            ].every((key) => value[key] === true),
          message:
            result.error?.message ??
            "Paketstart und Wiederholung erzeugen genau einen Schritt; DSGVO-Abschluss verlangt den bestätigten Nachweis.",
          details: result.error ?? value,
        };
      },
    },
    {
      id: "foreign-tenant",
      label: "Fremdtenant darf weder Beschäftigung noch Erinnerung schreiben",
      kind: "workflow",
      run: async (ctx) => {
        const result = await supabase.rpc("save_employee_lifecycle", {
          p_tenant: crypto.randomUUID(),
          p_user: ctx.userId,
          p_type: "praktikum",
          p_start: "2099-01-01",
        });
        const reminder = await supabase.rpc("remind_employee_hr", {
          p_lifecycle: crypto.randomUUID(),
        });
        return {
          ok:
            result.error?.code === "42501" && reminder.error?.code === "42501",
          message: "Tenant- und Rollenprüfungen werden serverseitig erzwungen.",
        };
      },
    },
  ],
};
