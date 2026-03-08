
## Problem

Die Logo-Abfrage in `LoginCustomization.tsx` (Zeile 51-55) filtert nicht nach `tenant_id`. Wenn mehrere Einträge für `app_logo_url` existieren (z.B. ein globaler und ein mandantenspezifischer), gibt `.maybeSingle()` einen Fehler zurück und das Logo wird nicht angezeigt.

## Lösung

Die Abfrage in `loadData()` anpassen: Zuerst den mandantenspezifischen `app_logo_url` laden (`.eq('tenant_id', currentTenant.id)`). Falls nicht vorhanden, Fallback auf den globalen Eintrag (`.is('tenant_id', null)`).

**Datei:** `src/components/administration/LoginCustomization.tsx`, Zeilen 50-58

```typescript
// 1. Try tenant-specific logo
const { data: tenantLogoData } = await supabase
  .from('app_settings')
  .select('setting_value')
  .eq('setting_key', 'app_logo_url')
  .eq('tenant_id', currentTenant.id)
  .maybeSingle();

if (tenantLogoData?.setting_value) {
  setLogoUrl(tenantLogoData.setting_value);
} else {
  // 2. Fallback to global logo
  const { data: globalLogoData } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', 'app_logo_url')
    .is('tenant_id', null)
    .maybeSingle();

  if (globalLogoData?.setting_value) {
    setLogoUrl(globalLogoData.setting_value);
  }
}
```

Zusätzlich `crossOrigin="anonymous"` auf das `<img>`-Tag setzen, falls das Logo von einem externen Storage kommt (analog zu `GeneralSettings.tsx`).
