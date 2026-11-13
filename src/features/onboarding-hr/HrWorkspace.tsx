import { GdprDeclarationEditor } from "./GdprDeclarationEditor";
import { GdprDeclarationDialog } from "./GdprDeclarationDialog";
import { canConfirmGdpr, type GdprDeclaration } from "./gdpr";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DeputySelect } from "@/components/timetracking/DeputySelect";
import { useHrData, type HrStep } from "./useHrData";
import {
  HR_PHASES,
  hrProgress,
  overdueMandatory,
  upcomingDeparture,
  canViewHr,
} from "./progress";

const hrToday = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
    new Date(),
  );
type DisplayStep = Pick<
  HrStep,
  | "id"
  | "title"
  | "status"
  | "entity_id"
  | "due_day"
  | "hr_evidence_kind"
  | "is_mandatory"
  | "error_message"
  | "kind"
>;
function HrStepAction({
  step,
  admin,
  evidence,
  onComplete,
  busy,
  isEmployee,
  onConfirmGdpr,
  declaration,
  onRetry,
}: {
  step: DisplayStep;
  admin: boolean;
  evidence?: {
    declaration_text: string | null;
    declaration_version: string | null;
    created_at: string;
    confirmed_on: string;
    confirmed_by: string;
    document_id: string | null;
  };
  onComplete: (
    date: string | null,
    document: string | null,
    deputy: string | null,
  ) => Promise<void>;
  busy: boolean;
  isEmployee: boolean;
  declaration: GdprDeclaration;
  onConfirmGdpr: (version: string) => Promise<boolean>;
  onRetry: () => Promise<void>;
}) {
  const [deputy, setDeputy] = useState("");
  const canConfirm = step.hr_evidence_kind === "none" || (step.hr_evidence_kind === "handover" && admin);
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap justify-between gap-2">
        <strong>{step.title}</strong>
        <span>
          {step.is_mandatory ? "Pflicht" : "Optional"} ·{" "}
          {step.status === "completed"
            ? "Erledigt"
            : step.status === "waiting"
              ? "Geplant"
              : step.status === "failed"
                ? "Fehlgeschlagen"
                : "Offen"}{" "}
          · {step.due_day ?? "Termin offen"}
        </span>
      </div>
      {step.error_message && (
        <p role="alert" className="text-destructive">
          {step.error_message}
        </p>
      )}
      {admin && step.status === "failed" && !step.entity_id && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void onRetry()}
        >
          Fehlgeschlagenen Schritt erneut versuchen
        </Button>
      )}
      {evidence && (
        <p className="text-sm">
          Nachweis vom {evidence.confirmed_on} · bestätigt von{" "}
          {evidence.confirmed_by}
          {evidence.declaration_version && <> · Textversion {evidence.declaration_version} · {new Date(evidence.created_at).toLocaleString("de-DE")}</>}
          {evidence.document_id && (
            <>
              {" "}
              ·{" "}
              <a
                className="underline"
                href={`/documents?highlight=${encodeURIComponent(evidence.document_id)}`}
              >
                Dokument öffnen
              </a>
            </>
          )}
        </p>
      )}
      {step.status !== "completed" && canConfirm && (
        <>
          {step.hr_evidence_kind === "handover" && (
            <DeputySelect
              value={deputy}
              onChange={setDeputy}
              label="Offene Aufgaben übergeben an"
            />
          )}
          <Button
            disabled={
              busy ||
              !step.entity_id ||
              (step.hr_evidence_kind === "handover" && !deputy)
            }
            onClick={() =>
              void onComplete(
                null,
                null,
                deputy || null,
              )
            }
          >
            {step.hr_evidence_kind === "handover"
                ? "Aufgaben übergeben und erledigen"
                : "Erledigen"}
          </Button>
        </>
      )}
      {step.hr_evidence_kind === "gdpr" && <GdprDeclarationDialog
        currentDeclaration={declaration}
        declarationText={evidence?.declaration_text} declarationVersion={evidence?.declaration_version}
        busy={busy} completed={step.status === "completed"}
        canConfirm={isEmployee && !!step.entity_id && ["active", "blocked"].includes(step.status)} onConfirm={onConfirmGdpr} />}
      {step.status !== "completed" && !canConfirm && step.hr_evidence_kind !== "gdpr" && (
        <p className="text-sm text-muted-foreground">
          Diesen Nachweis bzw. die Übergabe bestätigt die Büroleitung.
        </p>
      )}
    </div>
  );
}
export function HrWorkspace() {
  const model = useHrData();
  const { users } = useTenantUsers();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const nameOf = (id: string) =>
    users.find((u) => u.id === id)?.display_name ?? "Unbekannt";
  const execute = async (
    input: Parameters<typeof model.mutation.mutateAsync>[0],
  ) => {
    setError("");
    setNotice("");
    try {
      await model.mutation.mutateAsync(input);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
      return false;
    }
  };
  if (model.isLoading) return <p>HR-Abläufe werden geladen …</p>;
  if (model.error || !model.data)
    return (
      <p role="alert">
        HR-Abläufe konnten nicht geladen werden. {model.error?.message}
      </p>
    );
  const data = model.data;
  const today = hrToday();
  const visible = data.employment.filter(
    (e) =>
      canViewHr(model.role, model.userId ?? "", e.user_id) &&
      (!params.get("employee") || e.user_id === params.get("employee")),
  );
  return (
    <section className="space-y-5 p-4">
      <h2 className="text-xl font-semibold">HR-Onboarding & Offboarding</h2>
      <p className="text-sm text-muted-foreground">
        Automatisch zugeordnete HR-Abläufe, Pflichtnachweise und Übergaben. Keine Ausweis- oder
        Schlüsselnummern eintragen. Laufende Pakete behalten ihre beim Start
        gespeicherten Termine und Vorlagen.
      </p>
      {model.isAdmin && model.tenantId && <GdprDeclarationEditor
        declaration={data.declaration} busy={model.mutation.isPending}
        onSave={(text, version) => execute({ name: "save_employee_hr_gdpr_declaration", args: { p_tenant: model.tenantId!, p_text: text, p_expected_version: version } })}
      />}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {model.isAdmin && <p className="text-sm"><a className="underline" href="/employee?tab=overview">Mitarbeitende und Beschäftigungsdaten in der Übersicht verwalten</a></p>}
      {!visible.length && (
        <p>Noch keine Beschäftigung mit HR-Ablauf vorhanden.</p>
      )}
      {visible.map((employment) => {
        const runs = data.runs.filter(
          (r) => r.employee_lifecycle_id === employment.id,
        );
        const steps = data.steps.filter((s) =>
          runs.some((r) => r.id === s.run_id),
        );
        const progress = hrProgress(steps);
        const overdue = overdueMandatory(steps, employment.start_date, today);
        return (
          <article
            className="rounded-lg border p-4 space-y-4"
            key={employment.id}
          >
            <header>
              <h3 className="text-lg font-semibold">
                {nameOf(employment.user_id)} · {employment.employment_type}
              </h3>
              <p className="text-sm text-muted-foreground">
                Eintritt: {employment.start_date} · Austritt:{" "}
                {employment.end_date ?? "unbefristet"} · Mentor:in:{" "}
                {employment.mentor_user_id
                  ? nameOf(employment.mentor_user_id)
                  : "offen"}
              </p>
            </header>
            <div>
              <Label>
                Pflicht: {progress.mandatory.done}/{progress.mandatory.total}
              </Label>
              <Progress
                value={progress.mandatory.percent}
                aria-label="Pflichtfortschritt"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Optional: {progress.optional.done}/{progress.optional.total}
              <Progress
                value={progress.optional.percent}
                className="h-1"
                aria-label="Optionaler Fortschritt"
              />
            </div>
            {!!overdue.length && (
              <p className="text-destructive">
                {overdue.length} Pflichtpunkte überfällig.
              </p>
            )}
            {upcomingDeparture(employment.end_date, today) && (
              <p className="font-medium">
                Austritt in den nächsten 30 Tagen – Übergabe und Zugänge prüfen.
              </p>
            )}
            {model.isAdmin && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  disabled={model.mutation.isPending}
                  onClick={() => {
                    void execute({
                      name: "remind_employee_hr",
                      args: { p_lifecycle: employment.id },
                    }).then((ok) => {
                      if (ok)
                        setNotice(
                          "Erinnerung geprüft: überfällige Pflichtpunkte und anstehende Austritte werden höchstens einmal täglich gemeldet.",
                        );
                    });
                  }}
                >
                  Pflichterinnerung senden
                </Button>
              </div>
            )}
            {model.isAdmin && !data.templates.length && (
              <p>
                <a
                  className="underline"
                  href="/administration?adminSection=automation&adminSubSection=hr"
                >
                  HR-Vorlagen in der Administration bereitstellen
                </a>
              </p>
            )}
            {runs.map((run) => (
              <section key={run.id} className="space-y-3">
                <h4 className="font-semibold">
                  {run.hr_direction === "onboarding"
                    ? "Onboarding"
                    : "Offboarding"}{" "}
                  · Vorlagenstand {run.hr_template_revision}
                </h4>
                {Object.entries(HR_PHASES).map(([phase, label]) => {
                  const points = steps.filter(
                    (s) => s.run_id === run.id && s.hr_phase === phase,
                  );
                  return points.length ? (
                    <div className="space-y-2" key={phase}>
                      <h5 className="text-sm font-semibold">{label}</h5>
                      {points.map((step) => {
                        const evidence = data.evidence.find(
                          (e) => e.step_id === step.id,
                        );
                        return (
                          <HrStepAction
                            key={step.id}
                            isEmployee={canConfirmGdpr(model.userId, employment.user_id, true)}
                            declaration={data.declaration}
                            onConfirmGdpr={async (version) => {
                              return execute({ name: "confirm_employee_hr_gdpr", args: { p_step: step.id, p_version: version } });
                            }}
                            step={step}
                            admin={model.isAdmin}
                            busy={model.mutation.isPending}
                            evidence={
                              evidence
                                ? {
                                    ...evidence,
                                    confirmed_by: nameOf(evidence.confirmed_by),
                                  }
                                : undefined
                            }
                            onRetry={async () => {
                              await execute({
                                name: "refresh_routine_package",
                                args: {
                                  _run_id: run.id,
                                  _retry_step_id: step.id,
                                },
                              });
                            }}
                            onComplete={async (date, document, deputy) => {
                              await execute({
                                name: "complete_employee_hr_step",
                                args: {
                                  p_step: step.id,
                                  p_confirmed_on: date ?? undefined,
                                  p_document: document ?? undefined,
                                  p_deputy: deputy ?? undefined,
                                },
                              });
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : null;
                })}
                {model.isAdmin && (
                  <Button
                    variant="outline"
                    disabled={model.mutation.isPending}
                    onClick={() =>
                      void execute({
                        name: "refresh_routine_package",
                        args: { _run_id: run.id },
                      })
                    }
                  >
                    Status prüfen und Ablauf fortsetzen
                  </Button>
                )}
              </section>
            ))}
          </article>
        );
      })}
    </section>
  );
}

export function HrReminderPanel() {
  const model = useHrData();
  const { users } = useTenantUsers();
  if (!model.isAdmin || !model.data) return null;
  const data = model.data;
  const today = hrToday();
  const reminders = data.employment
    .map((e) => {
      const runIds = data.runs
        .filter((r) => r.employee_lifecycle_id === e.id)
        .map((r) => r.id);
      return {
        employee: e,
        overdue: overdueMandatory(
          data.steps.filter((s) => runIds.includes(s.run_id)),
          e.start_date,
          today,
        ),
        departure: upcomingDeparture(e.end_date, today),
      };
    })
    .filter((r) => r.overdue.length || r.departure);
  return (
    <section className="rounded-lg border bg-card p-4 space-y-2">
      <h3 className="font-semibold">HR-Pflichtpunkte & Austritte</h3>
      {!reminders.length ? (
        <p className="text-sm text-muted-foreground">
          Keine überfälligen Pflichtpunkte oder Austritte in den nächsten 30
          Tagen.
        </p>
      ) : (
        reminders.map((r) => (
          <a
            className="block rounded border p-2 text-sm hover:bg-muted"
            key={r.employee.id}
            href={`/employee?tab=hr&employee=${encodeURIComponent(r.employee.user_id)}`}
          >
            {users.find((u) => u.id === r.employee.user_id)?.display_name ??
              "Mitarbeiter:in"}{" "}
            · {r.overdue.length} Pflichtpunkte überfällig
            {r.departure ? ` · Austritt ${r.employee.end_date}` : ""}
          </a>
        ))
      )}
    </section>
  );
}
export default HrWorkspace;
