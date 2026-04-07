

## Plan: Badge-Anzeige reduzieren und Dot-Position auf Icon setzen

### Problem
1. Bei einer neuen Entscheidung leuchten drei Badges: Benachrichtigungen, Meine Arbeit, und Aufgaben (weil "Entscheidungen" ein Sub-Item von "Aufgaben" ist und der Badge zum Gruppen-Badge hochrollt)
2. Der Badge pulsiert zu schnell (Standard `animate-pulse` = 2s)
3. Der Badge-Dot sitzt am Ende der Zeile statt oben rechts am Icon

### Lösungsansatz

**Schritt 1: Badge-Kontext für Entscheidungen ändern (Migration)**
- Neue Migration: `navigation_context` der Entscheidungs-Benachrichtigungen von `'decisions'` auf `'mywork'` ändern in `notification_navigation_mapping`
- Betrifft: `task_decision_request`, `task_decision_complete`, `task_decision_completed`, `task_decision_comment_received`, `task_decision_creator_response`
- Bestehende ungelesene Notifications mit `navigation_context = 'decisions'` auf `'mywork'` umschreiben
- Dadurch wird der Badge nur noch bei "Meine Arbeit" angezeigt (+ Benachrichtigungen-Panel bleibt unverändert)

**Schritt 2: Langsamere Puls-Animation**
- In `tailwind.config.ts`: Neue Animation `pulse-slow` mit 4s Dauer hinzufügen
- Alle `animate-pulse` Badges in Navigation (`Navigation.tsx`, `AppNavigation.tsx`, `NotificationDot.tsx`) auf `animate-pulse-slow` umstellen

**Schritt 3: Badge-Position auf Icon verlegen**
- In `renderNavItem` (AppNavigation.tsx) und in `Navigation.tsx`: Den Badge-Dot von `ml-auto` am Zeilenende auf eine `absolute -top-1 -right-1` Position am Icon-Container setzen
- Das Icon bekommt `relative` als Container, der Dot wird als absolut positioniertes Kind oben rechts am Icon platziert
- Gleiche Anpassung für Gruppen-Header-Icons

### Betroffene Dateien
- Neue SQL-Migration (navigation_context update)
- `tailwind.config.ts` — neue `pulse-slow` Animation
- `src/components/AppNavigation.tsx` — Dot-Position und Animation
- `src/components/Navigation.tsx` — Dot-Position und Animation
- `src/components/NotificationDot.tsx` — Animation-Klasse

