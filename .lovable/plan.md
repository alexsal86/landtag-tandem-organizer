

## Konzept: Einheitlicher Informationsraum — Wissen + Dossier verschmelzen

### Problemanalyse

**Ist-Zustand:**
- **Wissen (Knowledge):** Artikel-basiert, kuratiert, Rich-Text-Editor, Themen-Zuordnung. Gut für fertige Inhalte, aber kein schneller Einwurf möglich.
- **Dossier:** Aktuell nur eine gefilterte Ansicht der Fallakten (`CaseFilesView mode="dossiers"`). Nutzt dieselbe Struktur, dasselbe UI, dasselbe Datenmodell. Zu nah an der Fallakte.

**Soll-Zustand:**
Ein einheitlicher Bereich, der zwei Phasen unterstützt:
1. **Schnell erfassen** — Roh-Informationen aus beliebigen Quellen reinwerfen (Notiz, Datei, Link, E-Mail-Import)
2. **Später kuratieren** — Strukturieren, verschlagworten, verknüpfen, aufbereiten

### Architektur-Vorschlag

```text
┌─────────────────────────────────────────────┐
│              WISSENSBEREICH                  │
│  (ersetzt sowohl "Wissen" als auch "Dossier")│
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐    ┌────────────────────┐  │
│  │  EINGANG     │    │   DOSSIERS         │  │
│  │  (Inbox)     │───>│   (thematische     │  │
│  │              │    │    Sammlungen)      │  │
│  │ Schnellnot.  │    │                    │  │
│  │ Datei-Drop   │    │  Notizen           │  │
│  │ Link einfüg. │    │  Dokumente/Dateien │  │
│  │ E-Mail paste │    │  Links/Quellen     │  │
│  │              │    │  Verknüpfungen     │  │
│  └─────────────┘    │  (Kontakte, Aufg.)  │  │
│                      └────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  ARTIKEL (kuratiert)                  │   │
│  │  = bisherige Wissens-Dokumente        │   │
│  │  Rich-Text, versioniert, publizierbar │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Neues Datenmodell

**Neue Tabelle: `dossiers`** (eigenständig, NICHT auf case_files basierend)

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid | PK |
| title | text | Dossier-Titel |
| summary | text | Kurzbeschreibung |
| status | text | beobachten, aktiv, ruhend, archiviert |
| priority | text | hoch, mittel, niedrig |
| owner_id | uuid | Verantwortliche Person (→ profiles) |
| topic_id | uuid | Themen-Zuordnung (optional) |
| tenant_id | uuid | Mandant |
| created_by | uuid | Ersteller (→ profiles) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Neue Tabelle: `dossier_entries`** (der zentrale Baustein)

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid | PK |
| dossier_id | uuid | FK → dossiers (nullable für Eingangskorb) |
| entry_type | text | notiz, datei, link, email, zitat |
| title | text | Kurztitel |
| content | text | Freitext/HTML |
| source_url | text | Link/Quelle |
| file_path | text | Storage-Pfad (für Uploads) |
| file_name | text | Dateiname |
| metadata | jsonb | E-Mail-Header, Extraktionsdaten etc. |
| is_curated | boolean | false = roh, true = aufbereitet |
| created_by | uuid | |
| tenant_id | uuid | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Verknüpfungstabelle: `dossier_links`**

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid | PK |
| dossier_id | uuid | FK → dossiers |
| linked_type | text | contact, task, appointment, case_file, document |
| linked_id | uuid | ID des verknüpften Objekts |

### UX-Konzept

**Navigation:** Ein Bereich "Wissen" mit drei Unter-Tabs:
- **Eingang** — Alle Einträge ohne Dossier-Zuordnung (dossier_id IS NULL). Schnellerfassung prominent.
- **Dossiers** — Thematische Sammlungen. Klick öffnet Detail mit allen Einträgen, Verknüpfungen, Quellen.
- **Artikel** — Bisherige Knowledge-Dokumente (kuratiert, publizierbar).

**Schnellerfassung (Eingang + direkt in Dossier):**
- Textarea + Drag-and-Drop-Zone + Link-Eingabe
- Paste von E-Mails (bestehende Outlook-Integration nutzen)
- Optional: Dossier direkt auswählen oder "Eingang" lassen
- Minimaler Aufwand: Titel wird aus Inhalt/Dateiname auto-generiert

**Dossier-Detail:**
- Übersicht (Titel, Status, Verantwortliche, Zusammenfassung)
- Chronologische Einträge (Notizen, Dateien, Links, E-Mails)
- Verknüpfungen (Kontakte, Aufgaben, Termine, Fallakten)
- Filter nach Eintragstyp und Kurationsstatus

### Umsetzungsplan (3 Phasen)

**Phase 1 — Fundament (dieser Sprint)**
- DB-Migration: `dossiers`, `dossier_entries`, `dossier_links` + RLS
- Dossier-Liste + Erstellen/Bearbeiten
- Schnellerfassung (Notiz + Datei-Upload) im Eingangskorb
- Bestehende Wissen-Artikel bleiben parallel bestehen

**Phase 2 — Zusammenführung**
- Dossier-Detailansicht mit allen Eintragstypen
- Verknüpfungen zu Kontakten, Aufgaben, Terminen
- E-Mail-Import in Dossier (bestehende EML-Parser nutzen)
- Drag-and-Drop von Eingang → Dossier
- Navigation vereinheitlichen (alter "Dossiers"-Link unter Fallakten entfernen)

**Phase 3 — Migration + Polish**
- Bestehende Knowledge-Dokumente als Artikel-Typ in neues System überführen
- Alten Knowledge-Bereich als Tab "Artikel" integrieren
- Link-Previews, Volltext-Suche über Einträge
- "Stale Content"-Hinweise, Review-Zyklen

### Technische Details

- `dossier_entries` mit `dossier_id = NULL` bilden den Eingangskorb
- Bestehende `knowledge_documents` bleiben zunächst erhalten und werden in Phase 3 migriert
- `CaseFilesView mode="dossiers"` wird in Phase 2 durch die neue Dossier-Ansicht ersetzt
- Storage nutzt den bestehenden `documents`-Bucket
- RLS: tenant-basiert, analog zu Fallakten
- Build-Fehler (CalendarSyncDebug, ContactSelector etc.) sind vorbestehend und werden separat behoben

### Dateien (Phase 1)

| Datei | Aktion |
|-------|--------|
| `supabase/migrations/xxx.sql` | Neue Tabellen + RLS |
| `src/features/dossiers/` | Neues Feature-Verzeichnis (hooks, types, components) |
| `src/components/DossiersView.tsx` | Neue Hauptansicht mit Tabs (Eingang/Dossiers/Artikel) |
| `src/components/Navigation.tsx` | Dossier-Link von Fallakten-Gruppe lösen, in Wissen integrieren |
| `src/pages/Index.tsx` | Neue Route für vereinheitlichten Wissensbereich |

