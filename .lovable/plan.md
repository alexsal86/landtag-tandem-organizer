
# Plan: Push-Subscription Auto-Renewal Fix

## Problem-Ursache

Die Push-Benachrichtigungen fuer Alexander funktionieren nicht, weil:

1. Die Browser-Permission ist `granted` (wurde einmal erteilt und bleibt dauerhaft)
2. Die UI zeigt "Aktiviert" und **versteckt den Aktivieren-Button**
3. Alle Push-Subscriptions in der DB sind `is_active: false` (abgelaufen seit August 2025)
4. Es gibt keinen Mechanismus, der bei App-Start automatisch prueft, ob eine gueltige Subscription existiert, und sie erneuert

Die Edge Function Logs bestaetigen: `"No active subscriptions found for user: ff0e6d83..."` -- der Trigger feuert korrekt, aber es gibt schlicht keine aktive Subscription.

## Loesung

### 1. Auto-Renewal bei App-Start (`useNotifications.tsx`)

Ein neuer `useEffect` wird hinzugefuegt, der beim App-Start folgendes prueft:
- Ist `pushPermission === 'granted'`?
- Hat der User eine aktive Subscription in der DB?
- Falls nein: Automatisch `subscribeToPush()` aufrufen

```text
useEffect -> wenn pushPermission === 'granted' und user vorhanden:
  1. DB abfragen: Gibt es is_active=true fuer diesen User?
  2. Falls nein: subscribeToPush() aufrufen (re-registriert Service Worker + neuen Endpoint)
```

### 2. UI in NotificationSettings.tsx verbessern

Auch wenn `pushPermission === 'granted'` ist, soll ein "Erneut verbinden"-Button angezeigt werden, falls keine aktive Subscription in der DB existiert. Dafuer:

- Neuen State `hasActiveSubscription` einfuehren
- Bei `pushPermission === 'granted'` pruefen ob aktive DB-Subscription existiert
- Falls nicht: Button "Push erneuern" anzeigen statt nur "Aktiviert"

### 3. Bestehende alte Subscriptions bereinigen

Beim erneuten Subscriben werden alte inaktive Subscriptions fuer den User deaktiviert/geloescht, damit die Tabelle sauber bleibt.

---

## Technische Details

### Datei: `useNotifications.tsx`

Neuer `useEffect` nach dem bestehenden Push-Permission-Check:

```text
useEffect(() => {
  if (!user || !pushSupported || pushPermission !== 'granted') return;
  
  const checkAndRenewSubscription = async () => {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1);
    
    if (!data || data.length === 0) {
      console.log('No active push subscription found, auto-renewing...');
      await subscribeToPush();
    }
  };
  
  checkAndRenewSubscription();
}, [user, pushSupported, pushPermission]);
```

### Datei: `NotificationSettings.tsx`

- State `hasActiveSubscription` hinzufuegen
- DB-Check bei Mount und nach `enablePushNotifications`
- Wenn `pushPermission === 'granted'` aber keine aktive Subscription: "Push erneuern"-Button anzeigen

### Dateien

| Datei | Aenderung |
|-------|-----------|
| `useNotifications.tsx` | Auto-Renewal useEffect bei App-Start |
| `NotificationSettings.tsx` | "Push erneuern"-Button wenn Subscription abgelaufen |
