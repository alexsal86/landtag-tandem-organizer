

## Nächste Schritte — Plattform-Verbesserungen

Wir haben **Tests** abgehakt. Laut der Bewertung stehen noch drei Baustellen offen:

### 1. Error-Handling verbessern (Note 3 → 2)
- **Error Boundaries** an allen Haupt-Subrouten (Dashboard, Kontakte, Aufgaben, Dokumente, Kalender, Nachrichten) anbringen — nicht nur global
- **Fehlende Toast-Feedbacks** in Hooks nachrüsten, die bisher nur `console.error` nutzen (z.B. `useDecisionComments`, Realtime-Subscriptions)
- `handleAppError` konsequent in allen `catch`-Blöcken einsetzen statt ad-hoc `toast()`

### 2. Accessibility-Audit (Note 3+ → 2)
- `aria-label` auf Icon-Only-Buttons (Toolbar, Navigation)
- Skip-Navigation-Link am Seitenanfang
- Fokus-Management bei Dialogen und Modalen prüfen
- Farbkontrast-Check für Custom-Farben (nicht Radix-Defaults)

### 3. Dependency-Cleanup (Bundle-Optimierung)
- `moment` aus `package.json` entfernen (bereits bestätigt: wird nicht genutzt)
- Prüfen ob `@types/jspdf`, `@types/jszip`, `@types/xlsx` noch nötig sind (die Libraries selbst bringen oft eigene Types mit)
- Redundante Pakete identifizieren und entfernen

---

**Empfohlene Reihenfolge:** Error-Handling zuerst (schnell sichtbarer Impact), dann Accessibility, dann Cleanup.

Ich würde pro Nachricht 1-2 Punkte umsetzen.

