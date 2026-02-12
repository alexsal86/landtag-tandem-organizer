
# Plan: Dashboard-Layout und Benachrichtigungs-Debugging

## 1. Dashboard-Layout: Begruessung und News nebeneinander (50/50)

Aktuell in `MyWorkView.tsx` (Zeilen 492-498):
```text
<div className="space-y-6">
  <DashboardGreetingSection />
  <div className="w-1/2">
    <NewsWidget />
  </div>
</div>
```

Das wird geaendert zu einem horizontalen Grid mit 50/50-Aufteilung:
```text
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <DashboardGreetingSection />
  <NewsWidget />
</div>
```

Die `DashboardGreetingSection` muss ggf. in der Hoehe angepasst werden, damit sie neben dem NewsWidget gut aussieht (z.B. `h-full` auf dem Container).

**Dateien:** `MyWorkView.tsx`

---

## 2. Echtzeit-Benachrichtigungen und Browser-Push fuer Entscheidungen

### Analyse der Probleme

Ich habe die Datenbank untersucht und folgendes festgestellt:

**a) Die Benachrichtigung WIRD erstellt** -- die "sdfsdfsdfsdfsd"-Entscheidung hat eine Notification in der DB erzeugt (ID `a2431d15`, erstellt um 11:40:19). Das `create_notification` RPC funktioniert.

**b) Echtzeit-Updates funktionieren nicht zuverlaessig** -- Die Realtime-Subscription fuer Alexanders Notifications ist in der aktiven Subscription-Liste nicht zu sehen (nur Carlas ist registriert). Das deutet darauf hin, dass die Subscription in der Lovable-Preview-Umgebung verloren geht (z.B. durch Hot-Reload). In der publizierten Version sollte es stabil laufen.

**c) Browser-Push funktioniert NICHT**, weil:
- Die Tabelle `push_subscriptions` ist LEER fuer Alexander -- es gibt keine registrierte Push-Subscription
- Der Trigger `push_notification_trigger` prueft korrekt auf aktive Subscriptions und ueberspringt den Push, wenn keine vorhanden sind
- Der User muss zuerst in den Benachrichtigungseinstellungen Push-Benachrichtigungen AKTIVIEREN (Browser-Erlaubnis erteilen + Subscription registrieren)

**d) `data_param` wird nicht stringifiziert** -- Laut der bestehenden Architektur-Dokumentation muss `data_param` als `JSON.stringify()` uebergeben werden, um Serialisierungsfehler zu vermeiden. Aktuell wird ein rohes Objekt uebergeben.

### Massnahmen

#### 2a. `data_param` ueberall stringifizieren
In allen `create_notification`-Aufrufen wird `data_param: { ... }` durch `data_param: JSON.stringify({ ... })` ersetzt. Das betrifft ~8 Stellen in:
- `StandaloneDecisionCreator.tsx` (Zeile 334-337)
- `TaskDecisionCreator.tsx`
- `TaskDecisionResponse.tsx` (2 Stellen)
- `DecisionComments.tsx`
- `DecisionOverview.tsx`
- `DecisionEditDialog.tsx`

#### 2b. Realtime-Subscription robuster machen
In `useNotifications.tsx` wird die Subscription mit einem Retry-Mechanismus versehen und ein explizites `subscribe()` mit Status-Callback hinzugefuegt, um sicherzustellen, dass die Verbindung nach Unterbrechungen wiederhergestellt wird.

#### 2c. Push-Hinweis fuer den Nutzer
Der bestehende Push-Registrierungs-Flow (in den Benachrichtigungseinstellungen) muss vom Nutzer manuell aktiviert werden. Es wird ein deutlicherer Hinweis in der Notification-Bell oder den Einstellungen eingebaut, wenn noch keine Push-Subscription besteht.

**Dateien:** `StandaloneDecisionCreator.tsx`, `TaskDecisionCreator.tsx`, `TaskDecisionResponse.tsx`, `DecisionComments.tsx`, `DecisionOverview.tsx`, `DecisionEditDialog.tsx`, `useNotifications.tsx`

---

## Technische Zusammenfassung

### Keine DB-Aenderungen noetig

### Dateien

| Datei | Aenderung |
|-------|-----------|
| `MyWorkView.tsx` | Dashboard-Layout auf `grid grid-cols-2` mit 50/50 umstellen |
| `StandaloneDecisionCreator.tsx` | `data_param` stringifizieren |
| `TaskDecisionCreator.tsx` | `data_param` stringifizieren |
| `TaskDecisionResponse.tsx` | `data_param` stringifizieren (2 Stellen) |
| `DecisionComments.tsx` | `data_param` stringifizieren |
| `DecisionOverview.tsx` | `data_param` stringifizieren |
| `DecisionEditDialog.tsx` | `data_param` stringifizieren |
| `useNotifications.tsx` | Realtime-Subscription stabiler machen mit Reconnect-Logik |
