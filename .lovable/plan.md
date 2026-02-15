# Plan: 5 Bugfixes und RSVP-Erweiterungen

## 1. Sonnenblume/Logo in der Tab-Leiste

**Problem:** Das Logo im Dashboard-Tab hat die Klasse `h-5 w-5` (20x20px) -- zu klein. Auf mobilen Geraeten wird der gleiche Tab gerendert, aber moeglicherweise nicht sichtbar wegen Overflow.

**Loesung:**

- In `src/components/MyWorkView.tsx` (Zeile 482): Logo-Groesse von `h-5 w-5` auf `h-8 w-8` erhoehen
- Sicherstellen, dass der Dashboard-Tab (mit `isLogo: true`) auch auf Mobilgeraeten angezeigt wird -- der Tab hat `label: ""`, daher nur das Icon. Pruefen ob `overflow-x-auto` ihn abschneidet und ggf. `flex-shrink-0` setzen

**Datei:** `src/components/MyWorkView.tsx` (Zeile 478-488)

---

## 2. Favicon = Seitenlogo

**Problem:** Der `useFavicon`-Hook existiert bereits und wird in `AppNavigation.tsx` und `Navigation.tsx` mit `app_logo_url` aufgerufen. Das Favicon sollte also bereits funktionieren. Moegliches Problem: Die `index.html` hat kein Standard-Favicon-Tag definiert, daher koennte der Browser ein leeres Favicon cachen.

**Loesung:**

- In `index.html` ein Standard-`<link rel="icon">` Tag hinzufuegen (wird dynamisch ueberschrieben)
- Der bestehende Hook sollte funktionieren. Falls `app_logo_url` leer ist, wird kein Favicon gesetzt -- ein Fallback auf die Sonnenblume (`/src/assets/sunflower.svg`) einbauen

**Datei:** `index.html`, `src/hooks/useFavicon.ts`

---

## 3. Logo in Allgemeinen Einstellungen wird nicht angezeigt / Upload funktioniert nicht

**Problem:** Der `upsert` in `GeneralSettings.tsx` (Zeile 196) nutzt `onConflict: 'setting_key'`. Die Datenbank hat aber eine UNIQUE-Constraint nur auf `setting_key` **ohne** `tenant_id`. Das heisst: Wenn Tenant A den Wert fuer `app_logo_url` speichert und Tenant B versucht dasselbe zu tun, schlaegt der Upsert fehl, weil `setting_key` bereits existiert. Der Upsert muss die Kombination `(tenant_id, setting_key)` verwenden.

**Loesung:**

- Datenbank-Migration: Die bestehende UNIQUE-Constraint `app_settings_setting_key_key` auf `(tenant_id, setting_key)` aendern
- In `GeneralSettings.tsx` (Zeile 196): `onConflict` auf `'tenant_id,setting_key'` aendern
- Logo-Anzeige: Sicherstellen, dass `logoPreviewUrl` korrekt das Bild laedt (ggf. `crossOrigin="anonymous"` hinzufuegen)

**Dateien:** `src/components/GeneralSettings.tsx`, SQL-Migration

---

## 4. Vorschau bei Erfolgs-Animationen bricht ab

**Problem:** `UnicornAnimation.tsx` nutzt `React.useId()` (Zeilen 36-40), aber importiert `React` nicht als Modul-Variable. Der Build-Error bestaetigt: "React refers to a UMD global, but the current file is a module."

**Loesung:**

- In `src/components/celebrations/UnicornAnimation.tsx`: `import React` hinzufuegen (Zeile 1 erweitern um `React`)

**Datei:** `src/components/celebrations/UnicornAnimation.tsx` (Zeile 1)

---

## 5. RSVP-System Erweiterungen

**Aktuelle Struktur:** `EventRSVPManager.tsx` hat ein einfaches System: Kontakte auswaehlen, sofort Einladungen versenden, Status anzeigen (accepted/declined/invited). Es fehlen: Vormerken, verzoegertes Senden, Mail-Anpassung, Erinnerungen, Tracking, "tentative"-Anzeige, Hinweise an Angemeldete.

### 5a. Datenbank-Erweiterungen

Neue Spalten fuer `event_rsvps`:

- `reminder_sent_at` (timestamptz) -- wann Erinnerung verschickt wurde
- `reminder_count` (integer, default 0) -- Anzahl Erinnerungen
- `invitation_sent` (boolean, default false) -- ob Einladung tatsaechlich verschickt wurde (fuer Vormerken)
- `notes_sent` (jsonb, default '[]') -- Array von gesendeten Hinweisen mit Zeitstempel

Neue Tabelle `event_rsvp_distribution_lists`:

- `id` (uuid)
- `event_planning_id` (uuid)
- `distribution_list_id` (uuid)
- `added_at` (timestamptz)

### 5b. Vormerken vs. Versenden

- Kontakte/Verteilerlisten koennen "vorgemerkt" werden (insert mit `invitation_sent = false`)
- Separater Button "Einladungen jetzt versenden" setzt `invitation_sent = true` und loest E-Mail-Versand aus
- In der Tabelle sichtbar: ob Einladung versendet wurde oder noch vorgemerkt ist

### 5c. Einladungsmail anpassen

- Neues Textfeld/Dialog zum Bearbeiten des E-Mail-Textes vor dem Versand
- Standardtext wird vorbelegt, kann individuell angepasst werden
- Text wird als Parameter an die Edge-Function `send-event-invitation` uebergeben

### 5d. Erinnerungsmail

- Button "Erinnerung senden" pro Gast oder fuer alle Ausstehenden
- Trackt `reminder_sent_at` und `reminder_count`
- In der Tabelle sichtbar: wann/ob Erinnerung gesendet wurde
- Neue Edge-Function oder Erweiterung von `send-event-invitation`

### 5e. "Vorbehalt" (tentative) in der Uebersicht

- Status `tentative` wird aktuell als Badge gerendert, aber nicht in der Zusammenfassungsleiste gezaehlt
- Fix: `const tentative = rsvps.filter(r => r.status === 'tentative').length` hinzufuegen und in der Zusammenfassung anzeigen

### 5f. Hinweise an Angemeldete versenden

- Neuer Button "Hinweis an Zugesagte senden"
- Dialog mit Textfeld fuer die Nachricht
- Sendet E-Mail an alle mit Status `accepted` (und optional `tentative`)
- Wird in `notes_sent` getrackt

### 5g. Verteilerlisten-Integration

- Im Einladungsdialog: zusaetzlich zum Kontakt-Selektor ein Verteilerlisten-Selektor
- Laedt alle Kontakte der ausgewaehlten Liste und fuegt sie als Einzeleintraege hinzu

**Dateien:**

- `src/components/events/EventRSVPManager.tsx` (Hauptrefaktor)
- SQL-Migration fuer neue Spalten/Tabelle
- Edge-Function `send-event-invitation` (erweitern fuer Erinnerungen und Hinweise)

---

## Zusammenfassung der Aenderungen


| Datei                                              | Aenderung                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/components/MyWorkView.tsx`                    | Logo-Groesse erhoehen, mobile Sichtbarkeit                                             |
| `index.html`                                       | Standard-Favicon-Tag                                                                   |
| `src/hooks/useFavicon.ts`                          | Fallback-Favicon                                                                       |
| `src/components/GeneralSettings.tsx`               | onConflict-Fix, crossOrigin                                                            |
| SQL-Migration                                      | UNIQUE-Constraint aendern, event_rsvps Spalten                                         |
| `src/components/celebrations/UnicornAnimation.tsx` | React-Import hinzufuegen                                                               |
| `src/components/events/EventRSVPManager.tsx`       | Vormerken, Erinnerungen, Mail-Anpassung, Hinweise, tentative-Zaehlung, Verteilerlisten |
| Edge-Function `send-event-invitation`              | Erinnerung, Hinweis-Mails, Custom-Text                                                 |
