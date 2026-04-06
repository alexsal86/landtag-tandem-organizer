

# Plan: Sitzungsverwaltung bereinigen + Tenant-Einrichtungsassistent

## 1. Aktive Sitzungen bereinigen

**Problem**: `trackSession()` in `useAuth.tsx` wird bei jedem `SIGNED_IN`-Event aufgerufen — auch bei Token-Refresh und Tab-Wechsel. Dadurch entstehen massenhaft Sitzungseinträge, obwohl es nur ein Gerät ist.

**Loesung** in `src/hooks/useAuth.tsx`:
- `trackSession` nur bei echtem Login aufrufen (nicht bei `TOKEN_REFRESHED` oder `getSession()`-Wiederherstellung). Dafuer: Bei `getSession()` nur `last_active_at` updaten (kein neuer Eintrag), bei `SIGNED_IN` pruefen ob es wirklich ein frischer Login ist (Session-Wechsel)
- Alte Sitzungen automatisch bereinigen: Beim Laden in `ActiveSessionsCard` nur Sitzungen der letzten 30 Tage anzeigen, aeltere loeschen
- Duplikat-Vermeidung: `trackSession` prueft per `device_info` ob bereits eine Sitzung existiert und updated nur `last_active_at` + `is_current` statt eine neue anzulegen (existiert teilweise schon, aber die `getSession()`-Logik umgeht das)

**Loesung** in `src/components/account/ActiveSessionsCard.tsx`:
- Beim Laden: Sitzungen aelter als 30 Tage automatisch loeschen (Cleanup-Query vor dem Fetch)
- Maximal die letzten 10 Sitzungen anzeigen

---

## 2. Tenant-Einrichtungsassistent fuer Superadmin

**Problem**: Der aktuelle "Neuer Tenant"-Dialog hat nur Name, Beschreibung und Aktiv-Toggle. Tenant-spezifische Daten wie Herkunftsort, Wahlkreis, Bundesland etc. muessen separat konfiguriert werden.

**Loesung**: Den Dialog in `SuperadminTenantManagement.tsx` zu einem mehrstufigen Formular erweitern, das beim Erstellen eines Tenants wesentliche Unterscheidungsmerkmale abfragt und in `settings` (JSON) bzw. `app_settings` speichert:

### Neue Felder im Erstellungsdialog:
- **Wahlkreis-Name** (z.B. "Karlsruhe I")
- **Wahlkreis-Nummer** 
- **Stadt/Ort** (Herkunftsort des Abgeordneten)
- **Bundesland** (Dropdown: Baden-Wuerttemberg etc.)
- **Partei/Fraktion**
- **App-Name** (Standard: "LandtagsOS", ueberschreibbar)
- **App-Untertitel** (Standard: "Koordinationssystem")

### Technische Umsetzung:
- Felder werden in der `tenants.settings` JSON-Spalte gespeichert (constituency, city, state, party, constituency_number)
- App-Name und -Untertitel werden als `app_settings`-Eintraege fuer den neuen Tenant angelegt (wie bereits im `initializeTenant`-Flow)
- Der Dialog wird vergroessert (breiterer `DialogContent`), mit einem Grid-Layout fuer die Felder
- Beim Bearbeiten eines bestehenden Tenants werden die Settings-Felder ebenfalls angezeigt und editierbar

### Erweiterung der Edge Function:
- `manage-tenant-user` → `initializeTenant`-Action erhaelt die neuen Settings-Daten und speichert sie in `tenants.settings` und `app_settings`

---

## 3. Pre-existing Build-Errors (kein Eingriff noetig)

Die Parse-Fehler in `matrix-bot-handler`, `matrix-decision-handler`, `send-matrix-morning-greeting` und `sync-external-calendar` sind vorbestehend und nicht durch die aktuellen Aenderungen verursacht. Ebenso der Typ-Fehler in `respond-public-event-invitation.test.ts`. Diese werden in diesem Schritt nicht angefasst.

---

## Betroffene Dateien
1. `src/hooks/useAuth.tsx` — Session-Tracking nur bei echtem Login
2. `src/components/account/ActiveSessionsCard.tsx` — Cleanup + Limit
3. `src/components/administration/SuperadminTenantManagement.tsx` — Erweiterter Erstellungsdialog
4. `supabase/functions/manage-tenant-user/index.ts` — initializeTenant mit Settings-Daten

