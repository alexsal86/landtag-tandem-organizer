
# Plan: Terminabstimmung-Fixes und RSVP-Feature

## 1. Brief-Anlaesse RLS-Policy reparieren (Punkt 1)

**Ursache:** Die INSERT-Policy fuer `letter_occasions` prueft `profiles.id = auth.uid()`, aber `profiles.id` ist die Tabellen-PK (`d1beada0...`), waehrend `auth.uid()` die User-ID (`ff0e6d83...`) zurueckgibt. Dadurch schlaegt die Mandanten-Pruefung fehl und das Seeding wird blockiert.

**Loesung:** Alle vier RLS-Policies (SELECT, INSERT, UPDATE, DELETE) auf `letter_occasions` korrigieren: `profiles.id` durch `profiles.user_id` ersetzen.

### Technische Details

SQL-Migration:
```sql
DROP POLICY "Users can insert letter occasions for their tenant" ON letter_occasions;
DROP POLICY "Users can view letter occasions for their tenant" ON letter_occasions;
DROP POLICY "Users can update letter occasions for their tenant" ON letter_occasions;
DROP POLICY "Users can delete letter occasions for their tenant" ON letter_occasions;

CREATE POLICY "Users can insert letter occasions for their tenant" ON letter_occasions
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can view letter occasions for their tenant" ON letter_occasions
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update letter occasions for their tenant" ON letter_occasions
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete letter occasions for their tenant" ON letter_occasions
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
```

---

## 2.1 Duplikat-Zeitslots verhindern

**Ursache:** `addTimeSlot()` in `AppointmentPollCreator.tsx` prueft nicht, ob bereits ein identischer Zeitslot (gleicher Tag, gleiche Start- und Endzeit) existiert.

**Loesung:** Vor dem Hinzufuegen pruefen, ob ein Slot mit identischem Datum, Start- und Endzeit bereits vorhanden ist. Falls ja, Toast-Warnung anzeigen und nicht hinzufuegen.

**Datei:** `src/components/poll/AppointmentPollCreator.tsx` -- in `addTimeSlot()`.

---

## 2.2 Abstimmungslink fuehrt ins Leere (406 / PGRST116)

**Ursache:** In `PollResponseInterface.tsx` wird `.single()` verwendet fuer den Poll-Abruf (Zeile 66). Da die SELECT-Policy auf `appointment_polls` nur `auth.role() = 'authenticated'` prueft, haben unauthentifizierte Gaeste (anon-Rolle) keinen Zugriff. Der Abruf gibt 0 Zeilen zurueck, `.single()` wirft PGRST116.

**Loesung:** 
- Eine zusaetzliche RLS-Policy auf `appointment_polls` fuer die `anon`-Rolle anlegen, die aktive Polls per SELECT liest
- Ebenso auf `poll_time_slots` und `poll_participants` fuer anon SELECT erlauben (nur aktive Polls)
- `.single()` durch `.maybeSingle()` ersetzen in `PollResponseInterface.tsx`
- Fuer `poll_responses` braucht anon auch INSERT-Rechte (ueber Token-Pruefung) und DELETE (fuer re-submit)

### Technische Details

SQL-Migration:
```sql
-- Allow anon users to read active polls (for guest voting links)
CREATE POLICY "Anon can view active polls" ON appointment_polls
  FOR SELECT TO anon USING (status = 'active');

-- Allow anon to view time slots for active polls
CREATE POLICY "Anon can view time slots for active polls" ON poll_time_slots
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM appointment_polls ap 
    WHERE ap.id = poll_time_slots.poll_id AND ap.status = 'active'
  ));

-- Allow anon to view/find their participant record by token
CREATE POLICY "Anon can view participants by token" ON poll_participants
  FOR SELECT TO anon USING (token IS NOT NULL);

-- Allow anon to manage responses via token-based participants
CREATE POLICY "Anon can insert responses" ON poll_responses
  FOR INSERT TO anon WITH CHECK (EXISTS (
    SELECT 1 FROM poll_participants pp 
    WHERE pp.id = poll_responses.participant_id AND pp.token IS NOT NULL
  ));
CREATE POLICY "Anon can view own responses" ON poll_responses
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM poll_participants pp 
    WHERE pp.id = poll_responses.participant_id AND pp.token IS NOT NULL
  ));
CREATE POLICY "Anon can delete own responses" ON poll_responses
  FOR DELETE TO anon USING (EXISTS (
    SELECT 1 FROM poll_participants pp 
    WHERE pp.id = poll_responses.participant_id AND pp.token IS NOT NULL
  ));
```

Code-Aenderung: `.single()` durch `.maybeSingle()` in `PollResponseInterface.tsx` Zeile 66 ersetzen.

---

## 2.3 Poll-Link oeffnen tut nichts

**Ursache:** `openPollLink()` in `PollListView.tsx` (Zeile 236) verwendet `window.open()` mit `_blank`, was in der Preview-Umgebung blockiert werden kann. Ausserdem oeffnet es die Guest-View im Preview-Modus -- fuer den Ersteller waere ein Klick auf die Ergebnisansicht sinnvoller.

**Loesung:** Statt `window.open` die Navigation direkt in der App durchfuehren. Da der "Link oeffnen"-Button fuer den Ersteller gedacht ist, soll er die Ergebnisansicht oeffnen (gleich wie der Ergebnisse-Button), oder alternativ den Link in die Zwischenablage kopieren. Besserer Ansatz: Button kopiert den Gastlink in die Zwischenablage und zeigt einen Toast.

**Datei:** `src/components/poll/PollListView.tsx` -- `openPollLink()` aendern zu einer Clipboard-Copy-Aktion.

---

## 2.4 Teilnehmer im Bearbeitungsdialog hinzufuegen/entfernen

**Aktueller Stand:** `PollEditDialog.tsx` erlaubt nur die Bearbeitung von Titel, Beschreibung und Frist.

**Loesung:** Den `PollEditDialog` um einen Teilnehmer-Bereich erweitern:
- Bestehende Teilnehmer anzeigen (mit Loeschmoeglichkeit)
- Neue externe E-Mail-Adressen hinzufuegen
- Neue Kontakte aus der Kontaktliste hinzufuegen
- Beim Speichern: entfernte Teilnehmer aus `poll_participants` loeschen, neue einfuegen und optional Einladungen versenden

**Dateien:** `src/components/poll/PollEditDialog.tsx`

---

## 2.5 Ersteller speichern und anzeigen

**Aktueller Stand:** `appointment_polls.user_id` speichert bereits den Ersteller, aber die Uebersicht und Details zeigen den Namen nicht an.

**Loesung:**
- In `PollListView.tsx`: Beim Laden der Polls den Ersteller-Namen ueber `profiles` laden und als Spalte "Erstellt von" in der Tabelle anzeigen
- In `PollResultsDashboard.tsx`: Den Ersteller-Namen im Header anzeigen

**Dateien:** `src/components/poll/PollListView.tsx`, `src/components/poll/PollResultsDashboard.tsx`

---

## 2.6 Termin bestaetigen -- kein Feedback / kein Zuruecknavigieren

**Ursache:** `handleConfirmSlot()` in `PollResultsDashboard.tsx` zeigt zwar einen Toast, aber die Ansicht bleibt gleich. Der Poll-Status wird auf "completed" gesetzt, aber die UI wird nicht aktualisiert (die Buttons bleiben sichtbar, kein visuelles Feedback).

**Loesung:**
- Nach erfolgreicher Bestaetigung den lokalen Poll-Status auf "completed" setzen, damit die "Termin bestaetigen"-Buttons verschwinden
- Eine Erfolgsmeldung (Alert/Banner) oben in der Ergebnisansicht einblenden mit den Details des bestaetigten Termins
- Optional: Nach 2 Sekunden zurueck zur Uebersicht navigieren (oder einen "Zurueck"-Link anbieten)

**Datei:** `src/components/poll/PollResultsDashboard.tsx`

---

## 2.7 RSVP aus der Veranstaltungsplanung

Da eine einfache Zu-/Absage-Funktion gewuenscht ist (kein Terminvorschlag), wird ein eigenes, schlankes RSVP-System gebaut:

**Neues Feature:**
- Neue DB-Tabelle `event_rsvps` mit Feldern: `id`, `event_planning_id`, `email`, `name`, `status` (invited/accepted/declined/tentative), `token`, `responded_at`, `created_at`
- Button "Einladungen versenden" in der Veranstaltungsplanungs-Detailansicht
- Dialog zur Auswahl der einzuladenden Kontakte (aus Kontaktliste oder manuell per E-Mail)
- Gastseite `/event-rsvp/:eventId?token=...` fuer die Zu-/Absage
- Edge-Function `send-event-invitation` zum E-Mail-Versand
- RSVP-Uebersicht in der Veranstaltungsplanungs-Detailansicht (wer hat zu-/abgesagt)

### Technische Details

SQL-Migration:
```sql
CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_planning_id UUID NOT NULL REFERENCES event_plannings(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited',
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  comment TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID REFERENCES tenants(id)
);
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
-- Policies fuer authenticated + anon (token-basiert)
```

**Neue Dateien:**
- `src/components/events/EventRSVPManager.tsx` -- Dialog zum Einladen + RSVP-Uebersicht
- `src/pages/EventRSVP.tsx` -- Gastseite fuer Zu-/Absage
- `supabase/functions/send-event-invitation/index.ts` -- E-Mail-Versand

**Geaenderte Dateien:**
- `src/components/EventPlanningView.tsx` -- RSVP-Manager einbinden
- `src/App.tsx` -- Route `/event-rsvp/:eventId` hinzufuegen

---

## Zusammenfassung

| Nr. | Problem | Loesung | Aufwand |
|-----|---------|---------|---------|
| 1 | Brief-Anlaesse 403 | RLS-Policies korrigieren (`profiles.user_id` statt `profiles.id`) | Minimal |
| 2.1 | Duplikat-Zeitslots | Duplikat-Pruefung in `addTimeSlot()` | Minimal |
| 2.2 | Abstimmungslink 406 | Anon-RLS-Policies + `.maybeSingle()` | Gering |
| 2.3 | Link oeffnen funktioniert nicht | Clipboard-Copy statt `window.open` | Minimal |
| 2.4 | Teilnehmer bearbeiten | `PollEditDialog` um Teilnehmerverwaltung erweitern | Mittel |
| 2.5 | Ersteller anzeigen | Profildaten laden und in Tabelle/Header anzeigen | Gering |
| 2.6 | Kein Feedback bei Bestaetigung | UI-Update nach Bestaetigung + Erfolgsbanner | Gering |
| 2.7 | RSVP aus Veranstaltungsplanung | Neue Tabelle + Gastseite + Edge-Function + UI | Mittel |
