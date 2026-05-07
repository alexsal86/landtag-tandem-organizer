## Was ist noch offen?

Aus den letzten Aufträgen ist alles geliefert (Workflow-Workspace, Contact-Memory, Templates, Sharing, Linked Items, Debrief, AI-Suggestions, Stepper, Autosave, Shortcuts, Focus Mode). **Aber:** der Sub-Tab `AppointmentPreparationDataTab` rendert **immer alle Felder** (Anlass, Partner, Begleiter, Logistik, Öffentlichkeit, Programm, Topics/TP/Q&A) — egal in welcher Phase. Dadurch siehst du in „Anlass" auch Logistik, in „Themen" auch Öffentlichkeitsarbeit usw. Das ist das, was du als „nicht passend" wahrnimmst.

## Ziel

Jede Phase zeigt **nur die Felder, die fachlich zu dieser Phase gehören**. Die Daten bleiben unverändert (alles weiterhin in `preparation_data`), nur die Sichtbarkeit der Sektionen wird gesteuert.

## Soll-Zuordnung Phase → Sektionen

| Phase | Sektionen |
|---|---|
| **1 Anlass & Annahme** | Anlass-Chips + Freifeld · Vorlagen-Panel |
| **2 Team & Logistik** | Gesprächspartner · Begleitpersonen · Logistik (Fahrtzeit/Parken/Folgetermin) · Programm · Sharing-Panel |
| **3 Fakten & Positionen** | Fakten/Themen-Items (`key_topic_items`) · Briefing-Gedächtnis · Linked Items · AI-Suggestions (Modus „Fakten") |
| **4 Themen, TP & Q&A** | Talking Points · Q&A · Briefing-Gedächtnis · AI-Suggestions (Modus „TP/Q&A") |
| **5 Q&A-Durchgang** | Checkliste (unverändert) |
| **6 Briefing-Freigabe** | Status, Notizen, Öffentlichkeitsarbeit (Social/Presse-Switches), Briefing-Notizen (unverändert) |
| **7 Nachbereitung** | Debrief-Panel · Dokumente (unverändert) |

Begründung Verschiebungen:
- **Programm** gehört zu „Team & Logistik" (zeitlicher Ablauf vor Ort), nicht zu „Themen".
- **Öffentlichkeitsarbeit** (Social/Presse-Switches) gehört zur **Freigabe** — das wird typischerweise erst entschieden, wenn das Briefing steht.
- **Fakten ≠ Talking Points**: aktuell teilen sich beide den `PreparationDataCards`-Block. Wir teilen die Anzeige auf: Phase 3 zeigt nur Topic-Items, Phase 4 zeigt TP + Q&A.

## Technische Umsetzung

1. **`AppointmentPreparationDataTab` Prop `visibleSections`** hinzufügen (`Set<SectionKey>`). Default = alle (Rückwärtskompatibel für `AppointmentBriefingView`).
2. Jede Sektion (Anlass-Card, ConversationPartnersCard, CompanionsCard, Logistik-Card, Öffentlichkeit-Card, ProgramCard, PreparationDataCards) wird mit `visibleSections.has('xxx') && …` gewrappt.
3. **`PreparationDataCards`** bekommt zusätzlich `showFacts` / `showTalkingPoints` / `showQa` — damit Phase 3 nur Fakten und Phase 4 nur TP+Q&A sieht.
4. **`PhaseContent.tsx`** ruft `AppointmentPreparationDataTab` mit phasenspezifischem `visibleSections` auf. Außerdem:
   - `freigabe`-Phase rendert künftig zusätzlich die Öffentlichkeitsarbeit-Card (über `AppointmentPreparationDetailsTab` oder per neuem schmalen Wrapper).
   - `team`-Phase: `SharingPanel` bleibt; Logistik+Programm sichtbar.
5. **`usePhaseStatus.ts`**: Done-Logik leicht justieren — `team` zählt zusätzlich `program.length`/`travel_time` als „done"-Signal nicht erforderlich, aber `freigabe` sollte zusätzlich `social_media_planned`/`press_planned` als gesetzt erkennen (kein Blocker, nur Anzeige).
6. **Kleinkosmetik**: Phasen-Lead-Texte in `PHASE_TITLES` an die neue Inhaltszusammenstellung anpassen (z.B. „Team, Logistik & Ablauf").

## Out of scope

- Keine DB-Änderung, keine neuen Felder.
- `AppointmentBriefingView` (Read-only-Briefing) bleibt vollständig — sie nutzt nicht den DataTab.
- PDF/Letter-Export und Briefing-Dashboard bleiben wie vereinbart raus.

## Risiko

Gering. Reine Sichtbarkeitssteuerung mit Default-Fallback. Bestehende Daten bleiben erhalten und sind in jeder Phase zugänglich, in der die jeweilige Sektion gerendert wird.
