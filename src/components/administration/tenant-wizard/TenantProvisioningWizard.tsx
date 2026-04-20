import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, ChevronRight, ChevronLeft, Loader2, Copy, Check, Sparkles } from "lucide-react";

const BUNDESLAENDER = [
  "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
  "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
  "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
  "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
];

export interface SeedReport {
  app_settings: number;
  case_file_types: number;
  notification_types: number;
  letter_occasions: number;
  meeting_templates: number;
  planning_templates: number;
  letter_templates?: number;
  sender_information?: number;
  appointment_preparation_templates?: number;
  event_email_templates?: number;
  news_email_templates?: number;
  vacation_checklist_templates?: number;
  errors: string[];
}

const REPORT_LABELS: Record<string, string> = {
  app_settings: "App-Einstellungen",
  case_file_types: "Vorgangs-Kategorien",
  notification_types: "Notification-Typen",
  letter_occasions: "Brief-Anlässe",
  meeting_templates: "Meeting-Vorlagen",
  planning_templates: "Planungs-Vorlagen",
  letter_templates: "Brief-Vorlagen",
  sender_information: "Absender",
  appointment_preparation_templates: "Termin-Vorbereitungen",
  event_email_templates: "Event-Mail-Vorlagen",
  news_email_templates: "News-Mail-Vorlagen",
  vacation_checklist_templates: "Urlaubs-Checklisten",
};

export function SeedReportView({ report }: { report: SeedReport }): React.JSX.Element {
  const entries = Object.entries(report).filter(
    ([k, v]) => k !== "errors" && typeof v === "number" && v > 0,
  ) as Array<[string, number]>;
  return (
    <div className="space-y-2 text-sm">
      <div className="font-medium">Angelegte Datensätze:</div>
      {entries.length === 0 ? (
        <div className="text-muted-foreground">Keine neuen Datensätze (alle bereits vorhanden).</div>
      ) : (
        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
          {entries.map(([k, v]) => (
            <li key={k}>
              <span className="text-foreground font-medium">{v}×</span> {REPORT_LABELS[k] ?? k}
            </li>
          ))}
        </ul>
      )}
      {report.errors?.length > 0 && (
        <div className="mt-2">
          <div className="text-amber-600 dark:text-amber-400 text-xs font-medium">Hinweise:</div>
          <ul className="text-xs text-muted-foreground list-disc list-inside">
            {report.errors.slice(0, 5).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface TenantOption {
  id: string;
  name: string;
  is_template?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateTenants: TenantOption[];
  onCreated: () => void;
}

type SeedMode = "standard" | "clone" | "empty";

interface ProvisionResult {
  tenantId: string;
  tenantName: string;
  report: SeedReport;
  adminPassword?: string;
  adminEmail?: string;
}

export function TenantProvisioningWizard({ open, onOpenChange, templateTenants, onCreated }: Props): React.JSX.Element {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [passwordCopied, setPasswordCopied] = useState<boolean>(false);

  // Step 1
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [constituency, setConstituency] = useState<string>("");
  const [constituencyNumber, setConstituencyNumber] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [stateValue, setStateValue] = useState<string>("");
  const [party, setParty] = useState<string>("");
  const [appName, setAppName] = useState<string>("LandtagsOS");
  const [appSubtitle, setAppSubtitle] = useState<string>("Koordinationssystem");
  const [instagram, setInstagram] = useState<string>("");
  const [facebook, setFacebook] = useState<string>("");
  const [twitter, setTwitter] = useState<string>("");
  const [linkedin, setLinkedin] = useState<string>("");

  // Step 2
  const [seedMode, setSeedMode] = useState<SeedMode>("standard");
  const [cloneFromTenantId, setCloneFromTenantId] = useState<string>("");

  // Step 3
  const [createAdmin, setCreateAdmin] = useState<boolean>(true);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [adminName, setAdminName] = useState<string>("");

  const reset = () => {
    setStep(1);
    setSubmitting(false);
    setResult(null);
    setPasswordCopied(false);
    setName("");
    setDescription("");
    setConstituency("");
    setConstituencyNumber("");
    setCity("");
    setStateValue("");
    setParty("");
    setAppName("LandtagsOS");
    setAppSubtitle("Koordinationssystem");
    setInstagram("");
    setFacebook("");
    setTwitter("");
    setLinkedin("");
    setSeedMode("standard");
    setCloneFromTenantId("");
    setCreateAdmin(true);
    setAdminEmail("");
    setAdminName("");
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      const wasCreated = result !== null;
      reset();
      if (wasCreated) onCreated();
    }
    onOpenChange(next);
  };

  const canNextFromStep1 = name.trim().length > 0;
  const canNextFromStep2 = seedMode !== "clone" || Boolean(cloneFromTenantId);
  const canSubmit =
    !createAdmin || (adminEmail.trim().length > 0 && adminName.trim().length > 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const settings = {
        constituency: constituency.trim(),
        constituency_number: constituencyNumber.trim(),
        city: city.trim(),
        state: stateValue,
        party: party.trim(),
        social_media: {
          instagram: instagram.trim(),
          facebook: facebook.trim(),
          x: twitter.trim(),
          linkedin: linkedin.trim(),
        },
      };

      const payload = {
        action: "provisionTenant",
        name: name.trim(),
        description: description.trim() || null,
        settings,
        appName: appName.trim() || "LandtagsOS",
        appSubtitle: appSubtitle.trim() || "Koordinationssystem",
        seedMode,
        cloneFromTenantId: seedMode === "clone" ? cloneFromTenantId : undefined,
        adminUser: createAdmin
          ? { email: adminEmail.trim(), displayName: adminName.trim() }
          : undefined,
      };

      const { data, error } = await supabase.functions.invoke("manage-tenant-user", {
        body: payload,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Anlegen fehlgeschlagen");

      setResult({
        tenantId: data.tenantId,
        tenantName: name.trim(),
        report: data.report,
        adminPassword: data.adminPassword,
        adminEmail: data.adminEmail,
      });
      setStep(4);
      toast({ title: "Tenant angelegt", description: `${name.trim()} ist startklar.` });
    } catch (err) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Anlegen fehlgeschlagen",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = () => {
    if (!result?.adminPassword) return;
    navigator.clipboard.writeText(result.adminPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {result ? "Tenant erfolgreich angelegt" : "Neuen Tenant anlegen"}
          </DialogTitle>
          <DialogDescription>
            {result
              ? "Der Tenant ist startklar. Übergebe das Passwort sicher an den neuen Admin."
              : `Schritt ${step} von 3`}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {!result && (
          <div className="flex items-center gap-2 text-xs">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`flex-1 h-1.5 rounded-full ${
                  step >= n ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        )}

        {/* STEP 1: Stammdaten */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Büro Max Mustermann" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Beschreibung</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Kurze Beschreibung des Tenants"
                />
              </div>
              <div className="space-y-2">
                <Label>Wahlkreis</Label>
                <Input value={constituency} onChange={(e) => setConstituency(e.target.value)} placeholder="z.B. Karlsruhe-West" />
              </div>
              <div className="space-y-2">
                <Label>WK-Nummer</Label>
                <Input value={constituencyNumber} onChange={(e) => setConstituencyNumber(e.target.value)} placeholder="z.B. 27" />
              </div>
              <div className="space-y-2">
                <Label>Stadt</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bundesland</Label>
                <Select value={stateValue} onValueChange={setStateValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Bundesland wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUNDESLAENDER.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Partei</Label>
                <Input value={party} onChange={(e) => setParty(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>App-Name</Label>
                <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>App-Untertitel</Label>
                <Input value={appSubtitle} onChange={(e) => setAppSubtitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" />
              </div>
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>X / Twitter</Label>
                <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Setup-Quelle */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <RadioGroup value={seedMode} onValueChange={(v) => setSeedMode(v as SeedMode)}>
              <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setSeedMode("standard")}>
                <RadioGroupItem value="standard" id="r-standard" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="r-standard" className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Standard-Setup
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Legt 8 Falltypen, 7 Briefanlässe, 24 Notification-Typen, 2 Meeting-Vorlagen und Standard-App-Einstellungen an.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setSeedMode("clone")}>
                <RadioGroupItem value="clone" id="r-clone" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="r-clone" className="font-medium flex items-center gap-2">
                    <Copy className="h-4 w-4 text-primary" />
                    Aus Vorlage klonen
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Übernimmt alle Templates, Kategorien und Konfigurationen eines bestehenden Tenants 1:1.
                  </p>
                  {seedMode === "clone" && (
                    <Select value={cloneFromTenantId} onValueChange={setCloneFromTenantId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Quell-Tenant wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {templateTenants.length === 0 ? (
                          <div className="px-2 py-2 text-xs text-muted-foreground">Keine Tenants verfügbar</div>
                        ) : (
                          templateTenants.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}{t.is_template ? " ⭐" : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setSeedMode("empty")}>
                <RadioGroupItem value="empty" id="r-empty" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="r-empty" className="font-medium">Leer (manuell befüllen)</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Nur Tenant-Eintrag ohne Templates. Empfohlen nur für Tests.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* STEP 3: Admin-User */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="font-medium">Admin gleich anlegen</Label>
                <p className="text-xs text-muted-foreground">
                  Erstellt einen Benutzer mit Rolle „Abgeordneter" und generiertem Passwort.
                </p>
              </div>
              <Switch checked={createAdmin} onCheckedChange={setCreateAdmin} />
            </div>
            {createAdmin && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>E-Mail *</Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@beispiel.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Max Mustermann"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Success */}
        {step === 4 && result && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="font-medium text-emerald-700 dark:text-emerald-400">
                ✓ {result.tenantName} ist startklar
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                Tenant-ID: {result.tenantId}
              </div>
            </div>

            <SeedReportView report={result.report} />

            {result.adminPassword && (
              <div className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/30">
                <div className="text-sm font-medium mb-2">
                  Admin-Passwort für {result.adminEmail}
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background rounded border font-mono text-sm">
                    {result.adminPassword}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyPassword}>
                    {passwordCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Nur einmal sichtbar — bitte sicher übergeben.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between gap-2 pt-2 border-t">
          {step === 4 ? (
            <Button onClick={() => handleClose(false)} className="ml-auto">
              Schließen
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3) : handleClose(false))}
                disabled={submitting}
              >
                {step > 1 ? (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
                  </>
                ) : (
                  "Abbrechen"
                )}
              </Button>
              {step < 3 ? (
                <Button
                  onClick={() => setStep((step + 1) as 2 | 3)}
                  disabled={(step === 1 && !canNextFromStep1) || (step === 2 && !canNextFromStep2)}
                >
                  Weiter <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Tenant anlegen
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
