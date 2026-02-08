

# Konzept: Neue FallAkten-Detailansicht -- Drei-Spalten-Layout mit Chronologie, Kontext und Aktionsbereich

## Analyse des ChatGPT-Vorschlags

Das Bild zeigt ein Drei-Spalten-Layout fuer die FallAkten-Detailansicht:

| Bereich | Inhalt im Bild | Unsere Bewertung |
|---------|---------------|-----------------|
| **Linke Spalte** | Beteiligte (Hauptkontakt + weitere), Politischer Kontext (Thema + Ausschuss), Metadaten | Uebernehmen -- sinnvolle Kontextinformationen auf einen Blick |
| **Mitte** | Chronologie mit Filter-Tabs (Alle, Notizen, Dokumente, Termine, Aufgaben), Suchleiste, farbige Timeline-Eintraege | Uebernehmen und verbessern -- ersetzt unser aktuelles Tab-System |
| **Rechte Spalte** | Aktueller Stand (editierbare Notiz), Naechste Schritte (Checkliste), Risiken und Chancen | Uebernehmen -- diese Elemente fehlen uns komplett |

## Was wir uebernehmen

1. **Drei-Spalten-Layout** statt dem aktuellen vertikalen Aufbau (Header-Card oben, Tabs darunter)
2. **Vereinigte Chronologie** statt separater Tabs -- alle Ereignisse in einem Strom mit Filter-Tabs
3. **Aktueller Stand** -- eine editierbare, hervorgehobene Statusnotiz
4. **Naechste Schritte** -- eine Checkliste mit Zustaendigkeit direkt in der Akte
5. **Risiken und Chancen** -- strukturiertes Freitextfeld
6. **Kontakt-Schnellaktionen** -- Telefon/E-Mail/Nachricht direkt bei Kontakten
7. **Politischer Kontext** -- Themen und Ausschusszuordnung sichtbar in der Sidebar
8. **Schnell-Buttons im Header** -- "+ Notiz", "+ Aufgabe", "+ Termin", "+ Dokument" prominent oben

## Was wir anders machen

| ChatGPT-Vorschlag | Unsere Anpassung | Grund |
|-------------------|------------------|-------|
| Statisches Drei-Spalten-Layout | Responsive: 3 Spalten auf Desktop, Tabs/Accordion auf Mobil | Unsere App wird auch mobil genutzt |
| Separate "Beteiligte" und "Weitere Beteiligte" | Einheitliche Kontaktliste mit Rollen-Badges und dem bestehenden Rollen-System | Wir haben bereits CONTACT_ROLES definiert |
| Feste Kontaktaktions-Icons | Dynamische Icons basierend auf verfuegbaren Daten (Telefon nur wenn vorhanden) | Vermeidet leere Aktionen |
| Timeline nur mit manuellen Eintraegen | Automatische + manuelle Eintraege (bereits implementiert) mit verbesserter Darstellung | Automatische Eintraege sind ein Mehrwert |
| Einfache Checkliste fuer "Naechste Schritte" | Verknuepfung mit unserem bestehenden Aufgabensystem (Tasks) + Inline-Quick-Tasks | Integration statt Parallelstruktur |

## Was wir ergaenzen

| Ergaenzung | Beschreibung |
|-----------|-------------|
| **Pinned Notes als "Aktueller Stand"** | Die bestehende Notiz-Pin-Funktion wird zur "Aktueller Stand"-Karte umgebaut |
| **Quick-Add in der Timeline** | Direkt in der Timeline Notizen, Aufgaben etc. hinzufuegen ohne Dialog-Umweg |
| **Sichtbarkeits-Indikator** | Privat/Geteilt/Oeffentlich prominent im Header anzeigen |
| **Teilnehmer-Sidebar** | Die neuen case_file_participants mit Viewer/Editor-Rollen in der linken Spalte |
| **E-Mails in der Timeline** | E-Mails (Briefe) werden auch in der Timeline-Ansicht angezeigt |
| **Druckansicht / PDF-Export** | Ein "Drucken"-Button im Header-Menue fuer eine zusammengefasste Aktenansicht |

---

## Technische Umsetzung

### 1. Neues Layout: CaseFileDetail.tsx komplett umbauen

Das aktuelle `CaseFileDetail.tsx` hat:
- Eine Header-Card mit Statistiken (Zaehler fuer Kontakte, Dokumente etc.)
- Ein 7-Tab-Layout (Uebersicht, Kontakte, Dokumente, Aufgaben, Termine, Briefe, Notizen)

**Neues Layout:**

```text
+--------------------------------------------------------------------------+
| Header: Titel, Aktenzeichen, Typ-Badge, Status-Badge, Sichtbarkeit      |
| [+ Notiz] [+ Aufgabe] [+ Termin] [+ Dokument] [... Mehr]               |
+--------------------------------------------------------------------------+
|                    |                              |                       |
| LINKE SIDEBAR      | CHRONOLOGIE (MITTE)          | RECHTE SIDEBAR        |
| (280px, fixiert)   | (flex-1, scrollbar)          | (300px, fixiert)      |
|                    |                              |                       |
| Beteiligte         | Filter-Tabs:                 | Aktueller Stand       |
|  - Ersteller       |  Alle | Notizen | Dokumente  |  (editierbare Notiz)  |
|  - Kontakte        |  Termine | Aufgaben          |                       |
|    mit Rollen      |                              | Naechste Schritte     |
|  - Teilnehmer      | Suchfeld                     |  (Aufgaben-Checklist) |
|                    |                              |                       |
| Themen/Kontext     | Timeline-Eintraege           | Risiken und Chancen   |
|  - Zugewiesene     |  chronologisch sortiert      |  (strukturiertes      |
|    Themen          |  mit farbigen Typen          |   Freitextfeld)       |
|  - Ausschuss       |  und Aktionen                |                       |
|                    |                              | Metadaten             |
| Metadaten          |                              |  - Erstellt am        |
|  - Start/Ziel      |                              |  - Letzte Aenderung   |
|  - Tags            |                              |  - Zustaendig         |
+--------------------+------------------------------+-----------------------+
```

Auf Mobilgeraeten (< 1024px) wird das Layout zu einem Single-Column mit collapsible Sektionen.

### 2. Datenbank-Erweiterungen

Neue Spalten auf `case_files`:

```sql
ALTER TABLE public.case_files
  ADD COLUMN current_status_note text,           -- "Aktueller Stand" Freitext
  ADD COLUMN current_status_updated_at timestamptz,
  ADD COLUMN risks_and_opportunities jsonb DEFAULT '{"risks": [], "opportunities": []}',
  ADD COLUMN assigned_to uuid;                    -- Hauptverantwortlicher
```

Fuer "Naechste Schritte" nutzen wir das bestehende Task-System: Die verknuepften Aufgaben (`case_file_tasks`) mit Status `todo` oder `in_progress` werden automatisch als "Naechste Schritte" angezeigt. Zusaetzlich ermoeglichen wir Inline-Quick-Tasks:

```sql
-- Keine neue Tabelle noetig, wir nutzen die bestehende tasks + case_file_tasks Verknuepfung
```

### 3. Komponenten-Struktur

Neue und ueberarbeitete Dateien:

| Datei | Beschreibung |
|-------|-------------|
| `CaseFileDetail.tsx` | Komplett umbauen: Drei-Spalten-Layout |
| `CaseFileDetailHeader.tsx` (NEU) | Header mit Quick-Action-Buttons |
| `CaseFileLeftSidebar.tsx` (NEU) | Beteiligte, Themen, Metadaten |
| `CaseFileTimeline.tsx` (NEU) | Vereinigte Chronologie mit Filter-Tabs und Suche |
| `CaseFileRightSidebar.tsx` (NEU) | Aktueller Stand, Naechste Schritte, Risiken |
| `CaseFileCurrentStatus.tsx` (NEU) | Editierbare Statusnotiz-Karte |
| `CaseFileNextSteps.tsx` (NEU) | Aufgaben-Checkliste mit Quick-Add |
| `CaseFileRisksOpportunities.tsx` (NEU) | Risiken und Chancen Editor |

Die bestehenden Tab-Komponenten (`CaseFileContactsTab`, `CaseFileDocumentsTab` etc.) werden nicht geloescht, aber ihre Inhalte werden in die neuen Sidebar- und Timeline-Komponenten integriert. Die Dialoge zum Hinzufuegen bleiben erhalten.

### 4. Chronologie -- vereinigtes Timeline-System

Die bestehende `CaseFileTimelineTab` zeigt nur manuelle Timeline-Eintraege. In der neuen Version wird die Chronologie ALLE verknuepften Elemente zusammenfuehren:

```typescript
// Pseudocode fuer die vereinigte Timeline
const unifiedTimeline = [
  ...timeline.map(t => ({ ...t, category: 'timeline' })),
  ...notes.map(n => ({ 
    id: n.id, category: 'note', 
    event_date: n.created_at, title: 'Notiz', 
    description: n.content 
  })),
  ...documents.map(d => ({
    id: d.id, category: 'document',
    event_date: d.created_at, title: d.document?.title,
    description: d.document?.file_name
  })),
  ...tasks.map(t => ({
    id: t.id, category: 'task',
    event_date: t.created_at, title: t.task?.title,
    description: `Status: ${t.task?.status}`
  })),
  ...appointments.map(a => ({
    id: a.id, category: 'appointment',
    event_date: a.appointment?.start_time || a.created_at,
    title: a.appointment?.title,
    description: a.appointment?.location
  })),
  ...letters.map(l => ({
    id: l.id, category: 'letter',
    event_date: l.created_at, title: l.letter?.title,
    description: l.letter?.subject
  })),
].sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
```

Filter-Tabs ueber der Timeline:
- **Alle** -- alles anzeigen
- **Notizen** -- nur Notizen
- **Dokumente** -- nur Dokumente
- **Termine** -- nur Termine
- **Aufgaben** -- nur Aufgaben
- **Briefe** -- nur Briefe/Korrespondenz

Plus eine Suchleiste und ein "Nur offene Punkte"-Toggle.

### 5. "Aktueller Stand" -- hervorgehobene Statusnotiz

- Ein prominenter, farblich hervorgehobener Bereich in der rechten Sidebar
- Der Benutzer kann den Text inline bearbeiten (Textarea mit "Notiz bearbeiten"-Button)
- Wird in `case_files.current_status_note` gespeichert
- Zeigt Zeitstempel der letzten Aktualisierung

### 6. "Naechste Schritte" -- Aufgaben-Checkliste

- Zeigt die mit der FallAkte verknuepften offenen Aufgaben als Checkliste
- Checkbox zum Abschliessen direkt in der Liste (aendert Task-Status auf `completed`)
- Zustaendige Person und Frist werden angezeigt
- "Quick-Add"-Feld: Schnell eine neue Aufgabe erstellen, die automatisch mit der Akte verknuepft wird
- Sortierung: Ueberfaellige zuerst, dann nach Frist

### 7. "Risiken und Chancen"

- Zwei getrennte Listen (Bullet-Points) in einer Karte
- Inline-Bearbeitung: Klick auf "Bearbeiten" oeffnet jeweils ein Textarea
- Gespeichert als JSONB in `case_files.risks_and_opportunities`:
  ```json
  {
    "risks": ["Mehr Verbreitenwirkung", "Lack von Refant"],
    "opportunities": ["Anzeigen und eine Presse"]
  }
  ```

### 8. Integration mit bestehendem System

| System-Bestandteil | Integration |
|---------------------|-------------|
| **Themen (Topics)** | Werden in der linken Sidebar unter "Politischer Kontext" angezeigt, mit `TopicSelector` zum Hinzufuegen |
| **Kontakte** | Verknuepfte Kontakte mit Rollen in der linken Sidebar, mit Schnellaktionen (Telefon, E-Mail) |
| **Aufgaben** | Offene Aufgaben als "Naechste Schritte" in rechter Sidebar, alle in der Timeline |
| **Dokumente** | In der Timeline mit Download-Link, "Hinzufuegen" per Quick-Button im Header |
| **Termine** | In der Timeline mit Ort und Zeit, "Hinzufuegen" per Quick-Button |
| **Briefe** | In der Timeline mit Status-Badge |
| **Teilnehmer** | In der linken Sidebar unter "Team" mit Viewer/Editor-Rollen |
| **Sichtbarkeit** | Indikator (Icon + Text) im Header |
| **Notizen** | In der Timeline als eigener Typ, angepinnte Notizen als "Aktueller Stand" |

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| DB-Migration | Neue Spalten: `current_status_note`, `current_status_updated_at`, `risks_and_opportunities`, `assigned_to` |
| Komplett umbauen | `src/components/case-files/CaseFileDetail.tsx` |
| Neu | `src/components/case-files/CaseFileDetailHeader.tsx` |
| Neu | `src/components/case-files/CaseFileLeftSidebar.tsx` |
| Neu | `src/components/case-files/CaseFileTimeline.tsx` |
| Neu | `src/components/case-files/CaseFileRightSidebar.tsx` |
| Neu | `src/components/case-files/CaseFileCurrentStatus.tsx` |
| Neu | `src/components/case-files/CaseFileNextSteps.tsx` |
| Neu | `src/components/case-files/CaseFileRisksOpportunities.tsx` |
| Bearbeiten | `src/hooks/useCaseFileDetails.tsx` (neue Felder + updateCurrentStatus + updateRisksOpportunities) |
| Bearbeiten | `src/hooks/useCaseFiles.tsx` (CaseFile Interface erweitern) |
| Bearbeiten | `src/integrations/supabase/types.ts` (neue Spalten) |

Bestehende Tab-Dateien bleiben vorerst erhalten fuer die Add-Dialoge, werden aber nicht mehr als eigenstaendige Tabs gerendert.

## Reihenfolge

1. DB-Migration: Neue Spalten auf `case_files`
2. Types + Hook erweitern (`useCaseFileDetails`, `useCaseFiles`)
3. Neue Komponenten erstellen (Header, Left Sidebar, Right Sidebar, Timeline)
4. `CaseFileDetail.tsx` zum Drei-Spalten-Layout umbauen
5. Responsive Anpassungen fuer Mobil
6. Bestehende Add-Dialoge in das neue Layout integrieren

