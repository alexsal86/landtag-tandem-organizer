import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";
import { FIELD_MAPPINGS, TARGET_FIELDS } from "@/components/contact-import/types";
import { parseDistributionListNames } from "@/components/contact-import/distributionListNames";
import {
  autoMapFields, buildImportRow, parseCsvSource, parseVCardSource,
} from "@/components/contact-import/importParsing";
import { assignContactToDistributionLists } from "@/components/contact-import/assignContactToDistributionLists";
import { findPotentialDuplicates } from "@/utils/duplicateDetection";
import {
  defaultLegalBasis, defaultReviewDate, isReviewDue, retentionRuleText,
} from "@/features/contacts/privacy/retention";
import {
  GDPR_APPROVER_ROLES, canApproveGdprDelete, isApprovedBySecondPerson,
} from "@/features/contacts/privacy/gdprApproval";

const stamp = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;
const CONFIG_ADMIN_ROLES = ["abgeordneter", "bueroleitung"];

/**
 * Weiterführende Kontakt-Workflows. Bewusst ein eigenes Szenario: Diese
 * Schritte hängen an Policies und Triggern (z. B. Briefingwissen über die
 * Profil-Mandantenzuordnung). Ein Fehler dort darf den Kern-Lifecycle samt
 * Merge-Atomarität und Suche nicht überspringen. Deshalb ist nur das Setup
 * kritisch; alle Prüfschritte laufen unabhängig voneinander weiter.
 */
export const contactRelationsScenario: TestScenario = {
  id: "contact-relations",
  title: "Kontakt-Beziehungen (Datenschutz → Themen → Duplikate → Sammelaktion → Verteiler → Wissen → Förderungen)",
  description:
    "Prüft die weiterführenden Kontakt-Workflows: Aufbewahrungsfristen, Importzuordnung und Dubletten, Themenverknüpfung, Dubletten-Scan, Sammelbearbeitung mit Rücknahme, Verteiler, Briefingwissen, Förderungen und die gesicherte Kontaktlesung. Ein fehlgeschlagener Schritt blockiert die übrigen nicht.",
  touches: [
    "contacts", "contact_activities", "contact_topics", "topics", "call_logs",
    "distribution_lists", "distribution_list_members", "gdpr_requests",
    "map_flags", "map_flag_types",
    "contact_briefing_memory", "fundings", "funding_participants",
  ],
  features: ["contacts"],
  checks: [
    "Der Datenbank-Trigger setzt Rechtsgrundlage und Prüffrist: Bürger 24 Monate ab Erfassung, alle anderen bis 31.03.2031",
    "Die reinen Aufbewahrungsregeln (Fristberechnung, Fälligkeit, Regeltext) stimmen mit dem Trigger überein",
    "Eine Löschanfrage entsteht ausstehend unter der eigenen Identität; Eigenfreigabe per Update und per approve_gdpr_delete wird abgewiesen, Anfrage und Gegenstand bleiben unverändert",
    "Der eigene ausstehende Antrag wird am Ende zurückgezogen, sodass der Lauf keinen offenen Löschantrag hinterlässt",
    "Die Vier-Augen-Regel erlaubt nur einer zweiten angemeldeten Person die Freigabe und verlangt deren eingetragenen Zustimmungszeitpunkt",
    "Importzuordnung ordnet deutsche und englische Spalten zu und zerlegt die Verteiler-Spalte an ; , und |",
    "CSV-Text (Komma und Semikolon) und VCF-Text werden eingelesen, zugeordnet und zu Kontaktwerten mit Anzeigename übersetzt",
    "Zeilen ohne Namen und mit ungültiger E-Mail-Adresse werden abgewiesen; eine echte Importzeile legt den Kontakt an und ordnet ihn den Verteilern zu, ohne Mitgliedschaften zu verdoppeln",
    "Die Import-Duplikaterkennung findet gleiche E-Mail- oder Telefonnummern und ignoriert unähnliche Kontakte",
    "Anlegen, Bearbeiten und ein Anrufprotokoll erzeugen die passenden contact_activities über Trigger",
    "Themen werden über contact_topics verknüpft, doppelte Verknüpfungen sind gesperrt und topic_usage zählt Kontakte",
    "find_contact_duplicates_trgm findet ein Dublettenpaar im Büro und weist fremde Mandanten ab",
    "bulk_update_contact_fields ändert Kategorie und Schlagworte für mehrere Kontakte, protokolliert die Sammelaktion und weist ungültige Eingaben ab",
    "undo_contact_bulk_action stellt die vorherigen Werte wieder her (Büroleitung) bzw. wird für Mitglieder abgewiesen",
    "Verteilerlisten nehmen mehrere Kontakte auf, doppelte Mitglieder sind gesperrt, das Löschen der Liste entfernt die Mitglieder",
    "Ein Stakeholder wird als Organisation angelegt und die zugeordnete Person über assign_contact_to_organization verknüpft",
    "Ein Kartenflag wird mit eigenem Flag-Typ und Koordinaten angelegt, mit Typ, Büro und Tags zurückgelesen und wieder gelöscht",
    "Briefingwissen wird angelegt, geändert und gelöscht",
    "Eine Förderung mit Beteiligung des Kontakts wird angelegt, gelesen und doppelte Beteiligungen sind gesperrt",
    "Die gesicherte Kontaktlesung liefert den eigenen Kontakt und keine Zeilen aus fremden Büros",
    "Zusammenführen verschiebt Themen und Briefingwissen mit und löscht den Zweitkontakt",
  ],
  limitations: [
    "Die Oberfläche selbst (Grid/Liste, Detail-Sheet, Formulare) wird nicht gerendert; geprüft werden die zugrunde liegenden Schreib- und Lesepfade.",
    "Feldbasierte Maskierung (field_permissions mit can_read=false) wird nicht verändert; geprüft wird die gesicherte Lesefunktion read_secured_contacts, nicht eine konfigurierte Maskierung.",
    "Die positive Freigabe einer Löschanfrage braucht die persönliche Anmeldung einer zweiten berechtigten Person und wird deshalb hier nur als Regel plus Datenbank-Abweisung der Eigenfreigabe geprüft; die Freigabe mit zwei Konten deckt der Rollback-Test der Migration ab.",
    "Der Selbsttest zieht seinen eigenen ausstehenden Löschantrag am Ende zurück (DELETE-Policy nur für requested_by = auth.uid() und status = 'pending'); freigegebene oder fremde Anträge bleiben unlöschbar.",
    "Kartenflag, Flag-Typ, Koordinaten und Löschen sind geprüft; Kartenebenen (map_layers) und Flag-Themen (map_flag_topics) bleiben ausgeklammert.",
    "Die Rücknahme einer Sammelaktion verlangt Büroleitung oder Abgeordneten-Mandat; als Mitglied wird stattdessen die Abweisung geprüft.",
    "Der Import wird über seine reinen Regeln und den gemeinsamen Verteilerpfad geprüft: CSV- und VCF-Text werden eingelesen und zugeordnet, eine daraus gebaute Zeile wird gespeichert und den Verteilern zugeordnet. Der Datei-Dialog selbst und das Excel-/ODS-Einlesen laufen nicht im Selbsttest.",
    "Briefingwissen folgt der Profil-Mandantenzuordnung; bei mehreren Büros kann die Sichtbarkeit einschränken. Genau deshalb blockiert dieser Schritt die übrigen Prüfungen nicht.",
    "Alle Prüfschritte außer dem Setup sind nicht blockierend: ein Policy- oder Triggerfehler wird am Schritt gemeldet, die folgenden Schritte laufen weiter.",
  ],
  writes: [
    { table: "contacts", columns: ["name", "user_id", "tenant_id", "email", "phone", "category", "tags", "notes", "created_at"] },
    { table: "contact_activities", columns: ["contact_id", "tenant_id", "created_by", "activity_type", "title", "description"] },
    { table: "contact_topics", columns: ["tenant_id", "contact_id", "topic_id"] },
    { table: "topics", columns: ["label", "tenant_id"] },
    { table: "call_logs", columns: ["contact_id", "user_id", "call_type", "duration_minutes", "notes", "follow_up_required", "priority"] },
    { table: "distribution_lists", columns: ["user_id", "tenant_id", "name", "description", "topic"] },
    { table: "distribution_list_members", columns: ["distribution_list_id", "contact_id"] },
    { table: "map_flag_types", columns: ["tenant_id", "name", "icon", "color", "created_by"] },
    { table: "map_flags", columns: ["tenant_id", "flag_type_id", "title", "description", "coordinates", "created_by", "tags", "metadata"] },
    { table: "gdpr_requests", columns: ["tenant_id", "request_type", "subject_contact_id", "subject_name", "subject_email", "reason", "requested_by"] },
    { table: "contact_briefing_memory", columns: ["tenant_id", "contact_id", "kind", "content", "question", "answer", "pinned_by"] },
    { table: "fundings", columns: ["tenant_id", "title", "total_amount", "status", "created_by"] },
    { table: "funding_participants", columns: ["funding_id", "contact_id", "allocated_amount", "role"] },
  ],
  links: (ctx) => ctx.data.contactId ? [{ label: "Kontakt öffnen", href: `/contacts/${ctx.data.contactId}` }] : [],
  steps: [
    {
      id: "setup", label: "Ausgangskontakt für die Beziehungsprüfungen anlegen", critical: true,
      run: async (ctx) => {
        const payload = {
          name: stamp(ctx.runId, "Erika Muster Beziehungen"), user_id: ctx.userId, tenant_id: ctx.tenantId,
          email: "erika.muster@example.org", phone: "+49 721 123456", category: "citizen", notes: SELFTEST_MARKER,
        };
        const { data, error } = await supabase.from("contacts").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "contacts", id: data.id });
        ctx.data.contactId = data.id;
        return expectFields("contacts", data.id, payload, "Ausgangskontakt");
      },
    },
    {
      id: "retention-defaults",
      label: "Aufbewahrungsfristen werden beim Anlegen aus der Kategorie gesetzt",
      critical: false,
      run: async (ctx) => {
        const citizen = await supabase.from("contacts").insert({
          name: stamp(ctx.runId, "Bürgerin Aufbewahrung"), user_id: ctx.userId, tenant_id: ctx.tenantId,
          category: "citizen", notes: SELFTEST_MARKER, created_at: "2026-01-15T10:00:00.000Z",
        }).select("id").single();
        if (citizen.error || !citizen.data) return { ok: false, message: describeError(citizen.error) };
        ctx.trackRecord({ table: "contacts", id: citizen.data.id });

        const business = await supabase.from("contacts").insert({
          name: stamp(ctx.runId, "Wirtschaft Aufbewahrung"), user_id: ctx.userId, tenant_id: ctx.tenantId,
          category: "business", notes: SELFTEST_MARKER, created_at: "2026-01-15T10:00:00.000Z",
        }).select("id").single();
        if (business.error || !business.data) return { ok: false, message: describeError(business.error) };
        ctx.trackRecord({ table: "contacts", id: business.data.id });

        const [citizenRow, businessRow] = await Promise.all([
          supabase.from("contacts").select("legal_basis, retention_review_date, retention_status").eq("id", citizen.data.id).single(),
          supabase.from("contacts").select("legal_basis, retention_review_date, retention_status").eq("id", business.data.id).single(),
        ]);
        const failure = [citizenRow, businessRow].map((response) => response.error).find(Boolean);
        if (failure) return { ok: false, message: describeError(failure) };

        const checks = {
          buergerRechtsgrundlage: citizenRow.data?.legal_basis === "mandate_public_interest",
          buergerFrist24Monate: citizenRow.data?.retention_review_date === "2028-01-15",
          andereRechtsgrundlage: businessRow.data?.legal_basis === "legitimate_interest",
          legislaturende: businessRow.data?.retention_review_date === "2031-03-31",
          statusAktiv: citizenRow.data?.retention_status === "active" && businessRow.data?.retention_status === "active",
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Bürgerkontakte erhalten 24 Monate ab Erfassung, alle anderen das Legislaturende 31.03.2031."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "retention-rules", label: "Aufbewahrungsregeln rechnen und prüfen", kind: "logic", critical: false,
      run: async () => {
        const reference = new Date("2026-11-12T00:00:00Z");
        const checks = {
          buergerZweiJahre: defaultReviewDate("citizen", reference) === "2028-11-12",
          andereLegislaturende: defaultReviewDate("business", reference) === "2031-03-31",
          rechtsgrundlageBuerger: defaultLegalBasis("citizen") === "mandate_public_interest",
          rechtsgrundlageAndere: defaultLegalBasis("politician") === "legitimate_interest",
          faelligAmStichtag: isReviewDue("2026-11-12", new Date("2026-11-12T10:00:00Z")),
          nichtVorzeitigFaellig: !isReviewDue("2026-11-13", new Date("2026-11-12T10:00:00Z")),
          ohneDatumFaellig: isReviewDue(null),
          regeltextBuerger: retentionRuleText("citizen").includes("24 Monate"),
          regeltextAndere: retentionRuleText("business").includes("31.03.2031"),
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Fristberechnung, Fälligkeit und Regeltexte stimmen mit den Datenbankvorgaben überein."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "gdpr-four-eyes",
      label: "Vier-Augen-Regel der Löschanfrage als reine Regel prüfen",
      kind: "logic", critical: false,
      run: async () => {
        const pending = { request_type: "delete", status: "pending", requested_by: "erste-person" };
        const approved = { ...pending, status: "approved" };
        const checks = {
          eigenfreigabeGesperrt: !canApproveGdprDelete(pending, "erste-person").allowed,
          zweitePersonErlaubt: canApproveGdprDelete(pending, "zweite-person").allowed,
          freigegebenNichtErneut: !canApproveGdprDelete(approved, "zweite-person").allowed,
          auskunftOhneFreigabe: !canApproveGdprDelete({ ...pending, request_type: "export" }, "zweite-person").allowed,
          ohneAnmeldungGesperrt: !canApproveGdprDelete(pending, null).allowed,
          zustimmungBrauchtZweite: isApprovedBySecondPerson({
            ...approved, approved_by: "zweite-person", approved_at: "2026-01-01T00:00:00.000Z",
          }),
          eigeneZustimmungZaehltNicht: !isApprovedBySecondPerson({
            ...approved, approved_by: "erste-person", approved_at: "2026-01-01T00:00:00.000Z",
          }),
          fehlenderZeitpunktZaehltNicht: !isApprovedBySecondPerson({
            ...approved, approved_by: "zweite-person", approved_at: null,
          }),
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Die Vier-Augen-Regel sperrt Eigenfreigaben und verlangt die Zustimmung einer zweiten Person mit Zeitpunkt."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "gdpr-deletion",
      label: "Löschanfrage anlegen, Eigenfreigabe abweisen und zweite berechtigte Person prüfen",
      critical: false,
      run: async (ctx) => {
        const approverRoles: string[] = [...GDPR_APPROVER_ROLES];
        if (!ctx.role || !approverRoles.includes(ctx.role)) {
          return {
            ok: true,
            message: `Löschanfragen dürfen nur ${approverRoles.join(" oder ")} stellen; angemeldet ist ${ctx.role ?? "keine Rolle"}. Der Schritt wurde nicht ausgeführt.`,
          };
        }

        const contactId = ctx.data.contactId as string;
        const created = await supabase.from("gdpr_requests").insert({
          tenant_id: ctx.tenantId,
          request_type: "delete",
          subject_contact_id: contactId,
          subject_name: stamp(ctx.runId, "Erika Muster Löschanfrage"),
          subject_email: "erika.muster@example.org",
          reason: `${SELFTEST_MARKER} DSGVO-Löschantrag aus dem Selbsttest`,
          requested_by: ctx.userId,
        }).select("id, status, request_type, requested_by, approved_by, approved_at").single();
        if (created.error || !created.data) return { ok: false, message: describeError(created.error) };
        const request = created.data;
        ctx.data.gdprRequestId = request.id;
        // Auch ein abgebrochener Lauf darf keinen offenen Antrag hinterlassen.
        ctx.trackRecord({ table: "gdpr_requests", id: request.id });

        // Beide Wege der Eigenfreigabe müssen die Datenbank-Bremse auslösen.
        const selfUpdate = await supabase.from("gdpr_requests")
          .update({ status: "approved" }).eq("id", request.id);
        const selfRpc = await supabase.rpc("approve_gdpr_delete", { p_request_id: request.id });
        const immutability = await supabase.from("gdpr_requests")
          .update({ subject_email: "geaendert@example.org" }).eq("id", request.id);

        const reload = await supabase.from("gdpr_requests")
          .select("status, approved_by, approved_at, subject_email, subject_name")
          .eq("id", request.id).single();
        if (reload.error || !reload.data) return { ok: false, message: `Anfrage lesen: ${describeError(reload.error)}` };

        const peer = await supabase.from("user_tenant_memberships")
          .select("user_id, role")
          .eq("tenant_id", ctx.tenantId).eq("is_active", true)
          .in("role", approverRoles).neq("user_id", ctx.userId).limit(1).maybeSingle();
        const peerId = peer.data?.user_id ?? null;
        const peerRoleEligible = Boolean(peer.data?.role)
          && approverRoles.includes(String(peer.data?.role));

        const selfDecision = canApproveGdprDelete(request, ctx.userId);
        const peerDecision = canApproveGdprDelete(request, peerId ?? "zweite-person");
        const approvedRow = isApprovedBySecondPerson({
          ...request, status: "approved",
          approved_by: peerId ?? "zweite-person", approved_at: new Date().toISOString(),
        });
        const selfApprovedRow = isApprovedBySecondPerson({
          ...request, status: "approved", approved_by: ctx.userId, approved_at: new Date().toISOString(),
        });

        // Aufräumen ohne Regelbruch: die eigene, weiterhin ausstehende Anfrage zurückziehen.
        const withdrawn = await supabase.from("gdpr_requests").delete().eq("id", request.id);
        const afterWithdraw = await supabase.from("gdpr_requests")
          .select("id").eq("id", request.id).maybeSingle();

        const checks = {
          antragAngelegt: reload.data.status === "pending" && request.request_type === "delete"
            && request.requested_by === ctx.userId && request.approved_by === null,
          selbstfreigabeAbgewiesen: Boolean(selfUpdate.error)
            && /zweite aktive berechtigte Person/.test(selfUpdate.error?.message ?? ""),
          rpcFreigabeAbgewiesen: Boolean(selfRpc.error)
            && /zweite aktive berechtigte Person/.test(selfRpc.error?.message ?? ""),
          anfrageUnveraendert: reload.data.status === "pending"
            && reload.data.approved_by === null && reload.data.approved_at === null,
          gegenstandUnveraenderlich: Boolean(immutability.error)
            && /unveränderlich/.test(immutability.error?.message ?? "")
            && reload.data.subject_email === "erika.muster@example.org",
          regelBlockiertSelbstfreigabe: !selfDecision.allowed,
          regelErlaubtZweitePerson: peerId ? (peerDecision.allowed && peerRoleEligible) : true,
          regelVerlangtZweitePerson: approvedRow && !selfApprovedRow,
          zurueckgezogen: !withdrawn.error && afterWithdraw.error === null && afterWithdraw.data === null,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? (peerId
              ? "Löschanfrage entsteht ausstehend, Eigenfreigabe wird per Update und RPC abgewiesen, eine zweite berechtigte Person erfüllt die Vier-Augen-Regel; der Antrag wird danach zurückgezogen."
              : "Löschanfrage entsteht ausstehend, Eigenfreigabe wird per Update und RPC abgewiesen, im Büro fehlt eine zweite berechtigte Person; der Antrag wird danach zurückgezogen.")
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: { ...checks, requestId: request.id, secondPersonFound: Boolean(peerId), withdrawn: !afterWithdraw.data },
        };
      },
    },
    {
      id: "import-mapping",
      label: "Import liest CSV und VCF ein, ordnet Spalten zu und bereitet Zeilen auf",
      kind: "logic", critical: false,
      run: async () => {
        const mappedTargets = [...new Set(Object.values(FIELD_MAPPINGS))];
        const unknownTargets = mappedTargets.filter((target) => !TARGET_FIELDS.includes(target));
        const unusedTargets = TARGET_FIELDS.filter((target) => !mappedTargets.includes(target));
        const lists = parseDistributionListNames("Presse; Umwelt, Vereine|Vorstand");

        const csvText = [
          "Nachname,Vorname,Firma,E-Mail 1,Verteiler",
          'Mustermann,Max ,Beispiel GmbH, max.mustermann@example.org ,"Presse; Umwelt"',
        ].join("\n");
        const csvRows = parseCsvSource(csvText);
        const csvRow = buildImportRow(csvRows[0] ?? {}, autoMapFields(Object.keys(csvRows[0] ?? {})));

        const semicolonRows = parseCsvSource("Nachname;Vorname;E-Mail 1\nMusterfrau;Erika;erika@example.org");
        const semicolonRow = buildImportRow(semicolonRows[0] ?? {}, autoMapFields(Object.keys(semicolonRows[0] ?? {})));

        const vcfText = [
          "BEGIN:VCARD",
          "VERSION:3.0",
          "N:Mustermann;Max;;;",
          "FN:Max Mustermann",
          "ORG:Beispiel GmbH;Vertrieb",
          "TITLE:Geschäftsführer",
          "EMAIL;TYPE=WORK:max@example.org",
          "EMAIL;TYPE=HOME:max@privat.de",
          "TEL;TYPE=CELL:+49 170 1234567",
          "TEL;TYPE=WORK:+49 721 555",
          "ADR;TYPE=WORK:;;Musterstraße 1;Musterstadt;;76133;Deutschland",
          "URL:https://example.org",
          "NOTE:Notiz",
          "END:VCARD",
        ].join("\n");
        const vcfRows = parseVCardSource(vcfText);
        const vcfRow = buildImportRow(vcfRows[0] ?? {}, autoMapFields(Object.keys(vcfRows[0] ?? {})));

        const duplicates = findPotentialDuplicates(
          { id: "", name: "Erika Muster", email: "ERIKA@example.org", phone: "+49 (721) 123456" },
          [
            { id: "a", name: "E. Muster", email: "erika@example.org" },
            { id: "b", name: "Erika Muster", phone: "+49721123456" },
            { id: "c", name: "Max Beispiel", email: "max@example.org", phone: "+49 30 999999" },
          ],
        );

        const checks = {
          deutscheSpalten: FIELD_MAPPINGS["Nachname"] === "last_name"
            && FIELD_MAPPINGS["Vorname"] === "first_name"
            && FIELD_MAPPINGS["E-Mail 1"] === "email"
            && FIELD_MAPPINGS["Firma"] === "organization",
          englischeSpalten: FIELD_MAPPINGS["First Name"] === "first_name"
            && FIELD_MAPPINGS["Email"] === "email"
            && FIELD_MAPPINGS["City"] === "business_city",
          verteilerSpalte: FIELD_MAPPINGS["Verteiler"] === "distribution_list_names",
          nurGueltigeZiele: unknownTargets.length === 0,
          alleZieleErreichbar: unusedTargets.every((target) => target === "notes"),
          verteilerZerlegt: lists.join("|") === "Presse|Umwelt|Vereine|Vorstand",
          leereVerteilerSpalte: parseDistributionListNames("  ").length === 0,
          dublettenErkannt: duplicates.map((match) => match.contact.id).sort().join(",") === "a,b",
          aehnlicheStelleBewertet: duplicates[0]?.reasons.some((reason) => reason.includes("E-Mail") || reason.includes("Telefon")) ?? false,
          csvGelesen: csvRows.length === 1,
          csvSpaltenzugeordnet: csvRow.values.first_name === "Max"
            && csvRow.values.last_name === "Mustermann"
            && csvRow.values.organization === "Beispiel GmbH"
            && csvRow.values.email === "max.mustermann@example.org",
          csvNameGesetzt: csvRow.values.name === "Max Mustermann",
          csvVerteilerZerlegt: csvRow.distributionListNames.join("|") === "Presse|Umwelt",
          csvVerteilerNichtImKontakt: !("distribution_list_names" in csvRow.values) && csvRow.error === null,
          semikolonErkannt: semicolonRow.values.email === "erika@example.org",
          vcfGelesen: vcfRows.length === 1,
          vcfNameUndFirma: vcfRow.values.name === "Max Mustermann"
            && vcfRow.values.organization === "Beispiel GmbH"
            && vcfRow.values.position === "Geschäftsführer",
          vcfKontaktdaten: vcfRow.values.email === "max@example.org"
            && vcfRow.values.mobile_phone === "+49 170 1234567"
            && vcfRow.values.business_phone === "+49 721 555",
          vcfAdresse: vcfRow.values.business_city === "Musterstadt"
            && vcfRow.values.business_postal_code === "76133"
            && vcfRow.values.business_street === "Musterstraße 1",
          fehlenderNameGemeldet: buildImportRow(
            { "E-Mail 1": "ohne.name@example.org" }, autoMapFields(["E-Mail 1"]),
          ).error === "Kein Name angegeben",
          ungueltigeMailGemeldet: (buildImportRow(
            { Nachname: "Muster", "E-Mail 1": "keine-mail" }, autoMapFields(["Nachname", "E-Mail 1"]),
          ).error ?? "").startsWith("Ungültige E-Mail-Adresse"),
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "CSV (Komma/Semikolon) und VCF werden eingelesen, Spalten zugeordnet, Verteiler zerlegt und ungültige Zeilen abgewiesen."
            : `Fehlgeschlagen: ${failed.join(", ")} (unbekannte Ziele: ${unknownTargets.join(", ") || "keine"}; nicht zugeordnet: ${unusedTargets.join(", ") || "keine"})`,
          details: { ...checks, unknownTargets, unusedTargets },
        };
      },
    },
    {
      id: "import-assignment",
      label: "Importzeile anlegen und über die Verteiler-Spalte zuordnen",
      critical: false,
      run: async (ctx) => {
        const listBase = `ST ${ctx.runId.slice(0, 8)} Importverteiler`;
        const firstList = `${listBase} A`;
        const secondList = `${listBase} B`;
        const csvText = [
          "Nachname,Vorname,Firma,E-Mail 1,Verteiler",
          `Importling,Ida,${listBase} GmbH,ida.importling@example.org,"${firstList}; ${secondList}"`,
        ].join("\n");
        const rows = parseCsvSource(csvText);
        const row = buildImportRow(rows[0] ?? {}, autoMapFields(Object.keys(rows[0] ?? {})));
        if (row.error) return { ok: false, message: `Importzeile ungültig: ${row.error}` };

        // Spalten stammen aus der dynamischen Zuordnung; Name, Mandant und Benutzer werden explizit gesetzt.
        const inserted = await supabase.from("contacts").insert({
          ...row.values, name: row.values.name ?? "", user_id: ctx.userId, tenant_id: ctx.tenantId, notes: SELFTEST_MARKER,
        } as TablesInsert<"contacts">).select("id, name, email, first_name, last_name, organization").single();
        if (inserted.error || !inserted.data) return { ok: false, message: describeError(inserted.error) };
        ctx.trackRecord({ table: "contacts", id: inserted.data.id });

        const assignment = {
          contactId: inserted.data.id, listNames: row.distributionListNames,
          userId: ctx.userId, tenantId: ctx.tenantId,
        };
        const failures = await assignContactToDistributionLists(supabase, assignment);
        if (failures.length > 0) {
          const detail = failures.map(({ listName, message }) => `${listName} (${message})`).join(", ");
          return { ok: false, message: `Verteilerzuordnung: ${detail}` };
        }

        const lists = await supabase.from("distribution_lists")
          .select("id, name").eq("tenant_id", ctx.tenantId).in("name", [firstList, secondList]);
        if (lists.error || !lists.data) return { ok: false, message: `Verteiler lesen: ${describeError(lists.error)}` };
        const createdLists = lists.data;
        createdLists.forEach((list) => ctx.trackRecord({ table: "distribution_lists", id: list.id }));

        const members = await supabase.from("distribution_list_members")
          .select("id, distribution_list_id").eq("contact_id", inserted.data.id);
        if (members.error || !members.data) return { ok: false, message: `Mitgliedschaften lesen: ${describeError(members.error)}` };
        members.data.forEach((member) => ctx.trackRecord({ table: "distribution_list_members", id: member.id }));

        const repeatedFailures = await assignContactToDistributionLists(supabase, assignment);
        const afterRepeat = await supabase.from("distribution_list_members")
          .select("id").eq("contact_id", inserted.data.id);

        const checks = {
          zeileVorbereitet: rows.length === 1 && row.distributionListNames.length === 2,
          kontaktAngelegt: inserted.data.name === "Ida Importling"
            && inserted.data.email === "ida.importling@example.org"
            && inserted.data.first_name === "Ida"
            && inserted.data.last_name === "Importling"
            && inserted.data.organization === `${listBase} GmbH`,
          zweiVerteilerAngelegt: createdLists.length === 2,
          zweiMitgliedschaften: members.data.length === 2
            && members.data.every((member) => createdLists.some((list) => list.id === member.distribution_list_id)),
          wiederholungOhneDuplikat: repeatedFailures.length === 0 && afterRepeat.data?.length === 2,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Die Importzeile wird gespeichert, beide Verteiler werden angelegt und zugeordnet; ein zweiter Lauf verdoppelt nichts."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "activity-triggers",
      label: "Anlegen, Bearbeiten und Anrufe protokollieren Aktivitäten automatisch",
      critical: false,
      run: async (ctx) => {
        const contactId = ctx.data.contactId as string;
        const activities = await supabase.from("contact_activities")
          .select("id, activity_type, metadata").eq("contact_id", contactId);
        if (activities.error) return { ok: false, message: describeError(activities.error) };
        const created = (activities.data ?? []).find((row) => row.activity_type === "created");

        const edited = await supabase.from("contacts")
          .update({ position: stamp(ctx.runId, "Geschäftsführung") }).eq("id", contactId);
        if (edited.error) return { ok: false, message: `Bearbeiten: ${describeError(edited.error)}` };
        const afterEdit = await supabase.from("contact_activities")
          .select("id, metadata").eq("contact_id", contactId).eq("activity_type", "edit");
        if (afterEdit.error) return { ok: false, message: describeError(afterEdit.error) };
        const editActivity = (afterEdit.data ?? []).find((row) => {
          const metadata = row.metadata as { changed_fields?: string[] } | null;
          return (metadata?.changed_fields ?? []).includes("position");
        });

        const call = await supabase.from("call_logs").insert({
          user_id: ctx.userId, contact_id: contactId, call_type: "incoming",
          duration_minutes: 7, notes: `${SELFTEST_PREFIX} Rückruf`, follow_up_required: true, priority: "high",
        }).select("id").single();
        if (call.error || !call.data) return { ok: false, message: describeError(call.error) };
        ctx.trackRecord({ table: "call_logs", id: call.data.id });

        const afterCall = await supabase.from("contact_activities")
          .select("id, metadata").eq("contact_id", contactId).eq("activity_type", "call");
        if (afterCall.error) return { ok: false, message: describeError(afterCall.error) };
        const callActivity = (afterCall.data ?? []).find((row) => {
          const metadata = row.metadata as { call_log_id?: string } | null;
          return metadata?.call_log_id === call.data.id;
        });

        const checks = {
          anlegenProtokolliert: Boolean(created),
          bearbeitenProtokolliert: Boolean(editActivity),
          anrufProtokolliert: Boolean(callActivity),
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Anlegen, Feldänderung und Anruf erscheinen als Aktivität am Kontakt."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "topics", label: "Themen verknüpfen, Duplikate sperren und Verwendung zählen", critical: false,
      run: async (ctx) => {
        const contactId = ctx.data.contactId as string;
        const label = `ST ${ctx.runId.slice(0, 8)} Kontaktthema`;
        const topic = await supabase.rpc("ensure_topic", { p_tenant: ctx.tenantId, p_label: label });
        if (topic.error || !topic.data) return { ok: false, message: `Thema anlegen: ${describeError(topic.error)}` };
        const topicId = topic.data;
        ctx.trackRecord({ table: "topics", id: topicId });
        ctx.data.topicId = topicId;

        const link = await supabase.from("contact_topics")
          .insert({ tenant_id: ctx.tenantId, contact_id: contactId, topic_id: topicId })
          .select("id").single();
        if (link.error || !link.data) return { ok: false, message: `Thema verknüpfen: ${describeError(link.error)}` };
        ctx.trackRecord({ table: "contact_topics", id: link.data.id });

        const duplicate = await supabase.from("contact_topics")
          .insert({ tenant_id: ctx.tenantId, contact_id: contactId, topic_id: topicId });

        const counted = await supabase.rpc("topic_usage", { p_tenant: ctx.tenantId });
        if (counted.error || !counted.data) return { ok: false, message: `Verwendung lesen: ${describeError(counted.error)}` };
        const beforeDelete = counted.data.find((row) => row.topic_id === topicId)?.contacts ?? 0;

        const removed = await supabase.from("contact_topics").delete().eq("id", link.data.id);
        const afterDelete = await supabase.rpc("topic_usage", { p_tenant: ctx.tenantId });
        if (afterDelete.error || !afterDelete.data) return { ok: false, message: `Verwendung nach Löschen: ${describeError(afterDelete.error)}` };
        const remaining = afterDelete.data.find((row) => row.topic_id === topicId)?.contacts ?? 0;

        // Verknüpfung bleibt für den Zusammenführungsschritt bestehen.
        const restored = await supabase.from("contact_topics")
          .insert({ tenant_id: ctx.tenantId, contact_id: contactId, topic_id: topicId })
          .select("id").single();
        if (restored.error || !restored.data) return { ok: false, message: `Thema erneut verknüpfen: ${describeError(restored.error)}` };
        ctx.trackRecord({ table: "contact_topics", id: restored.data.id });

        const linkRow = await supabase.from("contact_topics")
          .select("tenant_id, contact_id, topic_id").eq("id", restored.data.id).maybeSingle();
        const checks = {
          verknuepft: linkRow.data?.tenant_id === ctx.tenantId
            && linkRow.data?.contact_id === contactId && linkRow.data?.topic_id === topicId,
          duplikatGesperrt: duplicate.error?.code === "23505",
          gezaehlt: Number(beforeDelete) >= 1,
          loeschenVerringert: Number(remaining) === Number(beforeDelete) - 1,
          wiederVerknuepft: !removed.error,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Themenverknüpfung ist eindeutig, topic_usage zählt Kontakte und folgt dem Löschen."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: { ...checks, beforeDelete, remaining },
        };
      },
    },
    {
      id: "duplicate-scan",
      label: "Dubletten-Scan findet Kontakte im eigenen Büro und bleibt mandantengetrennt",
      critical: false,
      run: async (ctx) => {
        const contactId = ctx.data.contactId as string;
        const twin = await supabase.from("contacts").insert({
          name: stamp(ctx.runId, "Erika Muster"), user_id: ctx.userId, tenant_id: ctx.tenantId,
          email: "erika.muster@example.org", phone: "+49 721 123456", category: "citizen", notes: SELFTEST_MARKER,
        }).select("id").single();
        if (twin.error || !twin.data) return { ok: false, message: describeError(twin.error) };
        ctx.trackRecord({ table: "contacts", id: twin.data.id });

        const scan = await supabase.rpc("find_contact_duplicates_trgm", {
          _tenant_id: ctx.tenantId, _threshold: 0.5, _limit: 200,
        });
        if (scan.error || !scan.data) return { ok: false, message: `Dubletten-Scan: ${describeError(scan.error)}` };
        const pair = scan.data.find((row) =>
          (row.contact1_id === contactId && row.contact2_id === twin.data.id)
          || (row.contact1_id === twin.data.id && row.contact2_id === contactId));

        const foreign = await supabase.rpc("find_contact_duplicates_trgm", {
          _tenant_id: crypto.randomUUID(), _threshold: 0.5, _limit: 10,
        });

        const checks = {
          paarGefunden: Boolean(pair),
          begruendung: Boolean(pair?.match_reasons.some((reason) => reason.includes("E-Mail"))),
          fremderMandantAbgewiesen: Boolean(foreign.error),
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Das Dublettenpaar wird mit Begründung gefunden; fremde Büros werden abgewiesen."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: { ...checks, score: pair?.match_score ?? null, reasons: pair?.match_reasons ?? [] },
        };
      },
    },
    {
      id: "bulk-update",
      label: "Sammelbearbeitung ändert mehrere Kontakte und protokolliert die Rücknahme",
      critical: false,
      run: async (ctx) => {
        const ids: string[] = [];
        for (const suffix of ["A", "B", "C"]) {
          const created = await supabase.from("contacts").insert({
            name: stamp(ctx.runId, `Sammelkontakt ${suffix}`), user_id: ctx.userId, tenant_id: ctx.tenantId,
            category: "citizen", notes: SELFTEST_MARKER, tags: ["selbsttest"],
          }).select("id").single();
          if (created.error || !created.data) return { ok: false, message: describeError(created.error) };
          ctx.trackRecord({ table: "contacts", id: created.data.id });
          ids.push(created.data.id);
        }

        const category = await supabase.rpc("bulk_update_contact_fields", {
          _tenant_id: ctx.tenantId, _ids: ids, _operation: "category_set", _value: "business",
        });
        if (category.error) return { ok: false, message: `Kategorie setzen: ${describeError(category.error)}` };

        const audit = await supabase.from("bulk_action_audit")
          .select("id, undo_payload").eq("tenant_id", ctx.tenantId)
          .eq("action", "contacts.fields_updated").order("created_at", { ascending: false }).limit(5);
        if (audit.error) return { ok: false, message: `Protokoll lesen: ${describeError(audit.error)}` };
        type AuditChanges = { changes?: Array<{ id: string; before: { category: string | null }; after: { category: string | null } }> };
        const categoryAudit = (audit.data ?? []).find((row) => {
          const changes = (row.undo_payload as unknown as AuditChanges | null)?.changes ?? [];
          return ids.every((id) => changes.some((change) => change.id === id && change.before.category === "citizen" && change.after.category === "business"));
        });

        const changed = await supabase.from("contacts").select("id, category").in("id", ids);
        if (changed.error) return { ok: false, message: describeError(changed.error) };
        const categoryApplied = (changed.data ?? []).length === 3
          && (changed.data ?? []).every((row) => row.category === "business");

        // Die Rücknahme vergleicht Kategorie und Schlagworte; sie muss deshalb vor
        // der Tag-Änderung laufen, sonst gilt der Kontakt als zwischenzeitlich verändert.
        const isAdmin = CONFIG_ADMIN_ROLES.includes(ctx.role ?? "");
        let undoRestored: number | null = null;
        let undoRefused = false;
        if (categoryAudit) {
          const undo = await supabase.rpc("undo_contact_bulk_action", { _audit_id: categoryAudit.id });
          if (isAdmin) {
            if (undo.error) return { ok: false, message: `Rücknahme: ${describeError(undo.error)}` };
            undoRestored = undo.data ?? 0;
          } else {
            undoRefused = undo.error?.code === "42501";
          }
        }

        const tags = await supabase.rpc("bulk_update_contact_fields", {
          _tenant_id: ctx.tenantId, _ids: ids, _operation: "tags_add", _value: ["sammel", "südstadt"],
        });
        if (tags.error) return { ok: false, message: `Schlagworte ergänzen: ${describeError(tags.error)}` };

        const unknownOperation = await supabase.rpc("bulk_update_contact_fields", {
          _tenant_id: ctx.tenantId, _ids: ids, _operation: "unknown", _value: "x",
        });
        const duplicateIds = await supabase.rpc("bulk_update_contact_fields", {
          _tenant_id: ctx.tenantId, _ids: [ids[0], ids[0]], _operation: "category_set", _value: "media",
        });
        const foreignContact = await supabase.rpc("bulk_update_contact_fields", {
          _tenant_id: ctx.tenantId, _ids: [...ids, crypto.randomUUID()], _operation: "category_set", _value: "media",
        });

        const finalRows = await supabase.from("contacts").select("id, category, tags").in("id", ids);
        if (finalRows.error) return { ok: false, message: describeError(finalRows.error) };
        const rows = finalRows.data ?? [];

        const checks = {
          kategorieGesetzt: categoryApplied,
          endzustandKategorie: rows.every((row) => row.category === (isAdmin ? "citizen" : "business")),
          schlagworteErgaenzt: rows.every((row) => (row.tags ?? []).includes("sammel") && (row.tags ?? []).includes("südstadt")),
          unveraenderteBasisTags: rows.every((row) => (row.tags ?? []).includes("selbsttest")),
          protokolliert: Boolean(categoryAudit),
          unbekannteAktionAbgewiesen: unknownOperation.error?.code === "22023",
          doppelteAuswahlAbgewiesen: duplicateIds.error?.code === "22023",
          fremderKontaktAbgewiesen: foreignContact.error?.code === "42501",
          ruecknahme: isAdmin ? undoRestored === 3 : undoRefused,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? isAdmin
              ? "Kategorie und Schlagworte wurden gesetzt, die Sammelaktion protokolliert und vollständig zurückgenommen."
              : "Kategorie und Schlagworte wurden gesetzt; die Rücknahme bleibt der Büroleitung vorbehalten."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: { ...checks, isAdmin, undoRestored },
        };
      },
    },
    {
      id: "distribution-list",
      label: "Verteiler mit Stakeholder und Personen anlegen, prüfen und löschen",
      critical: false,
      run: async (ctx) => {
        const organization = await supabase.from("contacts").insert({
          name: stamp(ctx.runId, "Stakeholder Beispiel GmbH"), user_id: ctx.userId, tenant_id: ctx.tenantId,
          contact_type: "organization", category: "business", notes: SELFTEST_MARKER,
        }).select("id").single();
        if (organization.error || !organization.data) return { ok: false, message: describeError(organization.error) };
        ctx.trackRecord({ table: "contacts", id: organization.data.id });

        const person = await supabase.from("contacts").insert({
          name: stamp(ctx.runId, "Ansprechpartner Beispiel GmbH"), user_id: ctx.userId, tenant_id: ctx.tenantId,
          contact_type: "person", category: "business", notes: SELFTEST_MARKER,
        }).select("id").single();
        if (person.error || !person.data) return { ok: false, message: describeError(person.error) };
        ctx.trackRecord({ table: "contacts", id: person.data.id });

        const assigned = await supabase.rpc("assign_contact_to_organization", {
          contact_id: person.data.id, org_id: organization.data.id,
        });
        if (assigned.error) return { ok: false, message: `Organisation zuordnen: ${describeError(assigned.error)}` };
        const personRow = await supabase.from("contacts").select("organization_id").eq("id", person.data.id).single();

        const list = await supabase.from("distribution_lists").insert({
          user_id: ctx.userId, tenant_id: ctx.tenantId,
          name: stamp(ctx.runId, "Verteiler Beispiel"), description: SELFTEST_MARKER, topic: "Netzwerk",
        }).select("id").single();
        if (list.error || !list.data) return { ok: false, message: describeError(list.error) };
        ctx.trackRecord({ table: "distribution_lists", id: list.data.id });

        const members = await supabase.from("distribution_list_members")
          .insert([
            { distribution_list_id: list.data.id, contact_id: organization.data.id },
            { distribution_list_id: list.data.id, contact_id: person.data.id },
          ]).select("id");
        if (members.error || !members.data) return { ok: false, message: describeError(members.error) };
        members.data.forEach((row) => ctx.trackRecord({ table: "distribution_list_members", id: row.id }));

        const duplicate = await supabase.from("distribution_list_members")
          .insert({ distribution_list_id: list.data.id, contact_id: person.data.id });
        const readBack = await supabase.from("distribution_list_members")
          .select("contact_id").eq("distribution_list_id", list.data.id);

        const removed = await supabase.from("distribution_lists").delete().eq("id", list.data.id);
        const afterDelete = await supabase.from("distribution_list_members")
          .select("id").eq("distribution_list_id", list.data.id);

        const checks = {
          organisationZugeordnet: personRow.data?.organization_id === organization.data.id,
          zweiMitglieder: !readBack.error && readBack.data?.length === 2,
          doppeltesMitgliedGesperrt: duplicate.error?.code === "23505",
          listeGeloescht: !removed.error,
          mitgliederKaskadiert: !afterDelete.error && afterDelete.data?.length === 0,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Stakeholder, Personenzuordnung und Verteiler funktionieren; Mitglieder sind eindeutig und verschwinden mit der Liste."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "stakeholder-flag",
      label: "Kartenflag mit Flag-Typ und Koordinaten anlegen, lesen und löschen",
      critical: false,
      run: async (ctx) => {
        let flagTypeId: string;

        if (ctx.role && CONFIG_ADMIN_ROLES.includes(ctx.role)) {
          const createdType = await supabase.from("map_flag_types").insert({
            tenant_id: ctx.tenantId, name: stamp(ctx.runId, "Stakeholder-Flaggentyp"),
            icon: "🏛️", color: "#2563eb", created_by: ctx.userId,
          }).select("id, name, icon, color").single();
          if (createdType.error || !createdType.data) {
            return { ok: false, message: `Flag-Typ anlegen: ${describeError(createdType.error)}` };
          }
          flagTypeId = createdType.data.id;
          ctx.trackRecord({ table: "map_flag_types", id: createdType.data.id });
        } else {
          // Ohne Adminrolle lässt sich kein Typ anlegen; dann muss ein vorhandener genügen.
          const existingType = await supabase.from("map_flag_types")
            .select("id, name").eq("tenant_id", ctx.tenantId).eq("is_active", true)
            .order("order_index").limit(1).maybeSingle();
          if (existingType.error) return { ok: false, message: `Flag-Typ lesen: ${describeError(existingType.error)}` };
          if (!existingType.data) {
            return {
              ok: true,
              message: `Ohne Adminrolle lässt sich kein Flag-Typ anlegen und im Büro ist keiner aktiv; der Schritt wurde nicht ausgeführt.`,
            };
          }
          flagTypeId = existingType.data.id;
        }

        const coordinates = { lat: 49.0069, lng: 8.4037 };
        const flag = await supabase.from("map_flags").insert({
          tenant_id: ctx.tenantId, flag_type_id: flagTypeId,
          title: stamp(ctx.runId, "Stakeholder-Kartenflag"),
          description: `${SELFTEST_MARKER} Kartenflag aus dem Selbsttest`,
          coordinates, created_by: ctx.userId,
          tags: ["selftest"], metadata: { source: "selftest" },
        }).select("id").single();
        if (flag.error || !flag.data) return { ok: false, message: `Flag anlegen: ${describeError(flag.error)}` };
        ctx.trackRecord({ table: "map_flags", id: flag.data.id });

        const readBack = await supabase.from("map_flags")
          .select("id, title, coordinates, flag_type_id, tenant_id, created_by, tags")
          .eq("id", flag.data.id).maybeSingle();
        if (readBack.error) return { ok: false, message: `Flag lesen: ${describeError(readBack.error)}` };
        const typeRead = await supabase.from("map_flag_types")
          .select("id, name, icon").eq("id", flagTypeId).maybeSingle();

        const deleted = await supabase.from("map_flags").delete().eq("id", flag.data.id);
        const afterDelete = await supabase.from("map_flags").select("id").eq("id", flag.data.id).maybeSingle();

        const stored = readBack.data?.coordinates as { lat?: number; lng?: number } | null;
        const checks = {
          typVorhanden: typeRead.data?.id === flagTypeId,
          koordinatenGespeichert: stored?.lat === coordinates.lat && stored?.lng === coordinates.lng,
          typVerknuepft: readBack.data?.flag_type_id === flagTypeId,
          eigenesBuero: readBack.data?.tenant_id === ctx.tenantId
            && readBack.data?.created_by === ctx.userId,
          tagsGespeichert: readBack.data?.tags?.includes("selftest") ?? false,
          geloescht: !deleted.error && !afterDelete.data,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Das Kartenflag trägt Typ, Koordinaten und Tags, gehört zum eigenen Büro und ist nach dem Löschen nicht mehr lesbar."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "briefing-memory", label: "Briefingwissen je Kontakt anlegen, ändern und löschen", critical: false,
      run: async (ctx) => {
        const contactId = ctx.data.contactId as string;
        const position = await supabase.from("contact_briefing_memory").insert({
          tenant_id: ctx.tenantId, contact_id: contactId, kind: "position",
          content: `${SELFTEST_PREFIX} Lehnt Photovoltaik auf Ackerflächen ab`, pinned_by: ctx.userId,
        }).select("id").single();
        if (position.error || !position.data) return { ok: false, message: `Position anlegen: ${describeError(position.error)}` };
        ctx.trackRecord({ table: "contact_briefing_memory", id: position.data.id });

        const qa = await supabase.from("contact_briefing_memory").insert({
          tenant_id: ctx.tenantId, contact_id: contactId, kind: "qa",
          question: `${SELFTEST_PREFIX} Wie ist die Haltung zum Nahverkehr?`, answer: "Ausbau befürwortet",
          pinned_by: ctx.userId,
        }).select("id").single();
        if (qa.error || !qa.data) return { ok: false, message: `Frage/Antwort anlegen: ${describeError(qa.error)}` };
        ctx.trackRecord({ table: "contact_briefing_memory", id: qa.data.id });

        const updated = await supabase.from("contact_briefing_memory")
          .update({ content: `${SELFTEST_PREFIX} Befürwortet Photovoltaik auf Deponien` })
          .eq("id", position.data.id);
        const readBack = await supabase.from("contact_briefing_memory")
          .select("kind, content, question, answer").eq("contact_id", contactId).order("created_at");
        const removed = await supabase.from("contact_briefing_memory").delete().eq("id", qa.data.id);
        const afterDelete = await supabase.from("contact_briefing_memory")
          .select("id").eq("id", qa.data.id).maybeSingle();

        const rows = readBack.data ?? [];
        const checks = {
          beideArtenLesbar: rows.some((row) => row.kind === "position" && row.content?.includes("Deponien"))
            && rows.some((row) => row.kind === "qa" && Boolean(row.question) && Boolean(row.answer)),
          aktualisiert: !updated.error,
          geloescht: !removed.error && !afterDelete.data,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Position und Frage/Antwort sind am Kontakt gespeichert, änderbar und löschbar."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "fundings", label: "Förderung mit Kontaktbeteiligung anlegen und eindeutig halten", critical: false,
      run: async (ctx) => {
        const contactId = ctx.data.contactId as string;
        const funding = await supabase.from("fundings").insert({
          tenant_id: ctx.tenantId, title: stamp(ctx.runId, "Förderung Beispiel"),
          description: SELFTEST_MARKER, total_amount: 5000, status: "active", created_by: ctx.userId,
        }).select("id").single();
        if (funding.error || !funding.data) return { ok: false, message: describeError(funding.error) };
        ctx.trackRecord({ table: "fundings", id: funding.data.id });

        const participant = await supabase.from("funding_participants").insert({
          funding_id: funding.data.id, contact_id: contactId, allocated_amount: 1200, role: "Antragsteller",
        }).select("id").single();
        if (participant.error || !participant.data) return { ok: false, message: describeError(participant.error) };
        ctx.trackRecord({ table: "funding_participants", id: participant.data.id });

        const duplicate = await supabase.from("funding_participants")
          .insert({ funding_id: funding.data.id, contact_id: contactId, allocated_amount: 100 });

        const participation = await supabase.from("funding_participants")
          .select("allocated_amount, role, funding_id, fundings!inner (id, title, total_amount, status)")
          .eq("contact_id", contactId);
        if (participation.error) return { ok: false, message: describeError(participation.error) };

        type Participation = { allocated_amount: number | null; role: string | null; fundings: { title: string; status: string } | null };
        const row = (participation.data as unknown as Participation[]).find((entry) => entry.fundings?.title === stamp(ctx.runId, "Förderung Beispiel"));
        const checks = {
          beteiligungLesbar: Boolean(row) && row?.allocated_amount === 1200 && row?.role === "Antragsteller",
          foerderungVerknuepft: row?.fundings?.status === "active",
          doppelteBeteiligungGesperrt: duplicate.error?.code === "23505",
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Die Förderung ist mit dem Kontakt verbunden, lesbar und je Kontakt nur einmal beteiligt."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "secured-read",
      label: "Gesicherte Kontaktlesung liefert eigene Daten und keine fremden Büros", critical: false,
      run: async (ctx) => {
        const contactId = ctx.data.contactId as string;
        const own = await supabase.rpc("read_secured_contacts", { _tenant_id: ctx.tenantId, _ids: [contactId] });
        if (own.error || !own.data) return { ok: false, message: `Eigene Kontakte lesen: ${describeError(own.error)}` };
        const row = own.data.find((entry) => entry.id === contactId);

        const foreign = await supabase.rpc("read_secured_contacts", {
          _tenant_id: crypto.randomUUID(), _ids: [contactId],
        });
        const missing = await supabase.rpc("read_secured_contacts", {
          _tenant_id: ctx.tenantId, _ids: [crypto.randomUUID()],
        });

        const checks = {
          eigenerKontaktLesbar: Boolean(row) && row?.name.includes(ctx.runId),
          stammdatenVollstaendig: row?.email === "erika.muster@example.org" && row?.phone === "+49 721 123456",
          fremdesBueroLeer: !foreign.error && (foreign.data ?? []).length === 0,
          unbekannteIdLeer: !missing.error && (missing.data ?? []).length === 0,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Der eigene Kontakt kommt vollständig zurück; fremde Büros und unbekannte IDs liefern keine Zeilen."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "merge-links",
      label: "Zusammenführen verschiebt Themen und Briefingwissen mit",
      kind: "workflow", critical: false,
      run: async (ctx) => {
        const targetId = ctx.data.contactId as string;
        let topicId = ctx.data.topicId as string | undefined;
        if (!topicId) {
          const topic = await supabase.rpc("ensure_topic", {
            p_tenant: ctx.tenantId, p_label: `ST ${ctx.runId.slice(0, 8)} Merge-Thema`,
          });
          if (topic.error || !topic.data) return { ok: false, message: `Thema anlegen: ${describeError(topic.error)}` };
          // topic.data ist nach der Prüfung ein string; der eigene const hält die Einengung fest.
          const createdTopicId: string = topic.data;
          ctx.trackRecord({ table: "topics", id: createdTopicId });
          topicId = createdTopicId;
        }

        const secondary = await supabase.from("contacts").insert({
          name: stamp(ctx.runId, "Erika Doppelt Beziehungen"), user_id: ctx.userId, tenant_id: ctx.tenantId,
          email: "erika.doppelt.beziehungen@example.org", notes: SELFTEST_MARKER,
        }).select("id").single();
        if (secondary.error || !secondary.data) return { ok: false, message: describeError(secondary.error) };
        ctx.trackRecord({ table: "contacts", id: secondary.data.id });

        const memory = await supabase.from("contact_briefing_memory").insert({
          tenant_id: ctx.tenantId, contact_id: secondary.data.id, kind: "role_note",
          content: `${SELFTEST_PREFIX} Zweitkontakt-Rollennotiz`, pinned_by: ctx.userId,
        }).select("id").single();
        if (memory.error || !memory.data) return { ok: false, message: `Briefingwissen anlegen: ${describeError(memory.error)}` };
        ctx.trackRecord({ table: "contact_briefing_memory", id: memory.data.id });

        const topicLink = await supabase.from("contact_topics")
          .insert({ tenant_id: ctx.tenantId, contact_id: secondary.data.id, topic_id: topicId })
          .select("id").single();
        if (topicLink.error || !topicLink.data) return { ok: false, message: `Thema verknüpfen: ${describeError(topicLink.error)}` };
        ctx.trackRecord({ table: "contact_topics", id: topicLink.data.id });

        const merged = await supabase.rpc("merge_contacts", {
          p_target: targetId, p_source: secondary.data.id, p_updates: {},
        });
        if (merged.error) return { ok: false, message: `Zusammenführen: ${describeError(merged.error)}` };

        const [source, movedMemory, movedTopic] = await Promise.all([
          supabase.from("contacts").select("id").eq("id", secondary.data.id).maybeSingle(),
          supabase.from("contact_briefing_memory").select("contact_id").eq("id", memory.data.id).maybeSingle(),
          supabase.from("contact_topics").select("id").eq("contact_id", targetId).eq("topic_id", topicId).maybeSingle(),
        ]);
        const failure = [source, movedMemory, movedTopic].map((response) => response.error).find(Boolean);
        if (failure) return { ok: false, message: describeError(failure) };

        const checks = {
          zweitkontaktGeloescht: !source.data,
          briefingwissenUmgehaengt: movedMemory.data?.contact_id === targetId,
          themaAmZiel: Boolean(movedTopic.data),
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Themenverknüpfung und Briefingwissen hängen nach der Zusammenführung am Hauptkontakt."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
  ],
};
