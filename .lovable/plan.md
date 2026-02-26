

# Plan: Briefvorlagen-Einstellungen, Betreff-Integration und Vorlagen-Anbindung

## Uebersicht

Drei zusammenhaengende Aenderungen am Brief-System:
1. Einstellungsseite fuer Briefvorlagen (Variablen, DIN 5008 Werte)
2. Betreff in den Inhaltsbereich integrieren (mit Anrede-Logik)
3. Briefvorlagen in der Briefvorschau (Akten/Dokumente/Briefe) nutzen

---

## 1. Einstellungsseite fuer Briefvorlagen

**Ziel:** Button "Einstellungen" auf der Briefvorlagen-Seite, der zu einer Konfigurationsseite fuehrt.

**Neue Datei:** `src/components/letters/LetterTemplateSettings.tsx`

Inhalte der Seite:
- **Variablen-Uebersicht:** Tabelle aller verfuegbaren Variablen (z.B. `{{bearbeiter}}`, `{{datum}}`, `{{telefon}}`) mit ihren aktuellen Standardwerten. Werte koennen bearbeitet werden und werden in den `sender_information` bzw. als tenant-spezifische Einstellungen gespeichert.
- **DIN 5008 Masse:** Editierbare Felder fuer alle Layout-Werte aus `DEFAULT_DIN5008_LAYOUT` (Seitenraender, Header-Hoehe, Adressfeld-Position/Masse, Info-Block-Position/Masse, Betreff-Position, Inhalt-Bereich, Footer-Position/Hoehe). Aenderungen wirken als Basis-Defaults fuer neue Templates.

**Aenderungen in `LetterTemplateManager.tsx`:**
- Settings-Icon-Button neben "Neues Template" einfuegen
- State `showSettings` steuert Anzeige der Settings-Komponente (ersetzt Template-Liste)

**Datenbank:** Neue Tabelle `letter_template_settings` mit Spalten:
- `id`, `tenant_id`, `variable_defaults` (JSONB), `din5008_defaults` (JSONB), `created_at`, `updated_at`

---

## 2. Betreff in den Inhaltsbereich integrieren

**Ziel:** Betreff ist laut DIN 5008 der oberste Punkt im Inhaltsbereich, gefolgt von 2 Leerzeilen, dann Anrede, dann 1 Leerzeile, dann Brieftext.

### Aenderungen am Layout-Typ (`src/types/letterLayout.ts`):
- `subject`-Block erhaelt neue Felder: `fontSize`, `fontWeight`, `integrated: boolean` (ob in Content integriert)
- Neuer Block `salutation` wird hinzugefuegt: `{ template: string, fontSize: number }` mit Default `"Sehr geehrte Damen und Herren,"`

### Neue Variablen fuer Anrede (`src/lib/letterVariables.ts`):
- `{{anrede}}` - automatisch generiert basierend auf Empfaenger-Geschlecht/Titel
- `{{anrede_name}}` - "Herr/Frau Nachname"
- Logik: Wenn Kontakt maennlich -> "Sehr geehrter Herr [Name],", weiblich -> "Sehr geehrte Frau [Name],", unbekannt -> "Sehr geehrte Damen und Herren,"

### Aenderungen in `DIN5008LetterLayout.tsx`:
- Betreff wird als erster Block im Content-Bereich gerendert (Position 98.46mm)
- Danach 2 Leerzeilen (ca. 9mm bei 11pt)
- Dann Anrede-Zeile aus Template-Variable
- Dann 1 Leerzeile (ca. 4.5mm)
- Dann der eigentliche Briefinhalt
- Der separate Subject-Block bleibt als Fallback fuer Templates ohne Integration

### Aenderungen im Tab-System (`LetterTemplateManager.tsx`):
- "Betreff"-Tab wird umbenannt zu "Betreff und Anrede"
- Neue Eingabefelder: Anrede-Template (Dropdown mit Vorlagen + Freitext)
- Option: "Betreff als Canvas-Element" vs. "Betreff als Textzeile im Inhalt"

### Aenderungen in `LetterEditor.tsx`:
- Der Betreff-Input in der Sidebar bleibt bestehen
- Bei der Vorschau wird der Betreff + Anrede automatisch vor dem Content eingefuegt
- Der Content-Editor startet nach der Anrede

---

## 3. Briefvorlagen in der Briefvorschau integrieren

**Ziel:** Wenn ein Brief ueber den Wizard oder direkt erstellt wird, werden die Template-Daten (Header, Footer, Adressfeld-Lines, Info-Block-Lines, Betreff, Anrede) automatisch in die DIN 5008 Vorschau geladen.

### Aktuelle Situation:
Die Integration existiert bereits teilweise - `LetterEditor.tsx` hat `substitutedBlocks` (Zeilen 1093-1135), die `blockContent` aus dem Template liest und Variablen substituiert. Diese werden an `DIN5008LetterLayout` uebergeben.

### Was fehlt / verbessert werden muss:

**a) Vollstaendige Template-Daten laden (`LetterEditor.tsx`):**
- `fetchCurrentTemplate` laedt bereits das Template inkl. `layout_settings`
- Sicherstellen, dass `layout_settings` an `DIN5008LetterLayout` weitergereicht wird (bereits der Fall ueber `layoutSettings` prop)
- Sicherstellen, dass Header-Elemente aus `header_text_elements` korrekt gerendert werden

**b) Anrede-Integration in die Vorschau:**
- `buildVariableMap` um `{{anrede}}` erweitern
- In `DIN5008LetterLayout` die Anrede zwischen Betreff und Content einbauen
- Template-Einstellung fuer Anrede-Muster beruecksichtigen

**c) Wizard-Anbindung (`LetterWizard.tsx`):**
- Der Wizard gibt bereits `templateId` zurueck
- Sicherstellen, dass der LetterEditor nach Wizard-Abschluss das Template vollstaendig laedt und anwendet
- Die `applyTemplateDefaults`-Funktion erweitern um Anrede-Template

---

## Technischer Ablauf

### Datenbankschema
```sql
CREATE TABLE letter_template_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  variable_defaults JSONB DEFAULT '{}',
  din5008_defaults JSONB DEFAULT '{}',
  salutation_templates JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);
ALTER TABLE letter_template_settings ENABLE ROW LEVEL SECURITY;
```

### Dateien die erstellt werden
- `src/components/letters/LetterTemplateSettings.tsx` - Einstellungsseite

### Dateien die geaendert werden
- `src/components/LetterTemplateManager.tsx` - Settings-Button, Tab-Umbenennung
- `src/types/letterLayout.ts` - Salutation-Block, Subject-Integration-Flag
- `src/lib/letterVariables.ts` - Anrede-Variable
- `src/components/letters/DIN5008LetterLayout.tsx` - Betreff+Anrede im Content
- `src/components/LetterEditor.tsx` - Anrede-Logik, Template-Defaults erweitern
- `src/components/letters/BlockLineEditor.tsx` - Anrede-Variablen

### Reihenfolge der Implementierung
1. DB-Migration fuer `letter_template_settings`
2. `LetterTemplateSettings.tsx` erstellen
3. Settings-Button in `LetterTemplateManager.tsx` einfuegen
4. Layout-Typ erweitern (salutation)
5. Variablen-System um Anrede erweitern
6. DIN5008LetterLayout um Betreff+Anrede im Content erweitern
7. LetterEditor Anrede-Logik und Template-Integration finalisieren

