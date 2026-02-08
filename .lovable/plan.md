
# Plan: Verteiler-Bearbeitung, Presse-E-Mail-Versand, Benachrichtigungs-Groesse und FallAkten-Fehler beheben

## Uebersicht der 7 Punkte

| Nr | Problem | Loesung |
|----|---------|---------|
| 1 | Verteiler: Bearbeiten/Speichern funktioniert nicht, Mitglieder werden nur als Badges ohne Details angezeigt | Speicherfunktion in `DistributionListForm` pruefen/fixen, Mitglieder als Tabelle mit E-Mail, Organisation, Telefon anzeigen |
| 2 | Verteiler bearbeiten hat eigene Seite ohne Navigation/Header | Route `/distribution-lists/:id/edit` in Index.tsx einbetten oder Dialog-basiert in ContactsView loesen |
| 3 | Bei Presse nach Ghost-Veroeffentlichung fehlt die Info wer veroeffentlicht hat | Bereits implementiert -- published_by wird gespeichert und angezeigt. Pruefen ob es korrekt funktioniert |
| 4 | Nach Veroeffentlichung: Button/Link fuer E-Mail-Versand an Presse mit Template | Neues Presse-Template-System in Einstellungen + Button im PressReleaseEditor nach Veroeffentlichung |
| 5 | E-Mail-Versand der Pressemitteilung soll in der Presse-Card protokolliert werden | Neue DB-Spalten `email_sent_at` und `email_sent_by` auf `press_releases` |
| 6 | Benachrichtigungs-Groesse: Normal und Gross sehen gleich aus | Sonner-CSS reparieren -- `!important`-Styles werden von Sonner ueberschrieben, alternative Loesung noetig |
| 7 | Fehler auf FallAkten-Seite, Akte "Karl Kinski" ist weg | **RLS-Policy hat infinite recursion** -- die SELECT-Policy auf `case_files` verweist auf `case_file_participants`, deren SELECT-Policy wiederum auf `case_files` verweist |

---

## Technische Details

### 1. Verteiler bearbeiten und Mitglieder-Tabelle

**Problem A: Speichern**
Der `DistributionListForm` navigiert nach dem Speichern zu `/contacts`. Beim Bearbeiten wird die bestehende Liste korrekt geladen und aktualisiert (Zeile 148-167). Das Speichern selbst sollte funktionieren. Falls es trotzdem nicht klappt, muss die `handleSave`-Funktion genauer getestet werden.

**Problem B: Mitglieder-Anzeige**
In `ContactsView.tsx` (Zeile 1224-1239) werden die Mitglieder nur als einfache `Badge`-Elemente angezeigt mit maximal 5 sichtbar:
```tsx
// Aktuell:
<Badge variant="secondary">{member.name}</Badge>
```

**Loesung: Mitglieder als Tabelle anzeigen**
Ersetze die Badge-Darstellung in der Verteilerliste durch eine kompakte Tabelle mit Spalten: Name, E-Mail, Organisation, Kategorie.

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>E-Mail</TableHead>
      <TableHead>Organisation</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {list.members.map((member) => (
      <TableRow key={member.id}>
        <TableCell>{member.name}</TableCell>
        <TableCell>{member.email || '-'}</TableCell>
        <TableCell>{member.organization || '-'}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

Ausserdem muss im `DistributionListForm` die "Ausgewaehlte Kontakte"-Vorschau ebenfalls als Tabelle dargestellt werden statt als Badges.

**Dateien:**
- `src/components/ContactsView.tsx` (Mitglieder-Tabelle)
- `src/components/DistributionListForm.tsx` (Ausgewaehlte-Kontakte-Tabelle)

---

### 2. Verteiler bearbeiten innerhalb des Layouts

**Problem:** Die Routen `/distribution-lists/new` und `/distribution-lists/:id/edit` sind in `App.tsx` als eigenstaendige Routen definiert -- ohne das Index-Layout mit Header und Navigation.

**Loesung:** Zwei Moeglichkeiten:

**Option A (empfohlen): In Index.tsx einbetten**
- In `Index.tsx` die Faelle `distribution-lists-new` und `distribution-lists-edit` hinzufuegen
- Navigation aus der Kontakte-Seite heraus per `handleSectionChange` statt `<Link to="/distribution-lists/...">`
- `DistributionListForm` bekommt einen `onBack`-Callback statt `useNavigate`

**Option B: Routen in App.tsx behalten, aber Index-Layout wrappen**
Weniger ideal, da es doppelte Layout-Logik erfordern wuerde.

Ich waehle Option A:
- `App.tsx`: Routen fuer `/distribution-lists/*` entfernen (werden durch `/:section` in Index aufgefangen)
- `Index.tsx`: Cases `distribution-lists/new` und `distribution-lists/:id/edit` im Router einbauen. Da die URL `distribution-lists/new` bereits vom `/:section`-Catch uebernommen wird, koennen wir alternativ die Verteiler-Bearbeitung als eingebetteten Zustand in `ContactsView` behandeln (Dialog-basiert oder Inline).

Noch besser: Die Verteiler-Bearbeitung als eingebettete Ansicht direkt in ContactsView laufen lassen (aehnlich wie CaseFileDetail in CaseFilesView):
- State `editingDistributionListId` und `creatingDistribution` in ContactsView
- Wenn aktiv: `DistributionListForm` als Overlay/Inline rendern statt auf separate Seite navigieren
- `DistributionListForm` bekommt `onBack`/`onSuccess` Callbacks

**Dateien:**
- `src/components/ContactsView.tsx` (eingebettete Bearbeitung)
- `src/components/DistributionListForm.tsx` (Navigation entfernen, Callbacks nutzen)
- `src/App.tsx` (Routen entfernen)
- `src/pages/CreateDistributionList.tsx` und `src/pages/EditDistributionList.tsx` (koennen entfernt werden)

---

### 3. Presse: Veroeffentlichungs-Info in der Card

**Status:** Bereits implementiert. Die Edge Function `publish-to-ghost` speichert `published_by` und `published_at`. Die `PressReleasesList.tsx` zeigt diese Info in der Card an (Zeile 276-284). Der `PressReleaseEditor.tsx` laedt den Publisher-Namen und zeigt ihn im blauen Banner an (Zeile 456-478).

Hier ist keine Aenderung noetig -- die Funktionalitaet existiert bereits. Ich werde pruefen ob es live korrekt funktioniert und ggf. kleine Verbesserungen machen (z.B. Publisher-Info auch anzeigen wenn `ghost_post_url` fehlt).

---

### 4. Presse: E-Mail-Versand-Button nach Veroeffentlichung

**Konzept:**
- Nach der Veroeffentlichung auf Ghost erscheint ein neuer Button "Per E-Mail an Presse senden" im blauen Banner des `PressReleaseEditor`
- Klick auf den Button navigiert zu Dokumente/E-Mails und befuellt den E-Mail-Composer mit Daten aus der Pressemitteilung
- In den Presse-Einstellungen (Settings-Dialog in `PressReleasesList`) kann man ein Presse-E-Mail-Template vorbereiten

**Template-System in Presse-Einstellungen:**
- Neues app_settings Feld: `press_email_template_subject` und `press_email_template_body`
- Variablen die im Template verfuegbar sind:
  - `{{titel}}` -- Titel der Pressemitteilung
  - `{{excerpt}}` -- Zusammenfassung/Excerpt
  - `{{link}}` -- Ghost-Post-URL
  - `{{datum}}` -- Veroeffentlichungsdatum
  - `{{inhalt}}` -- Volltext (HTML)
- Einstellungen-UI: Betreff-Feld und Body-Editor mit Variablen-Hilfe

**E-Mail-Versand-Flow:**
1. User klickt "Per E-Mail an Presse senden" im PressReleaseEditor
2. Navigation zu `/documents` mit Query-Parametern: `?tab=emails&action=compose-press&pressReleaseId=xxx`
3. `DocumentsView` erkennt die Parameter und oeffnet den EmailComposer mit vorbefuellten Daten
4. Das Template wird aus `app_settings` geladen und die Variablen ersetzt

**Dateien:**
- `src/components/press/PressReleaseEditor.tsx` (Button hinzufuegen)
- `src/components/press/PressReleasesList.tsx` (Template-Einstellungen im Settings-Dialog)
- `src/components/DocumentsView.tsx` (Query-Parameter fuer Presse-E-Mail erkennen)
- `src/components/emails/EmailComposer.tsx` (Presse-Daten vorbefuellen)

---

### 5. Presse: E-Mail-Versand protokollieren

**DB-Migration:**
```sql
ALTER TABLE public.press_releases
  ADD COLUMN email_sent_at timestamptz,
  ADD COLUMN email_sent_by uuid;
```

**Implementierung:**
- Nach dem Versand einer E-Mail mit Presse-Bezug: `press_releases`-Eintrag aktualisieren
- In der PressReleasesList-Card und im PressReleaseEditor anzeigen: "Per E-Mail versandt am ... von ..."
- Im EmailComposer: Nach erfolgreichem Senden der E-Mail die `press_releases`-Tabelle aktualisieren

**Dateien:**
- DB-Migration (neue Spalten)
- `src/components/emails/EmailComposer.tsx` (nach Versand protokollieren)
- `src/components/press/PressReleasesList.tsx` (Versand-Info in Card)
- `src/components/press/PressReleaseEditor.tsx` (Versand-Info im Banner)

---

### 6. Benachrichtigungs-Groesse reparieren

**Problem:** Die Sonner-Toasts ignorieren die `!important`-Styles weil Sonner intern eigene Styles setzt die hoehere Spezifitaet haben. Die aktuelle Loesung nutzt `group-[.toaster]:!w-[520px]` etc., aber das wird von Sonners internem CSS ueberschrieben.

**Root Cause:** Sonner rendert Toasts in einem Shadow-DOM-aehnlichen Container mit festen Inline-Styles. Die Tailwind `!important`-Klassen koennen Inline-Styles nicht ueberschreiben.

**Loesung:**
1. Globale CSS-Styles mit hoher Spezifitaet in `index.css`:
```css
/* Grosse Benachrichtigungen */
[data-sonner-toaster][data-theme] [data-sonner-toast].toast-large {
  width: 520px !important;
  max-width: 90vw !important;
  font-size: 1.125rem !important;
  padding: 1.5rem !important;
  border-radius: 0.75rem !important;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25) !important;
  border-width: 2px !important;
}

[data-sonner-toaster][data-theme] [data-sonner-toast].toast-large [data-description] {
  font-size: 1rem !important;
}
```

2. In `sonner.tsx` die `className` auf dem Toast verwenden statt `classNames`:
```tsx
toastOptions={{
  className: isLarge ? 'toast-large' : '',
  ...
}}
```

3. Alternative: Sonner's `style` Prop verwenden, die Inline-Styles direkt setzt und damit garantiert wirkt.

**Dateien:**
- `src/components/ui/sonner.tsx` (Toast-Klasse/Style anwenden)
- `src/index.css` (Globale CSS-Regeln fuer grosse Toasts)

---

### 7. FallAkten-Fehler: Infinite Recursion in RLS-Policy (KRITISCH)

**Root Cause gefunden:** Die Postgres-Logs zeigen dutzende `infinite recursion detected in policy for relation "case_files"` Fehler.

Die aktuelle RLS-Policy-Kette:
1. **`case_files` SELECT Policy** prueft: `id IN (SELECT case_file_id FROM case_file_participants WHERE user_id = auth.uid())`
2. **`case_file_participants` SELECT Policy** prueft: `case_file_id IN (SELECT id FROM case_files WHERE tenant_id IN (...))`

Dies erzeugt eine zirkulaere Abhaengigkeit: Um `case_files` zu lesen, muss man `case_file_participants` lesen, was wiederum `case_files` liest.

**Die Akte "Karl Kinski" ist NICHT geloescht** -- sie existiert noch in der Datenbank (visibility: public, status: active). Sie wird nur nicht angezeigt weil die RLS-Policy fehlschlaegt.

**Loesung: RLS-Policies entkoppeln**

Die `case_file_participants` SELECT-Policy darf nicht auf `case_files` zurueckverweisen. Stattdessen:

```sql
-- 1. Alte Policies entfernen
DROP POLICY IF EXISTS "Users can view accessible case files" ON public.case_files;
DROP POLICY IF EXISTS "Users can view participants of their tenant case files" ON public.case_file_participants;

-- 2. case_files: Verwende user_tenant_memberships direkt + participants ohne Umweg
CREATE POLICY "Users can view accessible case files"
  ON public.case_files FOR SELECT
  USING (
    tenant_id IN (
      SELECT utm.tenant_id FROM user_tenant_memberships utm
      WHERE utm.user_id = auth.uid() AND utm.is_active = true
    )
    AND (
      visibility = 'public'
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM case_file_participants cfp
        WHERE cfp.case_file_id = id AND cfp.user_id = auth.uid()
      )
    )
  );

-- 3. case_file_participants: Keine Abhaengigkeit auf case_files
-- Stattdessen: User kann Teilnehmer sehen wenn er selbst Teilnehmer ist,
-- Ersteller ist, oder die Akte oeffentlich ist
CREATE POLICY "Users can view case file participants"
  ON public.case_file_participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR case_file_id IN (
      SELECT cf.id FROM case_files cf
      WHERE cf.user_id = auth.uid()
    )
  );
```

Aber auch Policy 3 verweist noch auf `case_files`. Um die Rekursion komplett zu brechen, muss die `case_file_participants`-Policy **nicht** auf `case_files` zugreifen:

```sql
-- Einfachste sichere Loesung:
-- Jeder authentifizierte Benutzer kann Teilnehmer-Eintraege sehen,
-- die Sicherheit wird durch die case_files-Policy gewaehrleistet
-- (man sieht nur Akten die man sehen darf, und damit auch nur deren Teilnehmer)
CREATE POLICY "Authenticated users can view participants"
  ON public.case_file_participants FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

Da die `case_file_participants`-Daten nur ueber JOINs mit `case_files` abgefragt werden und `case_files` bereits durch RLS geschuetzt ist, ist dies sicher.

**Dateien:**
- DB-Migration (RLS-Policies korrigieren)

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| Bearbeiten | `src/components/ContactsView.tsx` (Mitglieder-Tabelle, eingebettete Verteiler-Bearbeitung) |
| Bearbeiten | `src/components/DistributionListForm.tsx` (Kontakte-Tabelle, Navigation-Callbacks) |
| Bearbeiten | `src/App.tsx` (Distribution-Routes entfernen) |
| Loeschen | `src/pages/CreateDistributionList.tsx` (nicht mehr noetig) |
| Loeschen | `src/pages/EditDistributionList.tsx` (nicht mehr noetig) |
| Bearbeiten | `src/components/press/PressReleaseEditor.tsx` (E-Mail-Button nach Veroeffentlichung) |
| Bearbeiten | `src/components/press/PressReleasesList.tsx` (Presse-Template-Einstellungen, E-Mail-Versand-Info) |
| Bearbeiten | `src/components/DocumentsView.tsx` (Presse-E-Mail Query-Parameter) |
| Bearbeiten | `src/components/emails/EmailComposer.tsx` (Presse-Daten vorbefuellen, Versand protokollieren) |
| Bearbeiten | `src/components/ui/sonner.tsx` (Groesse-Fix) |
| Bearbeiten | `src/index.css` (Globale Toast-Styles) |
| DB-Migration | `email_sent_at` und `email_sent_by` auf `press_releases` |
| DB-Migration | RLS-Policies fuer `case_files` und `case_file_participants` korrigieren |

## Reihenfolge

1. **KRITISCH: FallAkten RLS-Fix** -- behebt den Fehler und macht "Karl Kinski" wieder sichtbar
2. Verteiler: Mitglieder als Tabelle anzeigen + Bearbeitung ins Layout einbetten
3. Benachrichtigungs-Groesse reparieren (CSS-Fix)
4. Presse: E-Mail-Template-System in Einstellungen
5. Presse: E-Mail-Button nach Veroeffentlichung + DB-Migration
6. Presse: E-Mail-Versand protokollieren
