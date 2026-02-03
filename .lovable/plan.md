# Plan: Notizen und Entscheidungen - Bugfixes und Features

## Status: ✅ Implementiert

### Erledigte Fixes

| # | Problem | Status |
|---|---------|--------|
| 1 | GlobalQuickNoteDialog tenant_id Fehler | ✅ tenant_id entfernt |
| 2a | Card-Hintergrund auch bei nur Rand | ✅ backgroundColor nur bei color_full_card === true |
| 2b | Globale Shares ohne color_full_card | ✅ SELECT erweitert |
| 2c | Farbe bei Shared Notes nicht änderbar | ✅ can_edit Berechtigung hinzugefügt |
| 2d | Checkbox-Fehler | ✅ onPointerDown stopPropagation + bedingtes Rendern |

### Änderungen im Detail

**GlobalQuickNoteDialog.tsx:**
- `useTenant` Hook entfernt (nicht benötigt)
- `tenant_id` aus Insert entfernt (Spalte existiert nicht in quick_notes)
- Vereinfachte Speicherlogik

**QuickNotesList.tsx:**
- Card-Hintergrund: `backgroundColor` nur bei `color_full_card === true`, sonst `undefined`
- Globale Shares SELECT: `color_full_card`, `decision_id`, `*_archived_info` Felder hinzugefügt
- `handleSetColor` und `handleSetColorMode`: Berechtigung über `can_edit` prüfen
- Farbmenü: Nur anzeigen wenn eigene Notiz ODER `can_edit === true`
- Checkbox: `onPointerDown` stopPropagation hinzugefügt

### Offene Punkte (bereits implementiert, prüfen)

- **NoteDecisionCreator Features**: Öffentlich-Checkbox, TopicSelector und DecisionFileUpload sind im Code vorhanden
- Bei Sichtbarkeitsproblemen: Browser-Cache leeren (Cmd+Shift+R)

### Weitere Features (bereits implementiert)

- **TruncatedDescription** in DecisionOverview (250 Zeichen Limit)
- **Aufgabe aus Entscheidung erstellen** Button für Ersteller bei abgeschlossenen Entscheidungen
