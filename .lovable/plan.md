
# Plan: Tenant-Isolation beim Login/Logout korrigieren

## Problemanalyse

Das System zeigt den falschen Tenant an, wenn sich ein anderer Benutzer einloggt. Die Ursache:

1. **localStorage wird beim Logout nicht gelöscht:** Die `currentTenantId` bleibt im Browser gespeichert
2. **Beim Benutzerwechsel wird der alte Tenant-Wert verwendet:** Auch wenn der neue Benutzer keinen Zugriff auf diesen Tenant hat
3. **Fehlende User-ID-Validierung:** Das System prüft nicht, ob der localStorage-Tenant zum aktuell eingeloggten Benutzer gehört

## Technische Lösung

### 1. localStorage beim Logout löschen

**Datei: `src/hooks/useAuth.tsx`**

In der `signOut`-Funktion den localStorage-Eintrag entfernen:

```typescript
const signOut = async () => {
  // Log logout before signing out
  if (user?.email) {
    logAuditEvent({ 
      action: AuditActions.LOGOUT, 
      email: user.email,
      details: { user_id: user.id }
    });
  }
  
  // Clear tenant selection on logout to prevent cross-user tenant leakage
  localStorage.removeItem('currentTenantId');
  
  await supabase.auth.signOut();
};
```

### 2. User-spezifischen localStorage-Key verwenden

**Datei: `src/hooks/useTenant.tsx`**

Statt eines globalen Keys einen benutzerspezifischen Key verwenden:

```typescript
// Vorher (global - unsicher bei Benutzerwechsel):
const savedTenantId = localStorage.getItem('currentTenantId');

// Nachher (benutzerspezifisch - sicher):
const tenantStorageKey = `currentTenantId_${user.id}`;
const savedTenantId = localStorage.getItem(tenantStorageKey);
```

Alle Stellen anpassen, die `localStorage.getItem/setItem/removeItem` für `currentTenantId` verwenden.

### 3. Zusätzliche Validierung hinzufügen

**Datei: `src/hooks/useTenant.tsx`**

Sicherstellen, dass der gespeicherte Tenant tatsächlich in den verfügbaren Tenants existiert:

```typescript
// Bestehende Logik verbessern:
const tenantStorageKey = `currentTenantId_${user.id}`;
const savedTenantId = localStorage.getItem(tenantStorageKey);
let currentTenantToSet = null;

if (savedTenantId) {
  // NUR verwenden wenn der Tenant in den verfügbaren Tenants des Users existiert
  currentTenantToSet = tenantsData.find(t => t.id === savedTenantId) || null;
  
  if (!currentTenantToSet) {
    // Gespeicherter Tenant ist ungültig - entfernen
    console.warn('⚠️ Stored tenant not accessible, clearing localStorage');
    localStorage.removeItem(tenantStorageKey);
  }
}

// Fallback auf ersten verfügbaren Tenant
if (!currentTenantToSet && tenantsData.length > 0) {
  currentTenantToSet = tenantsData[0];
  console.log('🏢 Using first available tenant:', currentTenantToSet);
}
```

### 4. Alte globale localStorage-Einträge aufräumen

Bei der Migration auch den alten globalen Key entfernen:

```typescript
// In fetchTenants, am Anfang:
// Clean up legacy global key (one-time migration)
const legacyKey = 'currentTenantId';
if (localStorage.getItem(legacyKey)) {
  localStorage.removeItem(legacyKey);
  console.log('🧹 Cleaned up legacy tenant storage key');
}
```

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `src/hooks/useAuth.tsx` | `localStorage.removeItem('currentTenantId')` in `signOut()` |
| `src/hooks/useTenant.tsx` | User-spezifischer Key `currentTenantId_${user.id}` |
| `src/hooks/useTenant.tsx` | Validierung + Fallback-Logik verbessern |
| `src/hooks/useTenant.tsx` | Legacy-Key aufräumen |

## Erwartetes Verhalten nach der Korrektur

1. **Logout:** Tenant-Auswahl wird gelöscht
2. **Login neuer Benutzer:** System lädt nur die Tenants, auf die der Benutzer Zugriff hat
3. **Tenant-Wechsel:** Wird pro Benutzer gespeichert
4. **Sicherheit:** Kein "Tenant-Leaking" zwischen Benutzern möglich
