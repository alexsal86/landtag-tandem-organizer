
# Plan: 5 Fehlerbehebungen & Features

## Zusammenfassung der Issues

1. **.msg Vorschau in Entscheidungen kaputt** – `EmailPreviewDialog` lädt `.msg` Dateien direkt via `supabase.storage.download(filePath)` mit dem rohen `filePath`. Dieser Pfad enthält aber möglicherweise den Bucket-Präfix oder ist URL-encodiert. Die gleiche `normalizeStoragePath`-Logik, die `DecisionAttachmentPreviewDialog` korrekt verwendet, fehlt hier komplett.

2. **Bilder-Vorschau in Entscheidungen kaputt** – In `DecisionAttachmentPreviewDialog` wird beim Öffnen einer Bildvorschau eine Signed-URL erstellt und im `<img>`-Tag angezeigt. Das Problem: Signed-URLs für private Buckets erlaufen nach 10 Minuten. Außerdem kann das Bild nicht geladen werden, wenn der `filePath` nicht korrekt normalisiert ist. Es gibt auch einen logischen Fehler: Die Kondition `isHttpUrl(filePath) && !normalizedFilePath` führt zu `setSignedUrl(filePath)`, was für private Bucket-Dateien nicht funktioniert.

3. **Termin-Feedback als neuer Tab in "Meine Arbeit"** – Das `AppointmentFeedbackWidget` existiert bereits im Dashboard-Bereich. Es muss als eigener Tab in `MyWorkView` eingebettet werden. Dieser Tab soll nur für die Rolle `abgeordneter` sichtbar sein (wie vom Nutzer beschrieben).

4. **Excel/Word-Dateien in Entscheidungen sollen scrollbar sein** – In `DecisionAttachmentPreviewDialog` sind die inneren Wrapper von `ExcelPreview` und `WordPreview` schon mit `overflow-auto` versehen. Das Problem liegt am äußeren Container: `<div className="flex-1 min-h-[60vh] border rounded-md overflow-hidden bg-muted/20">` – `overflow-hidden` schneidet den Scrollbereich ab. Außerdem verhindert `max-h-[90vh]` auf dem Dialog-Content, dass der innere Bereich genügend Platz zum Scrollen hat.

5. **Termin-Details im Split-Layout statt rechtem Popup** – `AppointmentDetailsSidebar` verwendet aktuell `Sheet` (rechtes Overlay). Der Nutzer möchte dasselbe Split-Layout-Muster wie bei `ContactsView`, wo ein Inline-Panel neben der Liste eingeblendet wird (kein Overlay). Die `CalendarView` muss entsprechend umgebaut werden.

---

## Änderungen im Detail

### Issue 1: .msg Vorschau reparieren

**Datei:** `src/components/task-decisions/EmailPreviewDialog.tsx`

- Dieselbe `normalizeStoragePath`-Funktion importieren/einbauen (oder inline definieren), die in `DecisionAttachmentPreviewDialog` bereits existiert und funktioniert.
- Den rohen `download(filePath)` Aufruf ersetzen durch: erst `createSignedUrl` mit normalisiertem Pfad, Fallback auf `download` wenn Signed-URL fehlschlägt.
- Damit ist die Logik konsistent mit dem funktionierenden `DecisionAttachmentPreviewDialog`.

### Issue 2: Bilder-Vorschau reparieren

**Datei:** `src/components/task-decisions/DecisionAttachmentPreviewDialog.tsx`

- Den Logikfehler beheben: Wenn `filePath` eine HTTP-URL ist, soll trotzdem eine normalisierte Pfad-Extraktion stattfinden und eine Signed-URL via Supabase Storage erstellt werden – nicht die rohe HTTP-URL direkt nutzen.
- Den existierenden Fallback-Download-Mechanismus (Blob-URL) als letzten Ausweg beibehalten.
- Für die Bild-Vorschau explizit sicherstellen, dass bei Bild-Typen ein `onError`-Handler gesetzt wird, der auf den Download-Fallback ausweicht.

### Issue 3: Termin-Feedback Tab in Meine Arbeit (nur für Abgeordnete)

**Dateien:**
- `src/components/MyWorkView.tsx`
- Neues `src/components/my-work/MyWorkAppointmentFeedbackTab.tsx` (thin wrapper)

**Änderungen:**
- Neuen Tab-Wert `"appointmentfeedback"` in `TabValue` hinzufügen.
- Tab-Konfiguration in `BASE_TABS` mit `abgeordneterOnly: true` Flag ergänzen.
- Filter-Logik: Tab nur anzeigen wenn `isAbgeordneter === true`.
- Lazy-Load des neuen `MyWorkAppointmentFeedbackTab`, das `AppointmentFeedbackWidget` als Vollseiten-Ansicht rendert (kein Widget-Sizing, volle Breite).
- Tab-Label: "Termine Feedback", Icon: `CheckCircle2`.

### Issue 4: Excel/Word scrollbar machen

**Datei:** `src/components/task-decisions/DecisionAttachmentPreviewDialog.tsx`

- Den äußeren Container-`div` von `overflow-hidden` auf `overflow-auto` ändern.
- Die Dialog-Content-Klasse anpassen: Statt `overflow-hidden` muss der Preview-Container die Scroll-Kontrolle übernehmen. Die inneren Komponenten (`ExcelPreview`, `WordPreview`) haben bereits `overflow-auto`, funktionieren aber nur, wenn der äußere Container eine feste Höhe hat und nicht `overflow-hidden` blockiert.
- Lösung: `<div className="flex-1 min-h-[60vh] border rounded-md overflow-auto bg-muted/20">` – nur `overflow-hidden` durch `overflow-auto` ersetzen. Der Dialog selbst bleibt `overflow-hidden` (für den Header), nur der Preview-Bereich scrollt.

### Issue 5: Termin-Details im Split-Layout (kein rechtes Popup)

**Dateien:**
- `src/components/CalendarView.tsx`
- `src/components/calendar/AppointmentDetailsSidebar.tsx`

**Änderungen:**

Die `AppointmentDetailsSidebar` verwendet intern `Sheet` / `SheetContent`. Diese Wrapper werden entfernt und durch ein scrollbares `<div>` ersetzt, das als Inline-Panel gerendert wird.

Das Layout in `CalendarView` wird umgebaut:
```text
VORHER:
┌─────────────────────────────┐
│ Kalender (Vollbreite)       │
└─────────────────────────────┘
↓ Sheet schiebt sich von rechts als Overlay

NACHHER:
┌────────────────┬────────────────┐
│ Kalender       │ Detail-Panel   │  ← beide nebeneinander
└────────────────┴────────────────┘
   flex-1 min-w-0    w-[420px]
```

- Das `<div className="w-full">` in CalendarView wird zu `<div className="flex gap-4">`.
- Linke Seite: `<div className="flex-1 min-w-0">` mit dem Kalender.
- Rechte Seite: `{sidebarOpen && <div className="w-[420px] shrink-0 border-l ...">}` mit dem neuen Inline-Panel.
- Das Panel gleitet mit `transition-all` ein/aus.
- `AppointmentDetailsSidebar` erhält eine neue Variante ohne Sheet-Wrapper (oder ein neues Prop `mode="inline"`), das den Inhalt direkt als `<div>` rendert.
- Der `onClose`-Button oben rechts im Panel bleibt erhalten.

---

## Technische Risiken & Hinweise

- **Issue 5 Impact:** Die `AppointmentDetailsSidebar` hat ~964 Zeilen. Die Änderung betrifft nur den äußersten Wrapper (Sheet → div) und das Layout in `CalendarView`. Der Inhalt selbst bleibt unverändert.
- **Issue 3:** `AppointmentFeedbackWidget` hat ein `widgetSize`-Prop. Im neuen Tab wird `widgetSize="full"` oder kein Sizing verwendet, damit es die volle Breite ausfüllt.
- Die `EmailPreviewDialog`-Logik ist in Issue 1 und Issue 2 eng verwandt – beide bekommen dieselbe robuste URL-Normalisierung.

## Geänderte Dateien

| Datei | Aktion |
|-------|--------|
| `src/components/task-decisions/EmailPreviewDialog.tsx` | Fix: normalizeStoragePath + Signed-URL-Logik |
| `src/components/task-decisions/DecisionAttachmentPreviewDialog.tsx` | Fix: Bild-Logik + overflow-auto |
| `src/components/my-work/MyWorkAppointmentFeedbackTab.tsx` | Neu erstellen |
| `src/components/MyWorkView.tsx` | Neuer Tab "Termin-Feedback" (nur abgeordneter) |
| `src/components/calendar/AppointmentDetailsSidebar.tsx` | Sheet → Inline-div-Variante |
| `src/components/CalendarView.tsx` | Split-Layout statt Sidebar-Overlay |
