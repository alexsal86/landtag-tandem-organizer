

## Fix: Dokumente-Unterseite lädt nicht

### Ursache

In `src/components/DocumentsView.tsx` existiert die Funktion `saveArchiveSettings` **doppelt** und die erste Variante wird nicht korrekt geschlossen:

```text
Zeile 268  const saveArchiveSettings = async () => {   ← neue tenantweite Variante
   …
Zeile 295    setShowArchiveSettings(false);            ← hier fehlt das schließende };
Zeile 296  const saveArchiveSettings = () => { … };    ← alte Legacy-Variante, Re-Deklaration
```

Folgen:
- TypeScript/Vite-Build-Fehler („Cannot redeclare block-scoped variable 'saveArchiveSettings'" + fehlendes `}`).
- Der per `lazyWithRetry` geladene Chunk schlägt beim Parse fehl, `lazyWithRetry` reloadet einmal und gibt dann auf → die Route `/documents` zeigt nichts an.

### Geplante Änderung

Eine einzige, saubere `saveArchiveSettings`-Implementierung behalten – die neue, **tenantweite** Variante (sie persistiert in `app_settings` und fällt korrekt auf localStorage zurück). Die alte Zeile 296 wird vollständig entfernt; der Funktionsblock von Zeile 268 wird mit `};` korrekt abgeschlossen.

Konkret in `src/components/DocumentsView.tsx`:

- Zeilen 268–296 ersetzen durch **eine** Funktion `saveArchiveSettings` (async, tenantweit, mit Toast-Feedback und korrektem `};`).
- `getLetterActionLabel` (ab Zeile 297) bleibt unverändert.

Keine weiteren Dateien betroffen. Keine DB-Migration nötig (`app_settings` mit Schlüssel `letters_auto_archive_days` wird bereits im Lade-Effekt verwendet).

### Verifikation nach Fix

- `/documents` lädt wieder, alle vier Tabs (Dokumente, Briefe, E-Mails, Presse) erscheinen.
- Archiv-Einstellungen-Dialog speichert tenantweit; bei fehlendem Tenant nur lokal – wie im Lade-Effekt erwartet.

