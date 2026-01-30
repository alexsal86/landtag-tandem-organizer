
# Plan: Tenant-Isolation beim Login vollständig korrigieren

## Problemanalyse

Nach eingehender Untersuchung wurden mehrere Ursachen für das Tenant-Isolationsproblem identifiziert:

### 1. Index.tsx wartet nicht auf Tenant-Ladezustand

```text
+-------------------+
| User loggt sich   |
| ein (Erwin)       |
+--------+----------+
         |
         v
+--------+----------+
| AuthProvider      |
| loading = true    |
| user = null       |
+--------+----------+
         |
         v (Auth-State wird gesetzt)
+--------+----------+
| AuthProvider      |
| loading = false   |
| user = Erwin      |
+--------+----------+
         |
         v
+--------+----------+
| Index.tsx         |
| Rendert Dashboard |  <-- PROBLEM: TenantProvider ladt noch!
| (ohne Tenant!)    |
+--------+----------+
         |
         v
+--------+----------+
| TenantProvider    |
| loading = true    |
| currentTenant =   |
| null              |
+--------+----------+
```

**Aktuelles Verhalten in Index.tsx (Zeilen 94-107):**
- Prüft nur `loading` vom Auth-Hook
- Wartet NICHT auf `currentTenant` vom Tenant-Hook

### 2. Dashboard-Komponenten zeigen nichts ohne Tenant

- `DashboardGreetingSection` (Zeile 81): `if (!user?.id || !currentTenant?.id) return;`
- Viele andere Komponenten prüfen `currentTenant?.id` und geben früh zurück

### 3. Timing-Problem beim Benutzerwechsel

Wenn vorher ein anderer Benutzer eingeloggt war, zeigt die Seite kurz das alte Layout, bevor der Auth-Wechsel erkannt wird.

---

## Technische Lösung

### Teil 1: Index.tsx - Auf Tenant-Loading warten

**Datei:** `src/pages/Index.tsx`

Änderungen:
1. `useTenant` Hook importieren
2. Auf `tenant.loading` zusätzlich zum `auth.loading` warten
3. Ladezustand auch für Tenant anzeigen

```typescript
import { useTenant } from "@/hooks/useTenant";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  
  // ...
  
  // Wait for both auth AND tenant to be loaded
  const loading = authLoading || (user && tenantLoading);
  
  useEffect(() => {
    // Only redirect to auth when both auth is done and no user
    if (!authLoading && !user && activeSection !== 'knowledge') {
      navigate("/auth");
    }
  }, [user, authLoading, navigate, activeSection]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // ...
};
```

### Teil 2: CustomizableDashboard - Tenant-Prüfung hinzufügen

**Datei:** `src/components/CustomizableDashboard.tsx`

```typescript
import { useTenant } from "@/hooks/useTenant";

export const CustomizableDashboard: React.FC = () => {
  const { currentTenant, loading: tenantLoading } = useTenant();
  
  // Show loading while tenant is being fetched
  if (tenantLoading || !currentTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Dashboard wird geladen...</div>
      </div>
    );
  }
  
  // ... rest of component
};
```

### Teil 3: DashboardGreetingSection - Besserer Ladezustand

**Datei:** `src/components/dashboard/DashboardGreetingSection.tsx`

```typescript
export const DashboardGreetingSection = () => {
  const { user } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  
  // Show loading state while tenant is loading
  if (tenantLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg" />;
  }
  
  // Early return without rendering if no tenant
  if (!currentTenant?.id) {
    return null;
  }
  
  // ... rest of component
};
```

### Teil 4: useTenant.tsx - Robustere Logik

**Datei:** `src/hooks/useTenant.tsx`

Das Problem mit der `loading`-State-Verwaltung:
- `loading` wird erst am Ende auf `false` gesetzt
- Aber es gibt einen `return` in Zeile 77 bei Fehlern, wo `setLoading(false)` nie aufgerufen wird

```typescript
const fetchTenants = async () => {
  if (!user) {
    setTenants([]);
    setCurrentTenant(null);
    setMemberships([]);
    setLoading(false);
    return;
  }

  try {
    // ...existing code...
  } catch (error) {
    console.error('Error in fetchTenants:', error);
    // WICHTIG: Auch im Fehlerfall den Loading-State beenden
    setTenants([]);
    setCurrentTenant(null);
    setMemberships([]);
  } finally {
    setLoading(false); // Wird bereits gemacht, aber sicherstellen
  }
};
```

---

## Zusammenfassung der Änderungen

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `src/pages/Index.tsx` | `useTenant` importieren, kombiniertes `loading` verwenden |
| 2 | `src/components/CustomizableDashboard.tsx` | `tenantLoading` und `currentTenant` prüfen |
| 3 | `src/components/dashboard/DashboardGreetingSection.tsx` | Skeleton-Loading während Tenant-Ladung |
| 4 | `src/hooks/useTenant.tsx` | Fehlerfall-Handling verbessern |

---

## Erwartetes Verhalten nach der Korrektur

1. **Login als Erwin:**
   - Ladebildschirm wird angezeigt, bis Auth UND Tenant geladen sind
   - Erst dann wird das Dashboard von "Büro Erwin" angezeigt

2. **Kein "Flackern" mehr:**
   - Keine kurze Anzeige des falschen Tenants
   - Sauberer Übergang vom Login zum Dashboard

3. **Robustheit:**
   - Fehler beim Laden der Tenants blockieren die App nicht
   - Klare Fehlermeldungen bei Problemen

---

## Zusätzliche Empfehlung: Tenant-Header anzeigen

Um die Transparenz zu erhöhen, könnte in der `AppHeader`-Komponente der aktuelle Tenant-Name angezeigt werden:

```tsx
// In AppHeader.tsx
const { currentTenant } = useTenant();

// Im Header-Bereich:
{currentTenant && (
  <Badge variant="outline" className="ml-2">
    {currentTenant.name}
  </Badge>
)}
```

Dies würde Benutzern klar zeigen, in welchem Mandanten sie gerade arbeiten.
