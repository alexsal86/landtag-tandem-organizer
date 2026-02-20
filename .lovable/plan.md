
# Wo sollen Termin-Rückmeldungen für andere Mitarbeiter sichtbar sein?

## Das Problem

Aktuell ist eine Rückmeldung ausschliesslich im Termindetail-Panel (AppointmentDetailsSidebar) einsehbar – d.h. ein Mitarbeiter muss aktiv den Kalender öffnen, den richtigen Termin finden und die Details aufklappen. Das ist in der Praxis kaum realistisch.

## Drei sinnvolle Integrationspunkte

### Option A: Notification beim Speichern einer Rückmeldung
Wenn der Abgeordnete (oder wer auch immer das Feedback schreibt) auf "Rückmeldung speichern" klickt, wird für alle anderen Mitarbeiter des Tenants eine Benachrichtigung in das bestehende Benachrichtigungssystem (`notifications`-Tabelle) eingetragen.

**Inhalt der Benachrichtigung:**
- Titel: "Neue Rückmeldung: [Terminname]"
- Nachricht: Kurzvorschau der Notiz (erste 100 Zeichen, HTML-stripped)
- Link: zum Kalender mit dem Termin-Datum vorselektiert (via `navigation_context`)

**Vorteil:** Das bestehende System wird verwendet (Bell-Icon oben rechts), keine neue UI nötig.  
**Nachteil:** Nur einmal bei Erstellung – kein Feed/Übersicht.

### Option B: Dedizierter "Rückmeldungs-Feed" in der Jour-Fixe Ansicht (MyWork > Jour Fixe Tab)
Im Jour-Fixe-Tab bei vergangenen Meetings einen neuen Abschnitt "Rückmeldungen" hinzufügen, der die `appointment_feedback.notes` zu allen Terminen des Teams anzeigt.

**Vorteil:** Kontextuell – Mitarbeiter sehen beim Nachbereiten des Meetings auch die Rückmeldungen.  
**Nachteil:** Nur für Jour-Fixe-Termine, nicht für externe/andere Termine.

### Option C: Neuer Tab "Rückmeldungen" in Meine Arbeit (für alle Mitarbeiter)
Ein eigener Tab in `MyWorkView` für **alle Mitarbeiter** (nicht nur Abgeordnete), der die letzten Rückmeldungen aller Termine des Tenants in einer Feed-Ansicht zeigt:

```
┌─────────────────────────────────────────────┐
│ 📋 Rückmeldungen                           │
├─────────────────────────────────────────────┤
│ ✅ Ausschuss Wirtschaft – 19.02.2026        │
│ Rückmeldung Max Mustermann:                 │
│ "Gutes Ergebnis beim Haushalt. Nächster ... │
│ 📎 1 Anhang  ✅ 2 Aufgaben erstellt        │
│                                             │
│ ✅ Fraktionssitzung – 18.02.2026            │
│ Rückmeldung Anna Schmidt:                   │
│ "Beschluss zu @Klaus liegt vor..."          │
└─────────────────────────────────────────────┘
```

**Vorteil:** Vollständige Transparenz, kein aktives Suchen nötig, skaliert für alle Termintypen.

---

## Meine Empfehlung: Option A + C kombiniert

**Option A (Notification)** für sofortige Sichtbarkeit bei Erstellung – der Mitarbeiter bekommt direkt Bescheid.

**Option C (Feed-Tab)** als persistente Übersicht für alle – das Gedächtnis des Teams.

Option B (Jour-Fixe-Integration) kann später ergänzt werden.

---

## Technische Umsetzung

### Teil 1: Notification beim Speichern (Option A)

**In `AppointmentFeedbackWidget.tsx` → `handleSaveNote`:**

Nach dem Speichern der Rückmeldung werden für alle anderen Mitarbeiter des Tenants Notifications angelegt:

```ts
// Strip HTML für Vorschau
const plainText = noteWithAuthor.replace(/<[^>]*>/g, '').slice(0, 120);

// Notification-Type-ID für "appointment_feedback" laden (oder fester UUID)
// Für jeden anderen Mitarbeiter im Tenant einen Notification-Eintrag erstellen
const otherUsers = tenantUsers.filter(u => u.user_id !== user.id);
await supabase.from('notifications').insert(
  otherUsers.map(u => ({
    user_id: u.user_id,
    title: `Rückmeldung: ${appointment.title}`,
    message: plainText,
    is_read: false,
    priority: 'medium',
    navigation_context: `calendar?date=${appointment.start_time.split('T')[0]}`
  }))
);
```

**Hinweis:** Die `notification_type_id` ist eine Pflicht-Spalte (FK). Wir prüfen, ob bereits ein Type `appointment_feedback` existiert – wenn nicht, legen wir ihn per Migration an. Alternativ wird `notification_type_id` nullable gemacht (Migration).

### Teil 2: Rückmeldungs-Feed Tab in Meine Arbeit (Option C)

**Neue Dateien:**
- `src/components/my-work/MyWorkFeedbackFeedTab.tsx` – neue Komponente
- `src/hooks/useTeamFeedbackFeed.ts` – Datenabfrage

**Datenabfrage `useTeamFeedbackFeed`:**
```sql
SELECT 
  af.id, af.notes, af.completed_at, af.has_documents, af.has_tasks,
  a.title, a.start_time,  -- für reguläre Termine
  ee.title, ee.start_time  -- für externe Events
FROM appointment_feedback af
LEFT JOIN appointments a ON a.id = af.appointment_id
LEFT JOIN external_events ee ON ee.id = af.external_event_id
WHERE af.tenant_id = currentTenant.id
  AND af.feedback_status = 'completed'
  AND af.notes IS NOT NULL
ORDER BY af.completed_at DESC
LIMIT 20
```

**Anzeige in `MyWorkFeedbackFeedTab`:**
- Filtert nur Einträge mit `notes != null`
- Rendert Termintitel, Datum, `<RichTextDisplay content={af.notes}>`
- Zeigt Badges: "📎 Anhang", "✅ Aufgaben" wenn vorhanden
- Keine Bearbeitungsfunktion – reine Leseansicht

**Integration in `MyWorkView.tsx`:**
- Neuer Tab "Rückmeldungen" sichtbar für alle Rollen (`mitarbeiter`, `bueroleitung`, `abgeordneter`)
- Tab-Icon: `MessageSquare` oder `ClipboardList`
- Platzierung nach "Aufgaben", vor "Kalender"

### Teil 3: Notification-Type Migration (wenn nötig)

Wenn `notification_type_id` NOT NULL ist, benötigen wir eine Migration:

```sql
-- Neuen Notification-Type anlegen
INSERT INTO notification_types (name, label, description)
VALUES ('appointment_feedback', 'Termin-Rückmeldung', 'Rückmeldung zu einem Termin wurde gespeichert')
ON CONFLICT (name) DO NOTHING;
```

Damit können wir die UUID in der Code-Logik verwenden.

---

## Geänderte/neue Dateien

| Datei | Aktion |
|-------|--------|
| `supabase/migrations/...appointment_feedback_notification_type.sql` | Notification-Type anlegen |
| `src/components/dashboard/AppointmentFeedbackWidget.tsx` | Notification-Versand beim Speichern |
| `src/hooks/useTeamFeedbackFeed.ts` | Neuer Hook für Team-Feed |
| `src/components/my-work/MyWorkFeedbackFeedTab.tsx` | Neue Feed-Komponente |
| `src/components/MyWorkView.tsx` | Neuer Tab "Rückmeldungen" |

---

## Reihenfolge der Umsetzung

1. Migration (Notification-Type)
2. Notification-Versand im Widget
3. Feed-Hook + Feed-Tab
4. Tab in MyWorkView integrieren
