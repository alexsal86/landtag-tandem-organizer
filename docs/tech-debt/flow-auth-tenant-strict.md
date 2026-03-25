# Flow-TSConfig Restschulden (`tsconfig.flow-auth-tenant-strict.json`)

Validierung ausgeführt am **2026-03-25** mit:

```bash
npx tsc -p tsconfig.flow-auth-tenant-strict.json --pretty false
```

## Status

Der Auth/Tenant/Feature-Flag-Flow ist inhaltlich auf strengere Typen umgestellt, aber die Flow-Validierung ist aktuell noch rot.

## Hauptursachen

1. **Umgebung/Tooling fehlt für TSX-Typing**
   - `TS2307` für zentrale Pakete wie `react`, `react/jsx-runtime`, `react-router-dom`, `lucide-react`.
   - Dadurch entstehen Folgefehler in JSX (`TS7026`) in vielen betroffenen Komponenten.

2. **Bestehende implizite-any-Schulden in Flow-Komponenten**
   - Weiterhin vorhanden u. a. in:
     - `src/components/layout/AppHeader.tsx` (z. B. Callback-Parameter in `map`).
     - `src/components/administration/SuperadminTenantManagement.tsx`.
     - `src/pages/Administration.tsx`.
     - `src/pages/Index.tsx`.

## Fehleranzahl (Dateien im Scope)

- `src/hooks/useAuth.tsx`: 3
- `src/hooks/useTenant.tsx`: 2
- `src/hooks/useFeatureFlag.tsx`: 15
- `src/components/layout/AppHeader.tsx`: 53
- `src/components/SettingsView.tsx`: 88
- `src/components/account/ActiveSessionsCard.tsx`: 25
- `src/components/administration/SuperadminTenantManagement.tsx`: 90
- `src/pages/Administration.tsx`: 57
- `src/pages/Index.tsx`: 31

## Nächste Schritte

1. Dependency-/Type-Installationen im CI/Container korrigieren, damit `react` + JSX-Typen auflösbar sind.
2. Danach verbleibende `TS7006` (implizite `any`) in den oben genannten Komponenten schrittweise eliminieren.
3. Flow-TSConfig erneut laufen lassen und Fehlerbudget pro Datei auf 0 bringen.
