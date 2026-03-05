# 2‑Wochen‑Umsetzungsplan: Stabilisierung & Sicherheitsfundament

## Zielbild

In 10 Arbeitstagen werden die größten operativen Risiken reduziert und gleichzeitig die Entwicklungsgeschwindigkeit für Folgefeatures erhöht:

1. **Edge-Function-Hardening** (Auth, Rollen, CORS, sichere Fehlerantworten)
2. **Multi-Tenant-Konsistenz im Kontaktmodul**
3. **Zentrale Kontaktvalidierung + Qualitäts-Gates in CI**

---

## Annahmen für die Schätzung

- 1 Arbeitstag = 6 produktive Engineering-Stunden (abzüglich Abstimmungen).
- Teamzuschnitt: 1 Full-Stack-Engineer + punktuell 1 Reviewer.
- Zeitangaben sind **Netto-Engineering-Aufwand** (ohne Wartezeit auf externe Freigaben).

Gesamtschätzung: **56–68 Stunden**.

---

## Deliverables nach 2 Wochen

- Einheitliches Security-Guard-Pattern für priorisierte Edge Functions (inkl. Rollen-/Tenant-Checks).
- CORS-Policy-Standard und sanitizte Fehlerantworten ohne Stack-Leaks.
- Kontaktabfragen mit durchgängiger Tenant-Filterung in den kritischen Flows.
- Zentrales Kontakt-Validierungsmodul (Create/Edit nutzen dieselbe Domänenlogik).
- CI-Qualitätsgates: Lint blockierend + erste TS-Härtungsstufe im geänderten Scope.

---

## Sprint-Backlog mit Aufwand (Stunden) und Reihenfolge

## Woche 1 — Risikoabbau mit Sofortwirkung

### A) Edge-Functions inventarisieren und klassifizieren (4–6 h)

**Aufgaben**

- Alle Functions erfassen und je Endpunkt klassifizieren: `public`, `authenticated`, `internal-cron`, `internal-webhook`.
- Für jede Function gewünschtes Auth-Modell dokumentieren (`verify_jwt`, secret, tenant-scope).

**Output**

- Audit-Tabelle mit Soll-/Ist-Status und Risikoklasse.

**Abhängigkeit**

- Keine (Startpunkt).

### B) Shared Auth Guard + Safe Error Response (8–10 h)

**Aufgaben**

- Gemeinsame Utility(s) für:
  - JWT-Validierung
  - Rollenprüfung (z. B. Admin/Staff)
  - tenant-scope check
  - standardisierte, nicht-sensitive Fehlerantwort
- Referenz-Implementierung in 1–2 kritischen Functions.

**Output**

- Wiederverwendbares Sicherheitsmuster inkl. Beispielintegration.

**Abhängigkeit**

- A (Klassifikation entscheidet, wo Guard Pflicht ist).

### C) Quick Wins auf priorisierten Risk-Endpunkten (8–12 h)

**Aufgaben**

- Kritische Service-Role-Functions auf neuen Guard umstellen.
- Stacktraces aus Client-Responses entfernen.
- Interne Endpunkte CORS-seitig verengen (kein `*` bei sensitivem Scope).

**Output**

- Sofort risikoreduzierte Endpunkte mit konsistentem Verhalten.

**Abhängigkeit**

- B.

### D) Kontaktmodul: Tenant-Filter für kritische Reads (6–8 h)

**Aufgaben**

- Organisationen-Lookups und Dublettencheck-Queries durchgehend tenant-scopen.
- Defensive Prüfung: keine kontaktbezogene Read-Query ohne Tenant-Kontext.

**Output**

- Reduzierte Cross-Tenant-Risiken und konsistente Vorschlagslisten.

**Abhängigkeit**

- Keine harte, parallel zu B/C möglich.

---

## Woche 2 — Konsistenz & Entwicklungsbeschleunigung

### E) Zentrales Kontakt-Domainmodul für Validierung (8–10 h)

**Aufgaben**

- `validateContactCore(input)`
- `hasAtLeastOneChannel({ email, phone })`
- `normalizeContactBeforeSave(input)`
- Create/Edit auf gemeinsame Domänenfunktionen umstellen.

**Output**

- Eine fachliche Quelle für Kontaktregeln (weniger Drift, besser testbar).

**Abhängigkeit**

- D sinnvoll, aber nicht zwingend.

### F) Kontakt-Repository-Grundstruktur (6–8 h)

**Aufgaben**

- Erste Repository-Methoden für häufige Kontakt-Reads/Writes aufsetzen.
- UI/Hooks nutzen diese Methoden statt direkter Query-Streuung.

**Output**

- Zentralisierte Datenzugriffe mit sauberem Tenant-Handling.

**Abhängigkeit**

- D (Tenant-Regeln), E (Domänenlogik bleibt getrennt).

### G) Qualitätsgates in CI (6–8 h)

**Aufgaben**

- `npm run lint` als blockierender Check (mindestens für geänderten Scope stabil grün).
- TS-Härtung als erster Schritt (z. B. strictere Prüfung im geänderten Bereich).
- Kurze CONTRIBUTING-Notiz: Definition-of-Done für Kontakt-/Security-Änderungen.

**Output**

- Verbindliche Guardrails, die Regressionen früh stoppen.

**Abhängigkeit**

- E/F teilweise, da neue Struktur sonst direkt wieder driftet.

### H) Abschluss & Übergabe (4–6 h)

**Aufgaben**

- End-to-end Smoke Check der geänderten Flows.
- Offene Risiken + Restarbeiten in priorisierter Liste dokumentieren.
- 2–3 Folgesprints vorbereiten (Dublettenlogik, Archivstatus-Feld, Smart Views).

**Output**

- Klarer Übergabestand inkl. messbarer Next Steps.

**Abhängigkeit**

- A–G.

---

## Tagesplanung (10 Tage, Beispiel)

- **Tag 1:** A starten + abschließen, B aufsetzen
- **Tag 2:** B implementieren
- **Tag 3:** C (kritische Endpunkte 1/2)
- **Tag 4:** C abschließen, D starten
- **Tag 5:** D abschließen, Week-1 Review
- **Tag 6:** E implementieren
- **Tag 7:** E abschließen, F starten
- **Tag 8:** F abschließen, G starten
- **Tag 9:** G abschließen, H vorbereiten
- **Tag 10:** H (Smoke, Doku, Priorisierung nächster Sprints)

---

## Priorisierte Risiko-/Blocker-Liste

1. **Unklare Auth-Anforderungen je Function** → Gegenmaßnahme: A als Pflicht vor breitem Refactor.
2. **Legacy-Queries ohne Tenant-Kontext** → Gegenmaßnahme: D mit Query-Checklist + Review-Fokus.
3. **Regression durch verteilte Validierungslogik** → Gegenmaßnahme: E als Single Source of Truth.
4. **Qualitätsrückfall nach Abschluss** → Gegenmaßnahme: G (CI-Blocker + DoD).

---

## Messbare Erfolgsmetriken (nach 2 Wochen)

- **Security:** 0 priorisierte Service-Role-Endpunkte ohne Guard in der Zielmenge.
- **Tenant-Sicherheit:** 0 identifizierte kritische Kontakt-Reads ohne Tenant-Filter in den bearbeiteten Flows.
- **Qualität:** Lint-Check für den geänderten Scope stabil grün und in CI blockierend.
- **Wartbarkeit:** Create/Edit-Kontaktvalidierung läuft über ein gemeinsames Domainmodul.

---

## Optional: Stretch-Ziele (falls +6–10 h frei werden)

- Dublettenerkennung auf kanonische Felder (`email`, normalisierte `phone`, `organization_id`) vorziehen.
- Erste Basis für expliziten Archivstatus (`is_archived`/`status`) in der Kontaktliste.
