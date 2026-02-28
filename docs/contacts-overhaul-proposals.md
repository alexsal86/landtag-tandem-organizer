# Konkrete Vorschläge zur Überarbeitung/Erweiterung des Kontaktmoduls

## Ausgangslage (aus Code-Sichtung)

- Im Kontaktfluss sind bereits sinnvolle Basisregeln aktiv (z. B. „mindestens E-Mail **oder** Telefon“ beim Anlegen/Bearbeiten).
- Gleichzeitig sind Datenzugriffe und Validierungen an mehreren Stellen dupliziert (Create, Edit, Import, Listen-Hook), was zu inkonsistentem Verhalten führen kann.
- Einige Abfragen sind nicht mandantenbegrenzt; dadurch entstehen Datenqualitäts- und Sicherheitsrisiken in Multi-Tenant-Setups.

---

## 1) Code-Qualität verbessern (konkret)

### 1.1 Gemeinsames Domain-Modul für Kontakt-Validierung einführen

**Problem:** Validierungsregeln sind in Seitenkomponenten verteilt und nicht zentral versioniert.

- `CreateContact` prüft Pflichtfelder und „E-Mail oder Telefon“.
- `EditContact` prüft ähnlich, aber separat.

**Vorschlag:**

- Ein gemeinsames Modul `src/features/contacts/domain/validation.ts` mit Funktionen wie:
  - `validateContactCore(input)`
  - `hasAtLeastOneChannel({ email, phone })`
  - `normalizeContactBeforeSave(input)`
- Beide Seiten (`CreateContact`, `EditContact`) nutzen nur noch diese Funktionen.

**Nutzen:**

- Weniger Drift zwischen Create/Edit.
- Regeln an einer Stelle testbar und nachvollziehbar.

### 1.2 Datenzugriff pro Feature kapseln (Repository + Query Helpers)

**Problem:** Supabase-Abfragen sind direkt in UI-Komponenten/hook verteilt.

**Vorschlag:**

- `src/features/contacts/data/contactRepository.ts` mit klaren Methoden:
  - `listOrganizations(tenantId)`
  - `listContactsForDuplicateCheck(tenantId)`
  - `createContact(payload)`
  - `updateContact(id, payload)`
- `useInfiniteContacts` behält nur Filter-/UI-Logik und ruft Repository-Funktionen auf.

**Nutzen:**

- Bessere Testbarkeit.
- Einheitliche Mandantenfilterung.
- Geringere Komplexität in Komponenten.

### 1.3 Typen konsolidieren

**Problem:** Mehrere leicht unterschiedliche `Contact`-Interfaces existieren parallel (Create/Import/Hook/Utils).

**Vorschlag:**

- Ein zentrales Typset in `src/features/contacts/types.ts`:
  - `ContactListItem`
  - `ContactFormInput`
  - `ContactDuplicateCandidate`
- Bestehende lokalen Interfaces schrittweise ablösen.

**Nutzen:**

- Weniger Casts (`as any`) und weniger stiller Typ-Drift.

---

## 2) Fehler/Risiken beheben (High Priority)

### 2.1 Mandantenfilter bei Hilfsabfragen ergänzen

**Problem:** Mehrere Kontakt-Abfragen ohne `tenant_id`-Filter.

Betroffen:

- Organisationen laden in Create/Edit.
- Bestehende Kontakte für Dublettencheck in Create/Import.

**Risiko:**

- Falsche Vorschläge/Listen über Tenant-Grenzen.
- Mögliche Datenlecks in der Oberfläche.

**Vorschlag (Sofortmaßnahme):**

- Bei allen kontaktbezogenen Reads grundsätzlich `.eq("tenant_id", currentTenant.id)` erzwingen.
- Ergänzend RLS-Policies gegen Cross-Tenant-Zugriffe verifizieren.

### 2.2 Dublettenerkennung auf kanonische Felder umstellen

**Problem:** Dublettenerkennung arbeitet stark mit `organization` (Freitext), während in Formularen `organization_id` zentral ist.

**Vorschlag:**

- Matching-Priorität:
  1. `email` exakt
  2. normalisierte `phone` exakt
  3. `name` ähnlich + gleiche `organization_id`
- `organization` nur als Fallback in Legacy-Daten.

**Nutzen:**

- Weniger False Positives/Negatives.
- Robuster bei Schreibvarianten.

### 2.3 Archiv-/Statuslogik explizit machen

**Problem:** In der Listenlogik wird „Archivierter Kontakt“ über den Namen erkannt.

**Vorschlag:**

- Spalte `status` (`active | archived`) oder `is_archived` verwenden.
- Filter im Hook auf dieses Feld umstellen.

**Nutzen:**

- Keine fachliche Logik mehr im Anzeigenamen.

---

## 3) Feature-Erweiterungen mit hohem Mehrwert

### 3.1 Kontaktprofil in „Basis / Erweitert“ splitten

**Warum:** Es existieren viele Felder, aber im Alltag wird nur ein kleiner Kern benötigt.

**Vorschlag:**

- **Basis-Tab:** Name, Typ, Rolle, Organisation, E-Mail/Telefon, Kategorie, Priorität, Tags.
- **Erweitert-Tab:** Adressen, Social, Branchen-/Metadaten, Compliance.
- Pro Tenant optional: „vereinfachtes Formular“ als Einstellung.

### 3.2 Aktivitäts-Timeline automatisch führen

**Vorschlag:**

- `last_contact` systematisch aus Aktivitäten/Kommunikation fortschreiben (DB-Funktion oder Event-Worker).
- In der Detailansicht eine Timeline (`contact_activities`) mit Filtern (Call, Mail, Meeting, Notiz).

**Nutzen:**

- Bessere Priorisierung („wen lange nicht kontaktiert“).

### 3.3 Import 2.0 mit Qualitäts-Scoring

**Vorschlag:**

- Vor Import pro Zeile ein Score (z. B. 0–100) ausgeben:
  - Pflichtdaten vorhanden?
  - E-Mail/Telefon valide?
  - Dublette wahrscheinlich?
- UI: „nur Datensätze > 70 importieren“ + Fehler-Download (CSV).

### 3.4 Smart Views für den Büroalltag

**Vorschlag:**

- Gespeicherte Filteransichten:
  - „Heute fällig“ (letzter Kontakt > X Tage)
  - „Top-Priorität ohne letzten Kontakt“
  - „Neue Kontakte der letzten 14 Tage“
- Optional: Benachrichtigungen/Reminder aus diesen Views.

---

## 4) Empfohlene Umsetzungsreihenfolge (4 Sprints)

1. **Sprint 1 (Stabilität):** Tenant-Filter konsistent, zentrale Validation, Typkonsolidierung.
2. **Sprint 2 (Datenqualität):** Neue Dublettenlogik + Archivstatus-Feld.
3. **Sprint 3 (UX):** Basis/Erweitert-Form, Smart Views.
4. **Sprint 4 (Automatisierung):** Aktivitäts-Timeline + last_contact-Automatik + Import-Scoring.

---

## 5) Konkrete „Definition of Done“ je Bereich

- **Code-Qualität:** Kein kontaktbezogener Supabase-Read ohne Tenant-Filter; Validierung nur aus Domain-Modul.
- **Fehlerbehebung:** Dublettenquote sinkt (manuelle Korrekturen messbar), keine archiv-abhängigen Namensregeln mehr.
- **Features:** Mindestens 3 Smart Views live, Import mit Qualitätsreport, Timeline in Kontakt-Detail aktiv.
