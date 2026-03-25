# Verbindlicher Scope: Any-Trefferliste (Stand 2026-03-25)

## 1) Export der aktuellen Trefferliste (nach Datei sortiert)

Exportquelle:

- `npm run --silent report:any-usage:files` (Top-15-Hotspots).
- Anschließend alphabetisch nach Dateipfad sortiert und als verbindliche Arbeitsliste eingefroren.

> Scope-Freeze-Regel: Diese Liste ist bis zur vollständigen Abarbeitung der Einträge der **einzige** Refactor-/Typisierungs-Scope für die aktuelle Welle.

| Datei | Summe `any`-Treffer |
| --- | ---: |
| `src/components/administration/MeetingTemplateManager.tsx` | 11 |
| `src/components/ContactSelector.tsx` | 14 |
| `src/components/contact-import/hooks/useContactImport.ts` | 10 |
| `src/components/DocumentsView.tsx` | 8 |
| `src/components/documents/hooks/__tests__/useDocumentsData.test.ts` | 17 |
| `src/components/drucksachen/DrucksachenUpload.tsx` | 9 |
| `src/components/drucksachen/ProtocolOverview.tsx` | 10 |
| `src/components/drucksachen/ProtocolPlenaryView.tsx` | 8 |
| `src/components/event-planning/ChecklistSection.tsx` | 10 |
| `src/components/meetings/hooks/__tests__/useMeetingArchive.test.ts` | 11 |
| `src/components/my-work/MyWorkCasesWorkspace.tsx` | 10 |
| `src/components/my-work/MyWorkPlanningsTab.tsx` | 11 |
| `src/hooks/useDashboardDeadlines.ts` | 10 |
| `src/lib/radix-slot-patch.tsx` | 14 |
| `supabase/functions/matrix-bot-handler/index.ts` | 9 |

## 2) Clusterung in A / B / C

## A — schnell entfernbar (direkte Typisierung)

| Datei | Owner | ETA |
| --- | --- | --- |
| `src/components/documents/hooks/__tests__/useDocumentsData.test.ts` | Dokumente / Output | 2026-03-26 |
| `src/components/meetings/hooks/__tests__/useMeetingArchive.test.ts` | Meetings / Kollaboration | 2026-03-26 |
| `src/components/my-work/MyWorkPlanningsTab.tsx` | Frontend Produktteams | 2026-03-27 |
| `src/components/event-planning/ChecklistSection.tsx` | Frontend Produktteams | 2026-03-27 |
| `src/components/drucksachen/ProtocolPlenaryView.tsx` | Redaktion / Drucksachen | 2026-03-28 |
| `src/components/drucksachen/DrucksachenUpload.tsx` | Redaktion / Drucksachen | 2026-03-28 |

## B — braucht Shared-Typen

| Datei | Benötigter Shared-Type-Baustein | Owner | ETA |
| --- | --- | --- | --- |
| `src/components/ContactSelector.tsx` | gemeinsamer Contact-Selection-Typ (`ContactListItem`) | Frontend Plattform | 2026-03-31 |
| `src/components/contact-import/hooks/useContactImport.ts` | Import-Payload-/Mapping-Typen | Frontend Plattform | 2026-03-31 |
| `src/components/administration/MeetingTemplateManager.tsx` | `MeetingTemplate`-Domain-DTOs | Plattform / Integrationen | 2026-04-01 |
| `src/components/drucksachen/ProtocolOverview.tsx` | vereinheitlichte Protocol-View-Model-Typen | Redaktion / Drucksachen | 2026-04-01 |
| `src/hooks/useDashboardDeadlines.ts` | Shared Deadline-View-Model + Query-Result-Typen | Frontend Plattform | 2026-04-02 |
| `src/components/DocumentsView.tsx` | Shared Document-Union für Liste/Detail | Dokumente / Output | 2026-04-02 |

## C — Interop-Randfälle (mit Begründung)

| Datei | Interop-Randfall / Begründung | Owner | ETA |
| --- | --- | --- | --- |
| `src/lib/radix-slot-patch.tsx` | Radix-Slot-Patch nutzt bewusst low-level `as any` zur Kompatibilität zwischen Upstream-Slot-Props und lokalen Polymorphie-Helfern; Abbau nur mit kompatiblem Wrapper möglich. | Frontend Plattform | 2026-04-04 |
| `src/components/my-work/MyWorkCasesWorkspace.tsx` | Mehrere `as any` an DnD-/Workspace-Grenzen; Drittanbieter-Event-Payloads ohne präzise Generics. | Frontend Produktteams | 2026-04-04 |
| `supabase/functions/matrix-bot-handler/index.ts` | Externe Matrix-Event-Payloads (Webhook/SDK) sind dynamisch; braucht Runtime-Guards + schrittweise Typadaption statt direkter Ersetzung. | Plattform / Integrationen | 2026-04-07 |

## 3) Owner + ETA je Datei

Owner und ETA sind in den Tabellen A/B/C pro Datei verbindlich gesetzt. Umpriorisierung nur per explizitem Update dieses Dokuments.

## 4) Verbindlicher Scope (kein zusätzlicher Refactor)

- Keine Strukturänderungen, kein Renaming, keine Feature-Erweiterung außerhalb der oben gelisteten 15 Dateien.
- Keine zusätzlichen Dateien in PRs aufnehmen, außer:
  - reinem Shared-Typ-Container für Cluster B,
  - minimalen Runtime-Guards für Cluster C.
- Jede Scope-Erweiterung gilt als Blocker und braucht vorab Dokument-Update in diesem File.

## 5) Tägliches Fortschrittstracking gegen diese Liste

Daily-Update-Ritual (werktäglich):

1. `npm run --silent report:any-usage:files`
2. Fortschritt je Datei in der Tabelle aktualisieren (`offen`, `in Arbeit`, `erledigt`).
3. Any-Delta zum Vortag ergänzen.

| Datum | Datei | Cluster | Owner | Status | Rest-`any` | Delta zum Vortag | Hinweis |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| 2026-03-25 | alle 15 Scope-Dateien | A/B/C | siehe oben | offen | 162 | 0 | Baseline eingefroren (Top-15-Liste). |
