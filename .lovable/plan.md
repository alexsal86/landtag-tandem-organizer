

# Geschlecht/Anrede-Feld fuer Kontakte

## Uebersicht

Es wird eine neue Spalte `gender` (Werte: `m`, `f`, `d`) zur `contacts`-Tabelle hinzugefuegt. Das Feld wird im Erstell- und Bearbeitungsformular angezeigt und fuer die automatische Anrede-Generierung in Briefen genutzt (was im Code bereits vorbereitet ist, aber mangels Daten nicht funktioniert).

## Bestehende Kontakte aufarbeiten

Es gibt **1.016 Personen-Kontakte** mit Vornamen. Die meisten deutschen Vornamen lassen sich eindeutig zuordnen. Strategie:

1. **Automatisch per SQL**: Ein grosses Name-Mapping (ca. 200 haeufige deutsche Vornamen) wird als UPDATE-Statement ausgefuehrt, das `gender` anhand von `first_name` setzt.
2. **Uebrig gebliebene manuell**: Kontakte, bei denen `gender` nach dem Mapping noch NULL ist, koennen ueber eine Filter-Ansicht in der Kontaktliste nachgepflegt werden (bestehendes UI mit neuem Filter "Geschlecht: nicht gesetzt").

## Aenderungen

### 1. Datenbank-Migration

Neue Spalte `gender` (text, nullable) auf `contacts`:

```sql
ALTER TABLE contacts ADD COLUMN gender text;
```

### 2. Backfill-Migration (Daten-Update)

Ein SQL-Statement, das die haeufigsten deutschen Vornamen mappt:

```sql
UPDATE contacts SET gender = 'm' WHERE contact_type = 'person' AND gender IS NULL
  AND first_name IN ('Martin','Peter','Klaus','Thomas','Michael','Andreas',
    'Juergen','Wolfgang','Christian','Oliver','Markus','Stefan','Manfred',
    'Alexander','Tobias','Frank','Felix','Joachim','Bernd','Daniel',
    'Roland','Guenter','Matthias','Dieter','Norbert','Ulrich','Georg',
    'Rainer','Werner','Helmut','Uwe','Volker','Hans','Karl','Friedrich',
    'Armin','Florian','Arnd','Eckart','Jan','Joerg', ...);

UPDATE contacts SET gender = 'f' WHERE contact_type = 'person' AND gender IS NULL
  AND first_name IN ('Sabine','Barbara','Gabriele','Ingrid','Kirsten',
    'Bettina','Elisabeth','Monika','Christine','Andrea','Petra','Susanne',
    'Claudia','Renate','Ursula','Karin','Birgit','Heike','Martina',
    'Angelika','Gundelinde','Dagmar', ...);
```

### 3. UI: Kontakt erstellen (`src/pages/CreateContact.tsx`)

- `gender` Feld zum `ContactFormData` Interface hinzufuegen (default: `""`)
- Select-Dropdown "Anrede" mit Optionen: Herr / Frau / Divers
- Nur bei `contact_type === 'person'` anzeigen
- Beim Speichern mit uebermitteln

### 4. UI: Kontakt bearbeiten (`src/components/ContactEditForm.tsx`)

- `gender` zum `Contact` Interface hinzufuegen
- Gleiches Select-Dropdown wie bei Erstellen
- Nur bei `contact_type === 'person'` anzeigen

### 5. Brief-Editor (`src/components/LetterEditor.tsx`)

- Den Cast `(contact as any).gender` durch typisiertes Feld ersetzen
- `gender` in die Kontakt-Abfrage aufnehmen (falls nicht bereits in Select-Spalten)

### 6. TypeScript-Typen

- `gender` in allen relevanten Kontakt-Interfaces ergaenzen (`Contact` in `useInfiniteContacts`, `ContactEditForm`, `CreateContact`, etc.)

## Dateien

| Datei | Aenderung |
|---|---|
| Migration (SQL) | `ALTER TABLE contacts ADD COLUMN gender text` + Backfill-Update |
| `src/pages/CreateContact.tsx` | Gender-Feld im Formular |
| `src/components/ContactEditForm.tsx` | Gender-Feld im Formular |
| `src/components/LetterEditor.tsx` | Typisierung `gender` statt `any`-Cast |
| `src/hooks/useInfiniteContacts.tsx` | `gender` in Select-Spalten |
| `src/hooks/useAllPersonContacts.tsx` | `gender` in Select-Spalten |
| `src/lib/letterVariables.ts` | Keine Aenderung noetig (nutzt `gender` bereits korrekt) |

