

# Plan: NotificationCenter Deep-Links reparieren

## Problemanalyse

Es gibt drei Ursachen, warum Klicks auf Benachrichtigungen immer zum Dashboard fuehren:

1. **Echtzeit-Benachrichtigungen verlieren den Typ:** Neue Benachrichtigungen, die ueber die Supabase-Echtzeit-Verbindung ankommen, enthalten nur die Rohdaten ohne die verkuepfte `notification_types`-Tabelle. Dadurch ist `notification_types.name` immer `undefined`.

2. **Der Fallback funktioniert nicht:** Der Code versucht als Fallback `notification.data.type` zu lesen, aber dieses Feld existiert in keiner einzigen Benachrichtigung in der Datenbank.

3. **Die Benachrichtigungsseite navigiert nicht:** Auf der Seite `/notifications` (Alle anzeigen) wird beim Klick auf eine Benachrichtigung nur "gelesen" markiert, aber es findet keine Navigation zum Ziel statt.

## Loesung

### 1. Echtzeit-Benachrichtigungen korrekt laden

In `src/hooks/useNotifications.tsx` wird der Echtzeit-Handler so angepasst, dass bei einer neuen Benachrichtigung sofort die vollstaendigen Daten inklusive `notification_types` nachgeladen werden, statt nur die Rohdaten aus dem Payload zu verwenden.

```text
// Statt: payload.new direkt verwenden
// Neu: Nach Empfang des Payloads die Benachrichtigung mit JOIN nachladen
const { data } = await supabase
  .from('notifications')
  .select('*, notification_types(name, label)')
  .eq('id', payload.new.id)
  .single();
```

### 2. navigation_context als zuverlaessigen Fallback nutzen

In `src/components/NotificationCenter.tsx` wird `buildDeepLinkPath` um einen Fallback auf das Feld `navigation_context` erweitert. Dieses Feld ist in der Datenbank bei jeder Benachrichtigung gesetzt (z.B. "decisions", "tasks", "mywork") und kann direkt als Sektionspfad verwendet werden.

```text
// Am Ende von buildDeepLinkPath, vor dem default-Case:
// Falls kein Typ erkannt wurde, aber navigation_context vorhanden ist:
if (notification.navigation_context) {
  return '/' + notification.navigation_context;
}
return '/';
```

Das Notification-Interface in `useNotifications.tsx` muss um `navigation_context?: string` erweitert werden.

### 3. Benachrichtigungsseite mit Navigation ausstatten

In `src/pages/NotificationsPage.tsx` wird der Klick-Handler fuer Benachrichtigungen um eine Navigation ergaenzt. Die bestehende `buildDeepLinkPath`-Funktion wird in eine gemeinsame Datei (`src/utils/notificationDeepLinks.ts`) ausgelagert, damit sie sowohl im NotificationCenter als auch auf der NotificationsPage verwendet werden kann.

```text
// NotificationsPage onClick wird erweitert:
onClick={() => {
  if (!notification.is_read) markAsRead(notification.id);
  const path = buildDeepLinkPath(notification);
  navigate(path);
}}
```

### 4. Shared Utility fuer Deep-Link-Logik

Die Funktion `buildDeepLinkPath` wird aus `NotificationCenter.tsx` in eine neue Datei `src/utils/notificationDeepLinks.ts` verschoben, um Dopplung zu vermeiden. Beide Stellen (NotificationCenter und NotificationsPage) importieren die Funktion dann von dort.

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/utils/notificationDeepLinks.ts` | Neue Datei: `buildDeepLinkPath` ausgelagert, mit `navigation_context`-Fallback |
| `src/hooks/useNotifications.tsx` | Notification-Interface um `navigation_context` erweitern; Echtzeit-Handler laed vollstaendige Daten nach |
| `src/components/NotificationCenter.tsx` | `buildDeepLinkPath` importieren statt lokal definieren |
| `src/pages/NotificationsPage.tsx` | Klick-Handler um Navigation mit `buildDeepLinkPath` ergaenzen |

## Reihenfolge

1. Shared Utility erstellen (`notificationDeepLinks.ts`)
2. Notification-Interface erweitern (`useNotifications.tsx`)
3. Echtzeit-Handler fixen (`useNotifications.tsx`)
4. NotificationCenter umstellen (`NotificationCenter.tsx`)
5. NotificationsPage Navigation hinzufuegen (`NotificationsPage.tsx`)

