# Security Assessment (Kurz-Audit)

Stand: 2026-02-28

## Positive observations

- Mehrere sicherheitskritische Edge Functions prüfen den aufrufenden Nutzer explizit und erzwingen Rollen/Permissions (z. B. MFA-Reset mit Admin-Check). 
- Für einige Funktionen ist `verify_jwt = true` bereits gesetzt.

## Wichtigste Risiken (priorisiert)

### 1) Edge Functions mit Service-Role ohne ausreichende Autorisierung

Mehrere Funktionen arbeiten mit `SUPABASE_SERVICE_ROLE_KEY` (voller DB-Bypass), aber prüfen den Aufrufer nicht ausreichend in der Funktion selbst. Wenn diese Endpunkte erreichbar sind, entsteht hohes Missbrauchspotenzial (Datenmanipulation, Massenaktionen, Versandaktionen).

**Beispiel:** `force-resync-calendar`
- nutzt Service Role
- nimmt Eingaben direkt aus Request Body
- enthält keinen Nutzer-/Rollencheck
- gibt bei Fehlern Stacktraces zurück

**Empfehlungen:**
- Für alle Service-Role-Funktionen einheitlich einen Guard einbauen (JWT-Validierung + Rollenprüfung, z. B. `is_admin` / tenant-scoped checks).
- Für rein interne Jobs stattdessen nur signierte Cron/Webhook-Secrets akzeptieren und keine Browser-CORS-Freigabe.
- Fehlerantworten härten: keine `stack`-Felder an Clients zurückgeben.

### 2) Zu breite CORS-Freigaben (`Access-Control-Allow-Origin: *`)

Viele Funktionen erlauben `*` als Origin. Das ist bei sensitiven Operationen unnötig riskant und erleichtert Missbrauchsszenarien aus fremden Frontends.

**Empfehlungen:**
- Allowlist pro Umgebung (prod/staging/local) einführen.
- Für interne Worker-/Cron-Endpunkte CORS ganz entfernen oder strikt begrenzen.

### 3) Inkonsistenz bei `verify_jwt`

In `supabase/config.toml` sind mehrere Funktionen mit `verify_jwt = false` konfiguriert. Ein Teil mag beabsichtigt sein (Scheduler/Webhooks), aber aktuell ist das schwer unterscheidbar und erhöht Fehlkonfigurationsrisiko.

**Empfehlungen:**
- Inventar führen: Funktionstypen `public`, `authenticated`, `internal-cron`, `internal-webhook`.
- Default-Prinzip: `verify_jwt = true`, Ausnahme nur dokumentiert mit zweitem Schutz (shared secret, signature verification, allowlisted source).

### 4) XSS-Risiko durch `dangerouslySetInnerHTML` + Regex-Sanitizer

Im Frontend werden HTML-Inhalte an mehreren Stellen per `dangerouslySetInnerHTML` gerendert. Es existiert teils nur ein einfacher Regex-Sanitizer; dieser ist erfahrungsgemäß nicht ausreichend gegen moderne XSS-Payloads.

**Empfehlungen:**
- Zentral auf robusten Sanitizer umstellen (z. B. DOMPurify mit strikter Allowlist).
- Trusted-HTML-Konzept: nur serverseitig/validiert erzeugte Inhalte rendern.
- Security-Tests mit bekannten XSS-Testpayloads ergänzen.

### 5) Fehlende/zu schwache Browser-Sicherheitsheader in der App-Auslieferung

In `index.html` ist aktuell keine CSP sichtbar. Das erhöht das Schadenspotenzial bei XSS.

**Empfehlungen:**
- Strikte Content-Security-Policy einführen (zunächst report-only, dann enforce).
- Zusätzlich `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` zentral setzen (über Reverse Proxy/Hosting).

## 30-Tage-Hardening-Plan (konkret)

1. **Woche 1**: Vollständige Liste aller Edge Functions + Klassifikation + gewünschtes Auth-Modell dokumentieren.
2. **Woche 1–2**: Shared Auth-Guard Utility für Edge Functions implementieren und in alle Service-Role-Funktionen integrieren.
3. **Woche 2**: CORS-Policy zentralisieren (Origin-Allowlist via ENV).
4. **Woche 2–3**: Fehlerbehandlung vereinheitlichen (`safeErrorResponse`) ohne interne Details.
5. **Woche 3**: DOMPurify einführen und alle `dangerouslySetInnerHTML`-Stellen migrieren.
6. **Woche 4**: CSP report-only deployen, Reports auswerten, dann enforce.
7. **Laufend**: Dependency- und Secret-Scanning in CI aktivieren (`npm audit`/SCA + gitleaks/trufflehog + semgrep/codeql).

## Schnelle Wins (heute umsetzbar)

- `force-resync-calendar`: Auth + Rollencheck + Entfernen von `stack` in Responses.
- `send-document-email`: zusätzliche Rollen-/Tenant-Prüfung serverseitig erzwingen (nicht nur über `verify_jwt`).
- `Access-Control-Allow-Origin: *` für interne Funktionen entfernen.

