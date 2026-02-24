
# ✅ Abgeschlossen: Snap-Linien, Variablen-Vorschau, Template-Brief-Integration

Alle drei Punkte wurden implementiert:

## 1. Snap-Linien (Best-Match-Algorithmus) ✅
- Pro Achse wird nur der nächste Snap-Target verwendet (kleinstes Delta)
- sx/sy werden einmalig gesetzt, keine sequentielle Mutation mehr
- Guide-Position = Element-Position

## 2. Variablen-Vorschau ✅
- `variablePreviewText` in TextElement-Type
- BLOCK_VARIABLES mit realistischen Vorschautexten
- Rendering zeigt Vorschautext statt {{...}} Platzhalter
- Drop-Handler übergibt previewText automatisch

## 3. Template-Brief-Integration ✅
- `letterVariables.ts`: buildVariableMap + substituteVariables
- DIN5008LetterLayout: Canvas-Block-Rendering mit Fallback
- LetterEditor: Substitution über useMemo
- DB-Migration: 6 neue jsonb-Spalten in letter_templates
- Block-Elemente aus layout_settings.blockContent werden substituiert
