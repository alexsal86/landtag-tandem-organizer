## Ziel
Alle für Endnutzer (Empfänger von Mails/Kalendereinladungen, eingeloggte User, Besucher der veröffentlichten Seite, GitHub-Besucher) sichtbaren Hinweise auf „Lovable" entfernen. Interne, technisch notwendige Referenzen (Build-Tooling, Preview-Workarounds, AI-Gateway-URL) bleiben unangetastet.

## Sichtbar nach außen → wird entfernt/ersetzt

### 1. Versendete Kalendereinladungen (.ics) – höchste Priorität
Empfänger sehen das in ihrem Mail-/Kalenderprogramm.
- `supabase/functions/generate-calendar-invite/generate-calendar-invite.utils.ts`
  - `PRODID:-//Lovable//Appointment Scheduler//DE` → `PRODID:-//LandtagsOS//Appointment Scheduler//DE`
  - Message-ID-Domain `@lovable.app` → `@landtagsos.app`
- `supabase/functions/send-appointment-invitation/index.ts` – gleiche zwei Stellen.

### 2. Matrix-Chat Device-Name
Wird anderen Matrix-Nutzern und im Sicherheits-Login-Verlauf angezeigt.
- `src/components/chat/MatrixLoginForm.tsx`: `initial_device_display_name: 'Lovable App'` → `'LandtagsOS'`.

### 3. UI-Texte im Chat-Fehlerdialog
Endnutzer sehen Text mit „Lovable läuft hier im eingebetteten Preview-iframe..." und „Lovable-Host im Top-Level-Tab erkannt".
- `src/components/chat/MatrixChatView.tsx`:
  - Texte umformulieren in neutrale Diagnose („Eingebettetes Preview-iframe erkannt..."), ohne Markennennung.
  - Variable `isLovableHost` → `isPreviewHost` (Logik bleibt, nur Bezeichnung neutral).

### 4. README.md
Öffentlich auf GitHub.
- Lovable-Projekt-Link entfernen.
- Hinweis „Alternativ direkt in Lovable entwickeln..." streichen.
- „Via Lovable: Share → Publish" und Custom-Domain-Verweis auf Lovable Docs entfernen oder durch generische Deployment-Notiz ersetzen.

### 5. Lovable-Badge auf Published-Site
Separater Schritt nach Code-Refactoring: über Publish-Settings den „Edit with Lovable"-Badge ausblenden (benötigt Pro-Plan; falls nicht verfügbar, gebe ich Bescheid).

## Bleibt drin (technisch erforderlich, nicht endnutzersichtbar)

| Stelle | Grund |
|---|---|
| `vite.config.ts` CSP `frame-ancestors *.lovable.app/...` | Damit die Preview im Lovable-Editor weiter lädt. Endnutzer sehen das nicht. |
| `vite.config.ts` auskommentierter `lovable-tagger`-Import | Dev-only, bereits inaktiv. |
| `package.json` Dev-Dependency `lovable-tagger` | Build-Tooling, kein Output. |
| `public/coi-serviceworker.js` + `src/lib/coiRuntime.ts` + `src/main.tsx` Kommentar | Preview-Workaround. Hostname-Check `lovable.app/lovableproject.com` wird beibehalten, aber Funktionsname `isLovablePreviewHost` → `isEmbeddedPreviewHost`, Kommentare neutralisiert. |
| `supabase/functions/_shared/security.ts` Allowlist `*.lovableproject.com / *.lovable.app` | CORS-Whitelist für Preview-Domains, serverseitig, nicht sichtbar. |
| `supabase/functions/_shared/aiClient.ts` + README + `generate-preparation-suggestions/index.ts` | Funktional: Lovable AI Gateway ist tatsächlich der aktive Provider. Wer das in Logs sieht, ist Admin, nicht Endnutzer. |

Die letzten drei Punkte können auf Wunsch zusätzlich umbenannt werden – nur sag Bescheid.

## Hinweis zu zukünftigem Drift
Solange das Projekt im Lovable-Editor weiterentwickelt wird, kann es passieren, dass neue Stellen wieder „Lovable"-Strings einschleusen (z. B. Default-Templates in Edge-Functions). Falls gewünscht, kann ich später einen einfachen Lint-Check (CI-Skript) ergänzen, der jeden PR auf neue `lovable`-Vorkommen außerhalb der Allowlist prüft.
