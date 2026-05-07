# Appointment-Preparation V2 — Workflow-Phasen + Kontakt-Gedächtnis

Ich finde den Screenshot inhaltlich sehr stark — er löst drei Schwächen unserer aktuellen Detail-Ansicht auf einmal:

1. **Linearer Tab-Aufbau** → wird zu einem **echten Workflow** mit sichtbarem Fortschritt, Blockern und „nächstem Schritt".
2. **Live-Vorschau** wird zu einem **inhaltlich verdichteten Briefing-Pane** (nicht mehr nur PDF-Spiegel), das man im Termin direkt nutzen kann.
3. **Wiederkehrende Gesprächspartner** (BWKG, Verbände, MdLs, Bürgerinitiativen …) — heute fängt man bei jedem Termin bei Null an. Das ist genau der Punkt, den du ansprichst: vieles davon gehört dauerhaft an den **Kontakt**.

Mein Vorschlag in drei Bauabschnitten — du kannst nach jedem Schritt entscheiden.

---

## Schritt 1 — Workflow-Phasen-Layout (UI-Refactor, ohne DB)

Die heutigen Tabs (Details / Daten / Checkliste / Briefing) werden zu einem **3-Spalten-Workspace**:

```text
┌──────────────────────── Header ────────────────────────┐
│ TV-2026-018  Einladung  ●In Vorbereitung               │
│ Gespräch BWKG …                       Countdown · 5 T  │
│ Datum · Ort                           Zuständig: …     │
└────────────────────────────────────────────────────────┘
┌─ Phasen ───┬────── aktive Phase ──────┬─ Live-Briefing ┐
│ ✓ Anlass   │ Phase 4 · In Arbeit      │ Wer ist im Raum│
│ ✓ Team     │ Themen · Talking · Q&A   │ Worum es geht  │
│ ● Themen   │   01 …                   │ Was wir sagen  │
│ ○ Q&A-Run  │   02 …                   │ Sensible Pkte  │
│ ○ Freigabe │                          │                │
│ ○ Nach     │ 04.2 Talking Points      │                │
│            │ 04.3 Q&A                 │                │
│ Blocker    │                          │                │
└────────────┴──────────────────────────┴────────────────┘
```

Konkrete Änderungen:

- **Linke Spalte (Phasen):** ersetzt die Tab-Leiste. Phasen werden aus der existierenden Checklist-Struktur abgeleitet (Anlass & Annahme, Team & Logistik, Fakten & Positionen, Themen/TP/Q&A, Q&A-Durchgang, Briefing-Freigabe, Nachbereitung). Status-Punkt (✓ / ● aktiv / ○ offen), Mini-Zähler („4T · 4TP · 6Q").
- **Aktive Phase (Mitte):** zeigt nur die Felder dieser Phase. Z.B. Phase „Themen, TP, Q&A" rendert die drei Sub-Sektionen (`04.1 Wichtige Themen`, `04.2 Talking Points`, `04.3 Q&A`) als nummerierte Karten — das sind unsere bestehenden Felder aus `AppointmentPreparationDataTab`, nur gruppiert und durchnummeriert.
- **Aktuelle Blocker** (linke Spalte unten): Liste der Punkte, die für „Briefing-Freigabe" noch fehlen (leere Pflichtfelder, offene Q&A, fehlende Zuständigkeit). Reine Ableitung aus den vorhandenen Feldern.
- **Header-Aktion „Phase abschließen →":** setzt aktuelle Phase auf done und springt zur nächsten. Kein neues DB-Feld nötig — wir leiten den Phasen-Status aus der Vollständigkeit der Felder ab.
- **Rechte Spalte (Live-Briefing):** ersetzt die heutige A4-Live-Vorschau durch eine **strukturierte Verdichtung** (Wer im Raum / Worum es geht / Was wir sagen / Sensible Punkte) — das ist näher dran am tatsächlichen Nutzen im Termin als ein verkleinertes PDF. Das PDF bleibt als „Briefing-PDF"-Button im Header.

Bewusst weggelassen aus dem Screenshot (entsprechend deiner Vorgabe aus früheren Schritten): **keine Reife-Bar, keine Mini-IDs** wie `D-038` als Pflichtanzeige.

**Datei-Plan:**
- Neu: `src/components/appointment-preparations/workflow/PhaseSidebar.tsx`
- Neu: `src/components/appointment-preparations/workflow/PhaseContent.tsx` (rendert Sub-Sektionen je Phase)
- Neu: `src/components/appointment-preparations/workflow/LiveBriefingPane.tsx` (ersetzt aktuelle Live-Vorschau)
- Neu: `src/components/appointment-preparations/workflow/usePhaseStatus.ts` (Ableitung Status + Blocker)
- Refactor: `src/pages/AppointmentPreparationDetail.tsx` — Tabs raus, 3-Spalten-Layout rein. Bestehende Tab-Komponenten werden in PhaseContent als Phasen-Inhalte wiederverwendet (kein Datenverlust).

---

## Schritt 2 — Kontakt-Gedächtnis (Persistenz an `contacts`)

Dein Punkt ist genau richtig: bei BWKG, einem MdL, einer Verbandsspitze wiederholt sich vieles. Wir bauen ein **„Briefing-Gedächtnis" pro Kontakt**.

**Welche Felder werden persistent am Kontakt?** (kuratiert, nicht alles aus dem Briefing)

| Feld am Kontakt                | Quelle aus Preparation           |
| ------------------------------ | -------------------------------- |
| Rolle/Funktion                 | „Wer ist im Raum"                |
| Dauerhafte Positionen          | „Fakten & Positionen"            |
| Standard-Talking-Points        | „Talking Points" (markierte)     |
| Sensible Punkte / Red Flags    | „Sensible Punkte"                |
| Häufige Fragen & Antworten     | „Q&A" (markierte)                |
| Letzter Kontakt / Historie     | automatisch (Termin-Verknüpfung) |

**UX-Flow:**
- An jedem TP / Q&A / Sensiblen Punkt ein kleines Pin-Icon → „Für {Kontakt} merken".
- Beim Anlegen einer neuen Preparation mit demselben Gesprächspartner werden die gemerkten Punkte als **Vorschläge** oben in der jeweiligen Sektion eingeblendet („Aus früheren Gesprächen mit BWKG · 4 Punkte · alle übernehmen / einzeln").
- Im Kontakt-Detail neuer Tab **„Briefing-Gedächtnis"** mit denselben Sektionen — dort editier-/löschbar.

**Wichtig:** Vorschläge werden *kopiert*, nicht referenziert — die Preparation bleibt auch dann vollständig, wenn der Kontakt-Eintrag später geändert wird.

**Datenbank (eine neue Tabelle):**

`contact_briefing_memory`
- `contact_id` (FK contacts)
- `kind` enum: `position` | `talking_point` | `qa` | `sensitive` | `role_note`
- `content` text (bei `qa`: jsonb mit `question` / `answer`)
- `source_preparation_id` (FK, nullable — Herkunfts-Termin)
- `pinned_by` (profile)
- `tenant_id`, Standard-Audit-Felder

RLS analog zu `contacts` (Tenant-Filter, abgeleitet vom verknüpften Kontakt).

---

## Schritt 3 — „Wer ist im Raum" als verknüpfte Kontakte

Heute ist die Teilnehmerliste Freitext. Wenn wir sie an `contacts` koppeln, wird Schritt 2 erst richtig wertvoll: man sieht beim Anlegen sofort „BWKG-Geschäftsführung · 3 frühere Gespräche · 4 gemerkte Punkte".

- Teilnehmer-Sektion bekommt Combobox auf `contacts` (mehrfach), Freitext bleibt als Fallback.
- An jedem verknüpften Teilnehmer Direktsprung in den Kontakt + Anzeige der gemerkten Punkte inline.

---

## Empfehlung zur Reihenfolge

1. **Schritt 1 jetzt** — reines UI-Refactor, sofort spürbarer Mehrwert, kein DB-Risiko.
2. **Schritt 3 vor Schritt 2** — erst Teilnehmer sauber an Kontakte hängen, sonst hat das Gedächtnis aus Schritt 2 keine zuverlässige Ankerstelle.
3. **Schritt 2 zum Schluss** — eigene Tabelle + UI im Kontakt-Detail.

Sag mir bitte: **Soll ich mit Schritt 1 (Workflow-Layout) starten?** Oder willst du vorher noch am Phasen-Zuschnitt feilen (z.B. weniger/andere Phasen als im Screenshot)?
