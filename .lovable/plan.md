

## Offene Punkte: SEO & Accessibility, Design & UX, Testing & Stabilität

### Was bereits erledigt ist
- SEO-Metadaten (OG, Twitter, JSON-LD, lang="de", canonical)
- SkipToContent-Link + `id="main-content"` auf Index/LetterDetail
- Security-Headers (CSP, X-Content-Type-Options, Referrer-Policy)
- `strictNullChecks: true` und `noImplicitAny: true` in tsconfig.app
- 19 Test-Dateien mit ~112 Tests vorhanden
- Lexical-Dedupe-Plugin für Build-Stabilität

---

### Was noch aussteht

#### 1. Accessibility (A11y)

| Maßnahme | Detail |
|----------|--------|
| `id="main-content"` fehlt auf weiteren Seiten | Nur `Index.tsx` und `LetterDetail.tsx` haben es — alle anderen Routen (z. B. Kontakte, Kalender, Aufgaben) brauchen ein `<main id="main-content">` |
| Fehlende `aria-label` auf Icon-Only-Buttons | Systematisch alle `<Button size="icon">` ohne `aria-label` ergänzen (Navigation, Toolbar, Sidebar) |
| Fokus-Management bei Dialogen/Modals | Prüfen, ob Fokus beim Öffnen in den Dialog springt und beim Schließen zurückkehrt (Radix macht das meist, aber custom Overlays ggf. nicht) |
| Kontrast-Check | Einige `text-muted-foreground`-Elemente auf kleinen Schriftgrößen könnten WCAG AA nicht erfüllen |
| `alt`-Texte für Bilder | Avatare, Wappen-SVGs und hochgeladene Bilder systematisch prüfen |

#### 2. Design & UX

| Maßnahme | Detail |
|----------|--------|
| Konsistente Spacing/Typography-Skala | Aktuell gemischt `text-sm`, `text-base`, `text-xs` ohne klares System — ein Design-Token-Set definieren |
| Mobile Navigation | Prüfen ob Bottom-Nav auf kleinen Screens gut funktioniert, Touch-Targets ≥ 44px |
| Loading-States vereinheitlichen | Unterschiedliche Skeleton/Spinner-Patterns in verschiedenen Modulen → ein `<PageSkeleton>` |
| Error-States | Einheitliche Error-Boundary-UI statt leerer Screens bei Fehlern |
| Dark Mode Feinschliff | Schatten, Borders und Hover-States im Dark Mode prüfen |

#### 3. Testing & Stabilität

| Maßnahme | Detail |
|----------|--------|
| `strict: true` in tsconfig | Noch auf `false` — aktivieren würde `strictBindCallApply`, `strictFunctionTypes`, `strictPropertyInitialization`, `noImplicitThis` einschalten |
| Kritische Hooks testen | `useAuth`, `useTenant`, `useContacts`, `useDaySlipStore` haben keine Tests |
| E2E-Smoke-Test | Kein E2E-Framework vorhanden — zumindest Login → Dashboard → Navigation testen |
| Edge-Function-Tests | `supabase--test_edge_functions` nutzen für die wichtigsten Functions |
| ESLint `rules-of-hooks` Fehler | Laut docs gibt es noch Hook-Abhängigkeitswarnungen und echte Fehler |

---

### Vorgeschlagene Reihenfolge

1. **A11y Quick-Wins** — `main`-Landmark auf alle Seiten, `aria-label` auf Icon-Buttons, `alt`-Texte
2. **Design-Konsistenz** — Einheitliche Loading/Error-States, Typography-Tokens
3. **TypeScript `strict: true`** — schrittweise aktivieren und Fehler fixen
4. **Tests für kritische Hooks** — `useAuth`, `useTenant` mit Vitest testen
5. **Mobile UX** — Touch-Targets, Bottom-Nav, responsive Dialoge prüfen

Soll ich mit Punkt 1 (A11y Quick-Wins) beginnen, oder willst du eine andere Reihenfolge?

