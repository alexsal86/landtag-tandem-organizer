
# Plan: 12 Verbesserungen fuer Dokumente, Briefe, Presse und Navigation

## Uebersicht der Aenderungen

| Nr | Problem | Loesung |
|----|---------|---------|
| 1 | Brief-Editor oeffnet sich im Vollbild (`fixed inset-0`) ohne Header/Navigation | LetterEditor von `fixed inset-0` auf ein Inline-Layout umbauen, das innerhalb des DocumentsView bleibt |
| 2 | Editor-Hintergrund bei Presse nicht weiss | `bg-white dark:bg-card` auf die Editor-ContentEditable setzen |
| 3-5 | "TypeError: Failed to fetch" bei Speichern/Freigabe/Genehmigung | Resilientes Muster anwenden: Bei "Failed to fetch" optimistischen Zustand beibehalten, Daten nach 500ms verifizieren |
| 6 | Nicht protokolliert, wer Presse auf Ghost veroeffentlicht hat | Neue Spalte `published_by` in `press_releases`, Edge Function aktualisieren, Anzeige in Card |
| 7 | Universelle Standard-Tags fuer neue Pressemitteilungen | Einstellung ueber `app_settings`-Tabelle mit Key `press_default_tags`, UI in Presse-Bereich |
| 8 | URL-Slug automatisch aus Titel generieren | Bei Titelaenderung automatisch Slug generieren (Umlaute, Sonderzeichen, Leerzeichen beruecksichtigen) |
| 9 | Titelbild aus Dokumenten oder Unsplash waehlen | Titelbild-Auswahl-Dialog mit Tab "Dokumente" (aus Supabase Storage) und Tab "Unsplash" (API) |
| 10 | Sidebar bei Presse soll nicht separat scrollen | ScrollArea entfernen, Sidebar und Editor in ein gemeinsames scrollbares Layout integrieren |
| 11 | Entscheidungen oeffnet sich ohne Header/Navigation | Route `/decisions` entfernen, da `/:section` mit `decisions` bereits im Index behandelt wird |
| 12 | Dokumente/Planungen/Team haben anderen Abstand | `min-h-screen p-6` und `max-w-7xl mx-auto` durch einheitliches Padding ersetzen |

---

## Technische Details

### 1. Brief-Editor: Inline statt Vollbild

**Datei:** `src/components/LetterEditor.tsx`

Der LetterEditor nutzt aktuell `fixed inset-0 z-50` (Zeile 1069), was ihn als Vollbild-Overlay rendert. Die Loesung:

- `fixed inset-0 z-50` entfernen
- Stattdessen rendert er sich inline innerhalb des DocumentsView
- Der bestehende `isOpen`-Check (Zeile 1066: `if (!isOpen) return null;`) bleibt erhalten
- Das aeussere div wird zu einem normalen `flex flex-col` Container
- Header und Navigation bleiben sichtbar, da der Editor jetzt innerhalb des normalen Layouts sitzt

### 2. Weisser Editor-Hintergrund bei Presse

**Datei:** `src/components/EnhancedLexicalEditor.tsx`

Die ContentEditable bekommt `bg-white dark:bg-card` als zusaetzliche Klasse (Zeile 208).

### 3-5. "Failed to fetch" resilient behandeln

**Datei:** `src/components/press/PressReleaseEditor.tsx`

Alle drei Aktionen (Speichern, Zur Freigabe senden, Freigeben) rufen nach dem Fehler `loadPressRelease` auf. Bei "Failed to fetch" zeigen wir keinen Fehler-Toast, sondern verifizieren nach 500ms den tatsaechlichen DB-Zustand:

```tsx
} catch (error: any) {
  if (error.message?.includes('Failed to fetch')) {
    // Netzwerk-Fehler: Verifiziere nach kurzer Wartezeit
    setTimeout(async () => {
      await loadPressRelease(pressRelease.id);
      toast({ title: "Gespeichert" });
    }, 500);
    return;
  }
  toast({ title: "Fehler", description: error.message, variant: "destructive" });
}
```

Dieses Muster wird bereits in der App fuer andere Mutationen verwendet (siehe Memory: resilient-mutation-pattern).

### 6. Protokollierung wer auf Ghost veroeffentlicht hat

**Datenbank-Migration:**
```sql
ALTER TABLE press_releases ADD COLUMN published_by uuid REFERENCES auth.users(id);
```

**Edge Function:** `supabase/functions/publish-to-ghost/index.ts` - Die `userId` (aus den JWT-Claims bereits vorhanden) wird beim Update mitgespeichert:
```tsx
.update({
  status: 'published',
  published_at: new Date().toISOString(),
  published_by: userId,  // NEU
  ghost_post_id: ghostPost?.id,
  ghost_post_url: ghostPost?.url,
})
```

**PressReleasesList.tsx:** Bei veroeffentlichten Karten wird "Veroeffentlicht am X von Y" angezeigt. Dazu muss `published_at` und `published_by` mit in den Select und das Profil des Publishers geladen werden.

**PressReleaseEditor.tsx:** Im "Published Link" Banner wird ebenfalls "Veroeffentlicht von [Name] am [Datum]" angezeigt.

### 7. Universelle Standard-Tags fuer Pressemitteilungen

**Kein neues DB-Schema noetig** -- die bestehende `app_settings`-Tabelle (mit `setting_key`/`setting_value`/`tenant_id`) wird genutzt.

**Neuer Settings-Bereich:** Im Presse-Tab (PressReleasesList) kommt ein Settings-Button, der ein Dialog oeffnet. Dort kann man kommagetrennte Standard-Tags eingeben, die als `press_default_tags` in `app_settings` gespeichert werden.

**Bei "Neue Pressemitteilung":** PressReleaseEditor laedt die Standard-Tags aus `app_settings` und setzt sie als Initialwert fuer `tagsInput`, wenn es eine neue Pressemitteilung ist (kein `pressReleaseId`).

### 8. URL-Slug automatisch aus Titel generieren

**Datei:** `src/components/press/PressReleaseEditor.tsx`

Eine Hilfsfunktion `generateSlug(title)`:
```tsx
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/ae/g, 'ae').replace(/oe/g, 'oe').replace(/ue/g, 'ue')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};
```

Im `onChange` des Titel-Inputs wird der Slug automatisch aktualisiert -- aber nur, wenn der Slug bisher leer war oder dem alten automatisch generierten Slug entspricht (damit manuell bearbeitete Slugs nicht ueberschrieben werden).

### 9. Titelbild aus Dokumenten oder Unsplash

**Neue Komponente:** `src/components/press/FeatureImagePicker.tsx`

Ein Dialog mit zwei Tabs:
- **Dokumente:** Laedt Bild-Dokumente aus Supabase Storage (`documents`-Tabelle, gefiltert auf Bild-Dateitypen), zeigt Thumbnails. Bei Klick wird die oeffentliche URL uebernommen.
- **URL:** Manuelles Eingabefeld fuer externe Bild-URLs (Unsplash oder andere).

Unsplash-API-Integration waere moeglich, erfordert aber einen API-Key. Daher wird zunachst ein URL-Eingabefeld angeboten plus die Moeglichkeit, Bilder aus den eigenen Dokumenten auszuwaehlen. Das Bild wird bei Ghost-Veroeffentlichung als `feature_image` uebergeben (das passiert bereits).

### 10. Sidebar bei Presse: Kein separates Scrollen

**Datei:** `src/components/press/PressReleaseEditor.tsx`

Die `ScrollArea` um die Sidebar (Zeile 381) wird entfernt. Das gesamte Layout aendert sich:
- Editor und Sidebar nebeneinander ohne separate Scroll-Container
- Die aeussere Seite scrollt als Ganzes
- Auf Mobile bleiben Sidebar und Editor uebereinander gestapelt

### 11. Entscheidungen-Route reparieren

**Datei:** `src/App.tsx`

Die dedizierte Route `/decisions` (Zeile 71) entfernen. Der Pfad `/decisions` wird dann von der `/:section`-Route aufgefangen und an Index weitergeleitet, wo `DecisionOverview` bereits als case `decisions` gerendert wird (Zeile 149 in Index.tsx) -- mit Header und Navigation.

### 12. Einheitliche Abstande fuer Dokumente, Planungen und Team

**Dateien:** `DocumentsView.tsx`, `EventPlanningView.tsx`, `EmployeesView.tsx`

Das Pattern `min-h-screen bg-gradient-subtle p-6` erzeugt eigenes Padding. Da die Index-Komponente den Inhalt bereits in einem scrollbaren Container rendert, ist `min-h-screen` ueberfluessig und `p-6` muss zum einheitlichen Wert angepasst werden.

Andere Views wie `TasksView` nutzen dasselbe Pattern (`min-h-screen bg-gradient-subtle p-6`), daher ist das konsistent. Aber wenn der Abstand sich unterscheidet, liegt es vermutlich an zusaetzlichen Wrappern. Die Loesung: Alle drei Views bekommen dasselbe Layout-Pattern wie TasksView -- also das gleiche Padding und die gleichen Container-Klassen.

---

## Aenderungs-Reihenfolge

1. **DB-Migration:** Spalte `published_by` hinzufuegen
2. **Edge Function:** `publish-to-ghost` aktualisieren (published_by speichern)
3. **LetterEditor:** Von `fixed inset-0` auf Inline umbauen
4. **PressReleaseEditor:** Slug-Generierung, resiliente Fehlerbehandlung, ScrollArea entfernen, Publisher-Anzeige
5. **PressReleasesList:** Publisher-Info in Cards, Settings-Button fuer Standard-Tags
6. **FeatureImagePicker:** Neue Komponente fuer Titelbild-Auswahl
7. **EnhancedLexicalEditor:** Weisser Hintergrund
8. **App.tsx:** `/decisions`-Route entfernen
9. **DocumentsView/EventPlanningView/EmployeesView:** Einheitliche Abstande

---

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/App.tsx` | Route `/decisions` entfernen |
| `src/components/LetterEditor.tsx` | `fixed inset-0` durch Inline-Layout ersetzen |
| `src/components/EnhancedLexicalEditor.tsx` | Weisser Hintergrund |
| `src/components/press/PressReleaseEditor.tsx` | Slug-Generierung, resiliente Fehlerbehandlung, ScrollArea weg, Publisher-Anzeige, Standard-Tags laden |
| `src/components/press/PressReleasesList.tsx` | Publisher-Info, Settings-Dialog |
| `src/components/press/FeatureImagePicker.tsx` | Neue Komponente |
| `src/components/DocumentsView.tsx` | Abstand anpassen |
| `src/components/EventPlanningView.tsx` | Abstand anpassen |
| `src/components/EmployeesView.tsx` | Abstand anpassen |
| `supabase/functions/publish-to-ghost/index.ts` | `published_by` speichern |
| DB-Migration | `published_by`-Spalte |
