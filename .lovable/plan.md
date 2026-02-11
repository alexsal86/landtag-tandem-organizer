# Plan: Mobile-Fixes, E-Mail-Vorschau, Kontakt-Layout und Performance

## 1. Mobile Navigation reparieren und modernisieren (Punkte 1 + 2 + 3)

### Problem

In `MobileHeader.tsx` Zeile 85 wird `onSectionChange={() => setMobileNavOpen(false)}` uebergeben -- das schliesst nur das Sheet, navigiert aber nirgendwohin. Ausserdem wird `activeSection=""` uebergeben, sodass kein aktiver Menuepunkt hervorgehoben wird.

### Loesung

`MobileHeader` muss `useNavigate` und die aktive Section aus der URL kennen. Der `onSectionChange`-Callback muss die Navigation ausfuehren UND das Sheet schliessen.

**Aenderungen in `MobileHeader.tsx`:**

- `useNavigate()` und `useLocation()` importieren
- `activeSection` aus `location.pathname` ableiten (gleiche Logik wie `Index.tsx`)
- `onSectionChange` ersetzen durch eine Funktion, die navigiert UND `setMobileNavOpen(false)` aufruft:
  ```text
  onSectionChange={(section) => {
    navigate(section === 'dashboard' ? '/' : `/${section}`);
    setMobileNavOpen(false);
  }}
  ```
- `activeSection={activeSection}` statt `activeSection=""`
- Logo: `crossOrigin="anonymous"` hinzufuegen (wie in `AppNavigation.tsx`), um CORS-Fehler bei externen Logo-URLs zu vermeiden

### Modernisierung

- Das `AppNavigation` im Sheet hat `h-screen` (Zeile 431), was im mobilen Sheet zu Overflow-Problemen fuehren kann. Fuer den mobilen Kontext wird `h-full` verwendet.
- In `AppNavigation.tsx` den `isMobile`-Prop nutzen, um `h-screen` durch `h-full` zu ersetzen wenn `isMobile=true`
- `MobileHeader` soll `isMobile={true}` an `AppNavigation` uebergeben

### Sonstige Mobile-Fehler

- `ContactsView.tsx`: Die Header-Buttons (Zeile 423-448) sind nicht responsive -- sie werden auf Mobile nebeneinander angezeigt und laufen ueber. Fix: `flex-wrap` hinzufuegen und auf Mobile kleinere Buttons zeigen
- `MyWorkDecisionCard.tsx`: Metadata-Row (Zeile 192) kann auf Mobile ueberlaufen -- `overflow-x-auto` hinzufuegen

**Dateien:** `MobileHeader.tsx`, `AppNavigation.tsx`, `ContactsView.tsx`, `MyWorkDecisionCard.tsx`

---

## 2. E-Mail-Vorschau in Decision-Cards ermoeglichen (Punkt 4)

### Problem

Im Popover (Zeile 249-254 in `MyWorkDecisionCard.tsx`) werden die E-Mail-Dateien nur als Liste mit Dateinamen angezeigt. Ein Klick oeffnet nichts -- es gibt keinen Button und keinen Verweis auf den `EmailPreviewDialog`.

### Loesung

- `EmailPreviewDialog` in `MyWorkDecisionCard.tsx` importieren
- State fuer `previewEmail` (file_path + file_name) hinzufuegen
- Jede E-Mail in der Popover-Liste wird klickbar (cursor-pointer, hover-Stil)
- Klick setzt `previewEmail` und oeffnet den `EmailPreviewDialog`
- Die `emailAttachments`-Daten enthalten bereits `file_path` und `file_name` (im Interface `types.ts` Zeile 20)

```text
// Im Popover:
<button onClick={() => setPreviewEmail(att)} className="...">
  <Mail className="h-3 w-3" />
  <span className="truncate">{att.file_name}</span>
</button>

// Ausserhalb der Card:
<EmailPreviewDialog
  open={!!previewEmail}
  onOpenChange={() => setPreviewEmail(null)}
  filePath={previewEmail?.file_path || ''}
  fileName={previewEmail?.file_name || ''}
/>
```

**Datei:** `MyWorkDecisionCard.tsx`

---

## 3. Kontakte: Detail-Ansicht als Seitenbereich statt Sheet (Punkt 5)

### Aktuell

`ContactsView` oeffnet `ContactDetailSheet` -- ein Sheet von rechts, das ueber den Inhalt gleitet.

### Gewuenscht

Ein Layout wie bei Administration: links die Kontaktliste, rechts die Detail-Ansicht als fester Bereich innerhalb des Layouts (kein Overlay).

### Loesung

- `ContactsView.tsx` bekommt ein Split-Layout:
  ```text
  <div className="flex h-[calc(100vh-3.5rem)]">
    <div className={cn("flex-1 overflow-y-auto", selectedContactId && "hidden md:block md:w-1/2 lg:w-2/5")}>
      {/* Kontaktliste */}
    </div>
    {selectedContactId && (
      <div className="w-full md:w-1/2 lg:w-3/5 border-l overflow-y-auto">
        <ContactDetailPanel contactId={selectedContactId} onClose={() => setSelectedContactId(null)} />
      </div>
    )}
  </div>
  ```
- `ContactDetailSheet` wird durch eine neue Komponente `ContactDetailPanel` ersetzt, die den gleichen Inhalt zeigt aber ohne Sheet-Wrapper
- Auf Mobile: Die Detail-Ansicht nimmt den gesamten Bildschirm ein (mit Zurueck-Button)
- `ContactDetailPanel` extrahiert die Inhalte aus `ContactDetailSheet` (der Sheet-Wrapper wird entfernt, der Inhalt bleibt)
- `isSheetOpen` und `setIsSheetOpen` werden durch `selectedContactId` allein gesteuert

**Dateien:** `ContactsView.tsx`, neues `ContactDetailPanel.tsx` (basierend auf `ContactDetailSheet.tsx`)

---

## 4. Seitenperformance erhoehen (Punkt 6)

Bereits umgesetzte Massnahmen: Lazy Loading aller Views (Zeile 10-31 in `Index.tsx`), Infinite Scrolling fuer Kontakte, debounced Search.

### Weitere Moeglichkeiten


| Massnahme                                                                                             | Aufwand | Wirkung                                    |
| ----------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------ |
| **React.memo fuer Cards** (DecisionCard, ContactCard)                                                 | Gering  | Reduziert Re-Renders bei Listen            |
| **Virtualisierung** (react-window / react-virtual) fuer lange Listen                                  | Mittel  | Drastische Verbesserung bei 100+ Elementen |
| **Supabase-Queries optimieren**: Nur benoetigte Spalten selektieren statt `*`                         | Gering  | Weniger Daten ueber die Leitung            |
| **Image-Optimierung**: Avatare mit `loading="lazy"` versehen                                          | Gering  | Schnellerer Initial-Load                   |
| **Bundle-Splitting**: Schwere Dependencies (leaflet, matrix-sdk, pdfjs-dist) nur laden wenn benoetigt | Mittel  | Kleinerer Initial-Bundle                   |
| **Service Worker / PWA-Caching**: Statische Assets cachen                                             | Mittel  | Schnellere Folgebesuche                    |


### Sofort umsetzbar (in diesem Plan):

- `React.memo` fuer `MyWorkDecisionCard` und Kontakt-Grid-Cards
- `loading="lazy"` fuer alle Avatar-Images
- Doppelten `useEffect` in `AppNavigation.tsx` (Zeilen 182-231 -- Badge-Tracking ist doppelt) entfernen

**Dateien:** `MyWorkDecisionCard.tsx`, `AppNavigation.tsx`, `ContactsView.tsx`

---

## Technische Zusammenfassung

### Keine DB-Aenderungen noetig

### Dateien


| Datei                          | Aenderungen                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `MobileHeader.tsx`             | Navigation reparieren (useNavigate + activeSection), Logo crossOrigin            |
| `AppNavigation.tsx`            | `h-screen` -> `h-full` wenn isMobile, doppelten useEffect entfernen              |
| `MyWorkDecisionCard.tsx`       | EmailPreviewDialog einbinden, React.memo, lazy Avatare                           |
| `ContactsView.tsx`             | Split-Layout statt Sheet, responsive Header-Buttons                              |
| `ContactDetailPanel.tsx` (NEU) | Inhalte aus ContactDetailSheet als eingebettete Komponente                       |
| `ContactDetailSheet.tsx`       | Bleibt bestehen fuer Rueckwaertskompatibilitaet, nutzt intern ContactDetailPanel |
