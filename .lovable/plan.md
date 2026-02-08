

# Fix: 404-Fehler auf allen Unterseiten

## Problem

Die Navigation aendert die URL zu Pfaden wie `/tasks`, `/calendar`, `/documents`, `/meetings` usw. Die Index-Komponente liest diese Pfade aus und zeigt die richtige Ansicht an. **Aber im Router gibt es nur eine Route fuer `/`** -- alle anderen Pfade fallen auf die Catch-All-Route `*` und zeigen die 404-Seite.

```text
Aktuell:
  Route "/"        --> Index (nur exakt "/")
  Route "/auth"    --> Auth
  Route "/contacts/new" --> CreateContact
  ...
  Route "*"        --> NotFound   <-- /tasks, /calendar, /documents landen HIER
```

## Loesung

Eine zusaetzliche Route `/:section` hinzufuegen, die alle Sections-Pfade an die Index-Komponente weiterleitet:

```text
Neu:
  Route "/"              --> Index
  Route "/auth"          --> Auth
  Route "/contacts/new"  --> CreateContact
  Route "/contacts/:id"  --> ContactDetail
  ...alle spezifischen Routen...
  Route "/:section"      --> Index   <-- /tasks, /calendar, /documents landen HIER
  Route "*"              --> NotFound (nur noch fuer wirklich unbekannte Pfade)
```

React Router v6 verwendet Score-basiertes Matching, nicht Reihenfolge. Spezifische Routen wie `/contacts/new` oder `/tasks/archive` haben einen hoeheren Score als `/:section` und werden immer zuerst gematcht.

## Aenderung

**Datei: `src/App.tsx`**

Eine Zeile hinzufuegen -- direkt vor der Catch-All-Route:

```tsx
<Route path="/:section" element={<Index />} />
```

Das ist alles. Die Index-Komponente hat bereits die Logik (`getActiveSectionFromPath`), um den Pfad auszulesen und die richtige Ansicht zu rendern.

