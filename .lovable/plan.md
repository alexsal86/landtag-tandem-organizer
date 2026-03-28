

# 7 Verbesserungen an Terminplanungen

## 1. Titel in der Übersicht aktualisieren (Terminplanungen-Liste)

**Problem:** `preparation.title` wird bei Erstellung gesetzt (`Terminplanung: {title}`) und nie aktualisiert, wenn der Termin-Titel sich ändert.

**Lösung:** In `useEventPlanningData.ts` → `fetchAppointmentPreparations`: nach dem Laden der Preparations einen zweiten Query auf `appointments` machen, um die aktuellen Titel zu holen. Dann `preparation.title` mit dem aktuellen Appointment-Titel überschreiben (nur für die Anzeige, nicht in DB).

**Dateien:** `src/components/event-planning/useEventPlanningData.ts`
- Nach dem Fetch der Preparations: alle `appointment_id`s sammeln, `appointments` mit `.in('id', ids)` laden, dann die Titel im State ersetzen.

**Alternativ (einfacher):** In `EventPlanningListView.tsx` den angezeigten Titel dynamisch aus dem verknüpften Termin laden. Da die Preparations aber bereits `appointment_id` haben, ist der Batch-Ansatz im Hook sauberer.

## 2. Gesprächspartner-Card nach oben (linke Spalte)

**Problem:** Im Tab "Vorbereitung" hat Gesprächspartner `lg:order-1` und Anlass `lg:order-2`, aber auf kleinen Bildschirmen kommt Anlass zuerst weil es im DOM zuerst steht.

**Lösung:** In `AppointmentPreparationDataTab.tsx` die Reihenfolge der Cards im Grid ändern: Gesprächspartner-Card kommt als erstes Element im DOM (vor Anlass). Die `lg:order-*` Klassen können entfallen oder angepasst werden, sodass Gesprächspartner immer ganz oben links ist.

**Datei:** `src/components/appointment-preparations/AppointmentPreparationDataTab.tsx` (Zeilen ~691-972)

## 3. Kontakt-Autocomplete statt "Aus Kontakt hinzufügen"-Select

**Problem:** Aktuell gibt es ein separates Select "Aus Kontakten hinzufügen" + "Übernehmen"-Button. Nicht intuitiv.

**Lösung:** 
- Das separate "Aus Kontakten hinzufügen"-Panel (Zeilen 855-892) entfernen
- Im Name-Input-Feld eine **Autocomplete/Typeahead-Suche** einbauen: Während der User tippt, werden passende Kontakte als Dropdown vorgeschlagen
- Bei Auswahl eines Kontakts: Name, Rolle, Organisation, Avatar werden aus dem Kontakt übernommen
- Name, Rolle, Organisation werden **read-only** (disabled/grau)
- Nur "Hinweis" bleibt editierbar
- Ein kleiner "Kontakt öffnen"-Link (ExternalLink-Icon) wird angezeigt, der zu `/contacts/{id}` navigiert
- Ein "Lösen"-Button erlaubt, den Kontakt-Link zu entfernen und die Felder wieder editierbar zu machen
- Manuell hinzugefügte Partner (ohne Kontakt-Link) bleiben voll editierbar

**Technisch:**
- `ConversationPartner`-Typ erweitern um optionales `contact_id?: string`
- Neues State für Suchtext pro Partner-Zeile
- Dropdown-Liste wird mit `contacts.filter(c => c.name.toLowerCase().includes(search))` gefiltert
- Bei Kontakt-Auswahl: `contact_id` setzen, Felder füllen und sperren

**Datei:** `src/components/appointment-preparations/AppointmentPreparationDataTab.tsx`, `src/hooks/useAppointmentPreparation.tsx` (Typ erweitern um `contact_id`)

## 4. Foto-Upload über Avatar-Hover statt separates Upload-Feld

**Problem:** "Foto hochladen"-Label neben dem Avatar ist nicht elegant.

**Lösung:**
- Das Label "Foto hochladen" und das `<Label>` mit `UploadIcon` entfernen
- Den Avatar-Kreis in ein `relative group`-Wrapper packen
- Bei Hover: ein halbtransparentes Overlay mit Camera/Upload-Icon über dem Avatar anzeigen
- Klick auf das Overlay öffnet den File-Input
- Das Label "Foto" über dem Avatar entfernen

**Datei:** `src/components/appointment-preparations/AppointmentPreparationDataTab.tsx` (Zeilen 895-919)

## 5. Fragen & Antworten als strukturierte Paare

**Problem:** Aktuell ist `questions_answers` ein einzelnes Textarea für alles.

**Lösung:**
- Neues Datenfeld `qa_pairs` in `preparation_data`: `Array<{ id: string; question: string; answer: string }>`
- UI: Jedes Paar hat zwei Felder (Frage + Antwort) nebeneinander
- "Weitere Frage hinzufügen"-Button
- Entfernen-Button pro Paar
- Migration: bestehende `questions_answers`-Texte bleiben als Fallback lesbar, neue Eingaben gehen in `qa_pairs`
- Briefing-View und PDF-Generator: `qa_pairs` bevorzugen, `questions_answers` als Fallback

**Dateien:**
- `src/hooks/useAppointmentPreparation.tsx` — Typ um `qa_pairs` erweitern
- `src/components/appointment-preparations/AppointmentPreparationDataTab.tsx` — neuer Abschnitt in "Kommunikation"
- `src/components/appointment-preparations/AppointmentBriefingView.tsx` — Q&A-Paare rendern
- `src/components/appointment-preparations/briefingPdfGenerator.ts` — Q&A-Paare im PDF

## 6. Wichtige Themen & Gesprächspunkte als einzelne Items mit Hintergrundinfo

**Problem:** Aktuell sind `key_topics` und `talking_points` einfache Textareas.

**Lösung:**
- Neue Datenfelder: `key_topic_items: Array<{ id: string; topic: string; background: string }>` und `talking_point_items: Array<{ id: string; point: string; background: string }>`
- UI: Jedes Item hat ein Feld für das Thema und ein optionales Feld für Hintergrundinformationen
- Enter im Thema-Feld → neues leeres Item wird angelegt
- "Weiteres hinzufügen"-Button als Alternative
- Bestehende Freitext-Felder `key_topics` / `talking_points` bleiben als Fallback lesbar
- Briefing-View und PDF: neue Items bevorzugen, Freitext als Fallback

**Dateien:** gleiche wie Punkt 5 plus Anpassungen in `getImportantTopicLines()` in `useAppointmentPreparation.tsx`

## 7. PDF-Download-Button im Briefing-Tab

**Problem:** Im Briefing-Tab gibt es nur "Live-Briefing öffnen", aber keinen PDF-Download.

**Lösung:** In `AppointmentPreparationDetail.tsx` im Briefing-TabsContent neben dem "Live-Briefing öffnen"-Button einen Download-Icon-Button hinzufügen, der `generateBriefingPdf()` aufruft.

**Datei:** `src/pages/AppointmentPreparationDetail.tsx` (Zeilen 318-334)
- Import `generateBriefingPdf` + `Download`-Icon
- Button mit Download-Icon neben "Live-Briefing öffnen"
- Loading-State während der PDF-Generierung

---

## Zusammenfassung der geänderten Dateien

| Datei | Änderungen |
|---|---|
| `src/components/event-planning/useEventPlanningData.ts` | Titel-Sync mit Appointments |
| `src/components/appointment-preparations/AppointmentPreparationDataTab.tsx` | Punkte 2-6: Card-Reihenfolge, Autocomplete, Avatar-Hover, Q&A-Paare, Topic-Items |
| `src/hooks/useAppointmentPreparation.tsx` | Typen erweitern: `contact_id`, `qa_pairs`, `key_topic_items`, `talking_point_items` |
| `src/pages/AppointmentPreparationDetail.tsx` | PDF-Button im Briefing-Tab |
| `src/components/appointment-preparations/AppointmentBriefingView.tsx` | Q&A-Paare und Topic-Items rendern |
| `src/components/appointment-preparations/briefingPdfGenerator.ts` | Q&A-Paare und Topic-Items im PDF |

Keine DB-Migration nötig — alle neuen Felder leben innerhalb des bestehenden `preparation_data` JSONB-Felds.

