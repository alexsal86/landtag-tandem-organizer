# Abgeordnetenporträts

Bilder werden durch `save-deputy-portrait` direkt in dieses Repository auf `main`
geschrieben. Sie liegen nicht in Supabase Storage und nicht in der Datenbank.

Je bestätigter Mandatsverbindung (`connection_id`) entsteht ein Ordner:

```text
<connection-id>/
  portrait-<inhaltshash>.webp   # 480 × 640, höchstens 100 KiB
  thumb-<inhaltshash>.webp      # 96 × 128, höchstens 12 KiB
  portrait.json                # Dateinamen, Quelle, Urheber, Lizenz und Version
```

Die Website lädt die Dateien relativ zu ihrer eigenen Basis-URL. Bilddateien
haben Inhalts-Hashes für sichere Browser-Caches. Bildnachweise werden nur für
die angezeigten Personen geladen. Ein Bild gilt für die gesamte verbundene
Mandatshistorie, nicht nur für eine einzelne Legislaturperiode.

Bild, Vorschau und Bildnachweis werden atomar in einem GitHub-Commit gespeichert.
Nach einem Bildwechsel werden alte Dateien aus dem aktuellen Dateibaum entfernt;
in der Git-Historie bleiben sie erhalten. Lovable muss den neuen Commit wie
andere Repository-Änderungen übernehmen und veröffentlichen. Bis dahin zeigt
nur die hochladende Sitzung eine lokale Vorschau.

Die einmalige Server-Einrichtung steht in
`docs/election-analysis/deputy-portraits.md`.
