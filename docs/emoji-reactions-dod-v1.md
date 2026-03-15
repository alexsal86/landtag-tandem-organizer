# Emoji-Reaktionen auf Entscheidungs-Kommentare – Definition of Done (v1.0)

## Ziel
Diese Checkliste definiert, wann das Feature **"Emoji-Reaktionen auf `task_decision_comments`"** als produktionsreif gilt.

---

## 1) Functional DoD

### 1.1 Reaktions-Grundfunktion
- [ ] Nutzer können auf einen Kommentar mit einem Emoji reagieren.
- [ ] Ein erneuter Klick auf dasselbe Emoji entfernt die eigene Reaktion (Toggle).
- [ ] Mehrere unterschiedliche Emojis pro Kommentar sind möglich.
- [ ] Aggregierte Zähler pro Emoji werden korrekt angezeigt.
- [ ] Eigene Reaktion ist visuell erkennbar (active state).

### 1.2 Kommentar-Thread-Integration
- [ ] Reaktionen funktionieren auf Root-Kommentaren und Antworten.
- [ ] Bei gelöschten Kommentaren wird die Reaktionsbar gemäß Produktentscheidung behandelt (aktuell: ausblenden).
- [ ] Overflow-Handling für viele Emojis ist nutzbar und verständlich.

### 1.3 Benachrichtigungen
- [ ] Notification-Typ `task_decision_comment_reaction_received` ist in allen relevanten Tenants vorhanden.
- [ ] Keine Selbst-Benachrichtigung.
- [ ] Deduplizierung/Rate-Limit funktioniert (keine Notification-Flut).
- [ ] Deep-Link aus Notification führt in den korrekten Decision-Kontext.

### 1.4 Realtime-Verhalten
- [ ] Reaktionsänderungen anderer Nutzer erscheinen ohne manuellen Reload.
- [ ] Realtime-Events werden auf sichtbare Kommentar-IDs gefiltert.
- [ ] Bei inkrementellem Fehler existiert ein robuster Fallback (Reload der Kommentare).

---

## 2) Data & Security DoD

### 2.1 Datenmodell
- [ ] Tabelle `task_decision_comment_reactions` existiert inkl. FK auf `task_decision_comments`.
- [ ] Unique Constraint `(comment_id, user_id, emoji)` ist aktiv.
- [ ] Emoji-Check-Constraint (Allowlist) ist aktiv und dokumentiert.
- [ ] Notwendige Indexe sind vorhanden (`comment_id`, `user_id`, `comment_id+emoji`).

### 2.2 RLS & Berechtigungen
- [ ] SELECT nur für authentifizierte Nutzer.
- [ ] INSERT nur für eigene `user_id`.
- [ ] DELETE nur für eigene Reaktionen.
- [ ] Keine tenant-fremden Daten sichtbar (gemäß existierendem Datenmodell).

### 2.3 Typen & Migrationshygiene
- [ ] Supabase-Type-Generierung ist aktuell.
- [ ] Migrations sind idempotent, reproduzierbar und in korrekter Reihenfolge.
- [ ] Rollback-Strategie für kritische Migrationen ist dokumentiert.

---

## 3) UX/Accessibility DoD

- [ ] Buttons haben sprechende `aria-label`s.
- [ ] Fokus-/Keyboard-Bedienung funktioniert für Reaction-Buttons und Picker.
- [ ] Tooltips („Wer hat reagiert?“) sind verständlich und nicht blockierend.
- [ ] Mobile Darstellung bleibt bei vielen Reaktionen stabil.

---

## 4) Quality & Testing DoD

### 4.1 Pflicht-Tests
- [ ] Unit-Tests für Aggregations-/Sortierlogik.
- [ ] Component-Tests für Toggle + Zähler-Rendering.
- [ ] Tests für Optimistic Update + Rollback bei DB-Fehler.
- [ ] Tests für Debounce und Pending-Guard.
- [ ] Testfall „Notification/Analytics schlägt fehl“ ohne Rollback der erfolgreichen DB-Operation.

### 4.2 Sanity-Checks vor Release
- [ ] Lokale Test-Suite grün.
- [ ] Keine TypeScript/Build-Fehler.
- [ ] Keine offensichtlichen Regressions im Decision-Kommentar-Flow.

---

## 5) Rollout-Plan (v1.0)

### Phase A – Internes Pilot-Team (1–3 Tage)
1. Feature in kleinem Nutzerkreis aktivieren.
2. Fokus auf:
   - Reaktions-Usability,
   - Realtime-Konsistenz,
   - Notification-Qualität.
3. Tägliche Auswertung von Fehlerlogs und Support-Rückmeldungen.

**Go/No-Go-Kriterien für Phase B**
- Keine kritischen Datenfehler.
- Keine Häufung von Notification-Bugs.
- Keine Performance-Auffälligkeiten in Kommentar-Sheets.

### Phase B – Stufenweise Ausweitung (weitere 2–5 Tage)
1. Rollout auf weitere Teams/Tenants.
2. Monitoring intensiv halten (siehe Monitoring-Checklist).
3. Bei Problemen: Sofortmaßnahmen (Feature-Flag aus / Notification-Teil deaktivieren / Realtime-Fallback).

### Phase C – Allgemeine Verfügbarkeit
1. Rollout für alle Nutzer.
2. Nachlauf mit 1–2 Wochen verstärktem Monitoring.
3. Entscheidung über Erweiterungen (weitere Emojis, Analytics-Dashboard, Cross-Feature-Ausbau).

---

## 6) Monitoring-Checklist

### 6.1 Technisches Monitoring
- [ ] Fehlerquote bei Insert/Delete auf `task_decision_comment_reactions` beobachten.
- [ ] Realtime-Fehler (Subscription/Incremental Refresh) beobachten.
- [ ] Fehler im Notification-RPC (`create_notification`) für Reaktions-Events überwachen.
- [ ] Edge-Function-Fehler für Analytics-Events (falls aktiv) überwachen.

### 6.2 Produkt-Metriken
- [ ] Anzahl Reaktions-Events pro Tag/Woche.
- [ ] Verhältnis Insert vs. Delete (Hinweis auf Missklicks/UX-Probleme).
- [ ] Top-Emojis (für spätere Allowlist-Entscheidungen).
- [ ] Anteil Kommentare mit mindestens 1 Reaktion.

### 6.3 Alerting (empfohlen)
- [ ] Alert bei stark erhöhter Fehlerrate bei Reaction-Write.
- [ ] Alert bei ungewöhnlich hoher Notification-Rate pro Minute.
- [ ] Alert bei wiederholten Realtime-Refresh-Fallbacks.

---

## 7) Betrieb & Support

### 7.1 Runbook (kurz)
- Bei „Reaktionen gehen nicht“:
  1. DB-Write-Fehler prüfen,
  2. RLS-Policies prüfen,
  3. Constraint-Verletzungen prüfen,
  4. Notification-Fehler getrennt bewerten (kein primärer Write-Blocker).

### 7.2 Kommunikationsvorlagen
- [ ] Interne Release-Note für neue Funktion.
- [ ] Kurz-Hinweis in Teamkanal inkl. „Wie nutze ich Reaktionen?“. 
- [ ] Support-FAQ für häufige Fragen („Warum sehe ich keine Reaktionen?“).

---

## 8) Backlog nach v1.0 (optional)

- [ ] Admin-konfigurierbare Emoji-Allowlist.
- [ ] Nutzerpräferenz für Reaktions-Notifications (opt-in/out je Typ).
- [ ] E2E-Test für Realtime-Reaktionen mit zwei Sessions.
- [ ] Einheitliches Reaktionsmodell für weitere Module (z. B. `task_comments`, Chat, Notizen).

---

## Abnahme
Feature gilt als „Done v1.0“, wenn **alle Pflichtpunkte** in den Abschnitten 1–4 erfüllt sind und der Rollout mindestens **Phase B ohne kritische Incidents** absolviert hat.
