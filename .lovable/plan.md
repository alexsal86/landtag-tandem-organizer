## Pakete A–E ohne KI-Funktionen

KI-Aktionen (Themencluster, Antwortentwürfe, Trend-Erkennung per LLM) sind aus allen Paketen entfernt. Alle Funktionen arbeiten rein deterministisch mit SQL, Heuristiken und klassischen Algorithmen.

Reihenfolge: A → B → E → C → D (Mehrwert vor Scope-Risiko).

---

### A) Mobile Phase 2 — Vom Capture-Tool zum Arbeitsgerät

**Scope**
- Mobile **Aufgabenliste**: Tabs Inbox / Heute / Diese Woche, Erledigen, Snoozen (1h/heute Abend/morgen), Delegieren (Sheet mit Team-Mitgliedern).
- Mobile **Vorgangs-Detail**: Lesen, Status ändern, Interaktion erfassen, Verlauf anzeigen.
- Mobile **Kontakt-Detail**: Stammdaten, Briefing-Memory anzeigen, Schnellaktion „Anruf protokollieren" (Erstellt `call_log` + verlinkten Vorgang/Task).
- **Server-Push**: Edge-Function `dispatch-mobile-push` (Expo Push API), getriggert in `create_notification` RPC für alle Mobile-Tokens des Empfängers.
- **Tiefe Deep-Links**: `landtagmobile://vorgang/{id}`, `…/task/{id}`, `…/contact/{id}` → Expo Linking → entsprechende Screens.

**Technik**
- Expo Router neue Screens `app/tasks/index.tsx`, `app/tasks/[id].tsx`, `app/cases/[id].tsx`, `app/contacts/[id].tsx`.
- Reuse der bestehenden `useTasks`/`useCases`/`useContacts` Hooks, nur Mobile-Wrapper-Komponenten.
- `expo-server-sdk` als Deno-kompatibler Fetch in `dispatch-mobile-push`.

**DoD**
- 4 Hauptscreens nutzbar, Push erreicht Gerät in < 5 s, Deep-Link öffnet korrekten Screen.

---

### B) Datenqualität & Duplikat-Hygiene

**Scope**
- **Duplikat-Erkennung Kontakte**: SQL-Function `find_contact_duplicates(tenant_id)` mit Score aus normalisierter Email/Telefon (exakt) + Name (trigram `pg_trgm` similarity) + Adresse (PLZ+Hausnr).
- **Merge-UI** unter `/admin/datenqualitaet/duplikate`: Master wählen, Felder feldweise übernehmen, alle Verknüpfungen (Vorgänge, Briefe, Termine, Tasks) automatisch umhängen.
- **Daten-Lint Dashboard** `/admin/datenqualitaet/lint`: Kontakte ohne Kategorie, Vorgänge ohne Owner/Status, Briefe ohne Empfänger, verwaiste Tasks (Owner gelöscht), Termine in der Vergangenheit ohne Feedback. Score pro Tenant.
- **Bulk-Aktionen**: Tags zuweisen, Owner umhängen, Kategorie setzen, archivieren — Tabelle mit Filter + Mehrfachauswahl.
- **Audit & Reverse**: jede Merge/Bulk-Aktion in `data_quality_audit` (snapshot_before JSONB), 30 Tage Reverse-Möglichkeit.

**Technik**
- Edge-Function `merge-contacts` mit transaktionalem Update (`UPDATE … FROM`) und Audit-Insert.
- `pg_trgm` Extension aktivieren, GIN-Index auf normalisiertem Namen.

**DoD**
- Duplikat-Score messbar reduziert (Vorher/Nachher-Report), Lint-Dashboard live, Reverse einer Merge funktioniert.

---

### E) Workflow-Engine 2.0 (vorgezogen, da Plattform-Hebel)

**Scope** (**ohne** KI-Aktion „Antwortentwurf")
- Domain-Modell: `workflow_definitions` (trigger_type, conditions JSONB, actions JSONB[], is_active), `workflow_runs` (status, payload, error, dry_run).
- **Trigger-Typen**: `case_created`, `case_status_changed`, `task_due_soon`, `letter_approved`, `appointment_created`, `cron` (täglich/wöchentlich).
- **Bedingungen**: einfacher JSON-Logic-Builder (Feld, Operator, Wert; AND/OR).
- **Aktionen**: Task anlegen, Notification senden, Brief aus Vorlage erzeugen, Vorgang-Status ändern, Tag setzen, Kontakt-Kategorie setzen, E-Mail (transactional) versenden.
- **UI-Builder** unter `/admin/workflows`: Definition anlegen, Aktionen sortierbar, Live-Validierung.
- **Dry-Run-Modus**: Lauf simulieren, alle Side-Effects nur loggen.
- **Audit-Log** + Run-History pro Definition.

**Technik**
- Trigger über DB-Trigger → `pg_notify` → Edge-Function `workflow-dispatcher`, Cron-Trigger über `pg_cron`.
- Pre-built Workflows als Seed: „Neuer Bürger-Vorgang → Eingangsbestätigung", „Brief genehmigt → Task ‚Versenden'", „Termin in 24h → Briefing-Reminder".

**DoD**
- 5 vorgefertigte Workflows aktiv, Builder voll funktional, Dry-Run + Audit getestet.

---

### C) Wahlkreis-Analytics (rein deterministisch)

**Scope** (**ohne** KI-Themencluster, **ohne** LLM-Trends)
- **Heatmap Wahlkreis**: Vorgänge & Kontakte pro Stadtteil/PLZ als Choropleth auf bestehender Karte (`react-leaflet`), Toggle Vorgänge/Kontakte/Briefe.
- **Themen-Statistik**: Auswertung über vorhandene Kategorien & Tags (keine KI), Top-10 pro Zeitraum, Vergleich Vormonat (% Δ).
- **Trend-Erkennung deterministisch**: Z-Score je Kategorie über 8-Wochen-Median; Markierung wenn aktuelle Woche > 2σ.
- **Stakeholder-Graph**: Sigma.js-Graph über geteilte Vorgänge/Briefe/Termine, Filter nach Beziehungsstärke (Anzahl gemeinsamer Objekte).
- **Quartalsbericht-PDF**: Knopfdruck-Export mit Kennzahlen, Top-Stadtteilen, Top-Kategorien, Trend-Markern (`pdf-lib`, A4, DIN-konform).

**Technik**
- Materialized Views `mv_district_stats`, `mv_category_weekly` mit nightly Refresh (`pg_cron`).
- Bestehende GeoJSON-Layer wiederverwenden.

**DoD**
- 3 neue Dashboards live, PDF-Export erzeugt korrekten Bericht, Materialized Views < 500 ms.

---

### D) Bürger-Self-Service-Portal (öffentlich)

**Scope**
- **Öffentliche Landingpage** `/buergeranliegen/{tenant-slug}`: Formular Name, E-Mail, PLZ, Anliegen (Kategorie-Dropdown), Freitext, optional Anhang.
- **Magic-Link-Statusseite** `/buergeranliegen/status/{token}`: aktueller Stand (öffentlich sichtbarer Statustext), History der öffentlich freigegebenen Updates — kein Login.
- **E-Mail-Benachrichtigung** an Bürger bei Statuswechsel via bestehender `send-transactional-email` Queue.
- **Anti-Spam**: Cloudflare Turnstile, Honey-Pot-Feld, IP-Rate-Limit (5/Std), max. 5MB Anhang.
- **Admin-Moderationsqueue** unter `/admin/buergeranliegen`: eingehende Submissions prüfen → Spam markieren oder als regulären Vorgang anlegen (Mapping auf bestehende `cases`).
- **DSGVO**: Pflicht-Checkbox, Datenschutz-Hinweistext, Lösch-Frist 6 Monate für Spam.

**Technik**
- Public route ohne Auth, eigene RLS-Policy (insert-only `public_case_submissions`).
- Edge-Functions `submit-public-case`, `public-case-status`, beide ohne JWT, mit Turnstile-Validierung.
- Tenant-Slug-Resolver via `tenant_public_settings.slug`.

**DoD**
- End-to-End-Journey funktioniert, Spam < 5%, DSGVO-Texte vorhanden, Moderationsqueue im Einsatz.

---

### Aufwand grob

| Paket | Datei-Touches | Migrationen | Edge-Funcs | Risiko |
|---|---|---|---|---|
| A Mobile Phase 2 | ~25 | 1 | 1 | mittel |
| B Datenqualität | ~15 | 2 | 1 | mittel |
| E Workflow-Engine | ~30 | 3 | 2 | hoch |
| C Analytics | ~20 | 2 (MV) | 1 (Cron) | mittel |
| D Bürger-Portal | ~20 | 2 | 3 | hoch |

Sage **„weiter"** und ich starte mit **Paket A (Mobile Phase 2)**, oder nenn die Reihenfolge die du bevorzugst.