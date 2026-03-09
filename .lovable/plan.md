

## "Tandem" aus dem Projekt entfernen

Der Begriff "Tandem" kommt in 7 Dateien vor. Ich ersetze ihn durchgehend durch einen neutralen Namen.

### Änderungen

| Datei | Alt | Neu |
|-------|-----|-----|
| `index.html` | "Landtag Tandem Organizer" (title, meta, og:title) | "LandtagsOS" |
| `index.html` | "Planungstool für Tandem-Organisation..." | "Digitale Arbeitsplattform für politische Büros" |
| `package.json` | `"landtag-tandem-organizer"` | `"landtagsos"` |
| `package-lock.json` | `"landtag-tandem-organizer"` | `"landtagsos"` |
| `frontend/index.html` | "Landtag Tandem – Parser Viewer" | "LandtagsOS – Parser Viewer" |
| `supabase/functions/import-karlsruhe-districts/index.ts` | GitHub-URL mit `landtag-tandem-organizer` | Aktualisierte URL ohne "tandem" |
| `docs/matrix-chatbot-integration.md` | "Landtag-Tandem-Organizer" | "LandtagsOS" |
| `COLLABORATION_FIXES.md` | "Landtag Tandem Organizer" | "LandtagsOS" |

Der App-Name "LandtagsOS" wird bereits als Default in `appSettings` verwendet — diese Änderung macht alles konsistent.

