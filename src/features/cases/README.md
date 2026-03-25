# Cases Feature

Diese Struktur bündelt alle Vorgangs-/Akte-Funktionalitäten unter einem Feature-Ordner.

## Dossier-Konzept

Ein erster Umsetzungsplan für themenzentrierte Dossiers liegt unter:

- `docs/dossier-umsetzungsplan.md`

## Struktur

- `items/`
  - `components/`: UI rund um einzelne Anliegen (z. B. MyWork-Tab für Anliegen)
  - `hooks/`: Anliegen-spezifische Hooks
  - `pages/`: Seiten auf Anliegen-Ebene (z. B. Vorgangsdetailseite)
- `files/`
  - `components/`: UI für Akten inklusive Detailansichten und Tabs
  - `hooks/`: Akten-spezifische Hooks und Typen
- `shared/`
  - `utils/`: gemeinsame Utilities für Anliegen und Akten

## Barrel-Exports

Jeder Bereich enthält `index.ts`-Dateien, damit Imports kurz und konsistent bleiben, z. B.:

- `@/features/cases/items/hooks`
- `@/features/cases/files/components`
- `@/features/cases/files/hooks`
- `@/features/cases/shared/utils`
