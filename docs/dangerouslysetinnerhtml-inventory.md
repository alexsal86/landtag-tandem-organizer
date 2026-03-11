# `dangerouslySetInnerHTML` Inventory

Stand: 2026-03-11

Ziel: Vollständige Inventarisierung aller `dangerouslySetInnerHTML`-Vorkommen im Frontend und Kennzeichnung des Sanitizer-Status.

## Ergebnis (21 Fundstellen)

Abfragebasis:

```bash
rg -n "dangerouslySetInnerHTML" src
```

| Datei | Zeile | Status |
|---|---:|---|
| `src/components/TwoFactorSettings.tsx` | 317 | `sanitizeRichHtml(...)` |
| `src/components/emails/EmailComposer.tsx` | 197 | `sanitizeRichHtml(...)` |
| `src/components/emails/EmailHistory.tsx` | 503 | `sanitizeRichHtml(...)` |
| `src/components/my-work/CaseItemDetailPanel.tsx` | 506 | `entry.safeNoteHtml` (vor-sanitisiert, manuell prüfen) |
| `src/components/drucksachen/ProtocolViewer.tsx` | 190 | `sanitizeRichHtml(...)` |
| `src/components/drucksachen/ProtocolRawData.tsx` | 78 | `sanitizeRichHtml(...)` |
| `src/components/administration/MermaidRenderer.tsx` | 74 | `sanitizeRichHtml(...)` |
| `src/components/ui/chart.tsx` | 79 | Inline-`<style>` aus interner Konfiguration |
| `src/components/ui/RichTextDisplay.tsx` | 37 | `sanitizeRichHtml(...)` |
| `src/components/dashboard/DashboardAppointments.tsx` | 81 | `sanitizeRichHtml(...)` |
| `src/components/shared/NoteCard.tsx` | 121 | `sanitizeRichHtml(...)` |
| `src/components/shared/NoteCard.tsx` | 132 | `sanitizeRichHtml(...)` |
| `src/components/letters/ArchivedLetterDetails.tsx` | 255 | `sanitizeRichHtml(...)` |
| `src/components/letters/LetterEditorCanvas.tsx` | 442 | `sanitizeRichHtml(...)` |
| `src/components/letters/DIN5008LetterLayout.tsx` | 605 | `sanitizeRichHtml(...)` |
| `src/components/letters/DIN5008LetterLayout.tsx` | 751 | `sanitizeRichHtml(...)` |
| `src/components/letters/DIN5008LetterLayout.tsx` | 833 | `sanitizeRichHtml(...)` |
| `src/components/letters/DIN5008LetterLayout.tsx` | 910 | `sanitizeCss(...)` |
| `src/components/letter-templates/TemplateGrid.tsx` | 50 | `sanitizeRichHtml(...)` |
| `src/components/task-decisions/DecisionAttachmentPreviewDialog.tsx` | 138 | `sanitizeRichHtml(...)` |
| `src/components/task-decisions/DecisionAttachmentPreviewDialog.tsx` | 177 | `sanitizeRichHtml(...)` |

## Regression-Absicherung

Ergänzte Tests:

- `src/utils/__tests__/htmlSanitizer.test.ts`
  - Script-Tags + Event-Handler werden entfernt.
  - `javascript:`-URLs werden entfernt.
  - Verbotene eingebettete Tags (z. B. `iframe`) werden entfernt.
  - CSS-Payloads (`expression()`, `javascript:`, `@import`) werden entschärft.

## Follow-up

- Für alle Stellen ohne direkten `sanitizeRichHtml(...)`-Aufruf (`entry.safeNoteHtml`, `chart.tsx`) sollte der Datenfluss dokumentiert bleiben.
- Bei neuen Vorkommen von `dangerouslySetInnerHTML` ist eine Einordnung in diese Liste Pflicht.
