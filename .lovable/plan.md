

# Kontakte-Tabelle verschlanken und Stakeholder-Frage klaren

## Zur Stakeholder-Frage: Trennung lohnt sich nicht

Stakeholder sind aktuell Kontakte mit bestimmten Tags/Kategorien. Eine Trennung in zwei Tabellen wurde bedeuten:
- Doppelte Daten (Name, E-Mail, Adresse in beiden Tabellen)
- Alle Verknupfungen (Termine, Dokumente, Akten, Dossiers, Karte) mussten doppelt gepflegt werden
- Kontakte, die beides sind (z.B. ein Burger, der auch Stakeholder ist), mussten synchronisiert werden

**Empfehlung:** Einheitliche Tabelle beibehalten. Die Unterscheidung lauft uber `category` und `tags` — das funktioniert bereits gut mit der Kartenansicht, Themen-Zuordnung und Stakeholder-Views. Keine Anderung nötig.

## Spalten-Reduktion: Von ~65 auf ~45 Spalten

### Spalten die entfernt werden (20 Stuck)

**Nie genutzt im Abgeordnetenburo-Kontext:**
- `certifications` — Zertifizierungen, irrelevant
- `marketing_consent` — Marketing-Einwilligung, kein Marketing-Tool
- `newsletter_subscription` — Newsletter, nicht relevant
- `meeting_preferences` — nie in UI genutzt
- `gdpr_consent_date` — DSGVO-Datum, in Praxis nie gepflegt
- `data_protection_notes` — Datenschutz-Notizen, nie genutzt

**Redundant:**
- `company` — Duplikat von `organization`, wird vereinheitlicht
- `additional_info` — Duplikat von `notes`
- `added_at` — Duplikat von `created_at`
- `added_reason` — nie sinnvoll befullt
- `location` — vage; strukturierte Adressfelder existieren bereits

**Zu granular fur den Alltag (Private Adresse):**
- `private_street`, `private_house_number`, `private_postal_code`, `private_city`, `private_country` — Private Adressen werden im Burobetrieb fast nie gepflegt. Falls nötig, kann `address` als Freitextfeld dienen.
- `private_phone`, `private_phone_2` — Privattelefon 1+2 separat zu fuhren ist Overkill; `phone` + `mobile_phone` reichen
- `business_phone_2` — Zweite Geschaftsnummer, extrem selten

### Spalten die bleiben (~45)

```text
── Identitat ──────────────────────────────
id, tenant_id, user_id, contact_type, name, first_name, last_name, title, gender

── Einordnung ─────────────────────────────
category, priority, tags, is_favorite, role, position, department

── Organisation ───────────────────────────
organization, organization_id

── Kommunikation ──────────────────────────
email, email_2, email_3, phone, mobile_phone, business_phone

── Adresse (Geschaft) ────────────────────
business_street, business_house_number, business_postal_code, business_city, business_country, address

── Online ─────────────────────────────────
website, linkedin, twitter, facebook, instagram, xing

── Persönlich ─────────────────────────────
birthday, notes, avatar_url

── Geo ────────────────────────────────────
coordinates, geocoded_at, geocoding_source

── System ─────────────────────────────────
created_at, updated_at, last_contact
```

## Technische Umsetzung

### 1. Migration: Daten konsolidieren, dann Spalten droppen

Vor dem Drop werden Daten gerettet:
- `company` → in `organization` ubernehmen (wo `organization` leer ist)
- `additional_info` → an `notes` anhangen (wo `notes` leer oder `additional_info` gefullt)
- `added_at` → ignorieren (created_at existiert)
- `private_phone` → in `phone` ubernehmen (wo `phone` leer)

Dann 20 Spalten droppen.

### 2. Code anpassen

**Dateien die geandert werden:**
- `src/types/contact.ts` — `ContactBase` verschlanken (Felder entfernen: `legal_form`, `industry`, `main_contact_person`, `business_description`, `location`, `additional_info`)
- `src/components/ContactEditForm.tsx` — Referenzen auf `company`, `gdpr_consent_date`, `additional_info` entfernen
- `src/components/GlobalSearchCommand.tsx` — `company` aus Select/Filter entfernen
- `src/components/appointment-preparations/AppointmentPreparationDataTab.tsx` — `company` durch `organization` ersetzen
- `src/components/letters/LetterWizard.tsx` — `company` durch `organization` ersetzen
- `src/components/contact-import/types.ts` — Import-Mappings fur entfernte Felder anpassen
- `src/hooks/useInfiniteContacts.ts` — Select-Queries anpassen

### 3. Was sich NICHT andert
- Stakeholder-System bleibt wie es ist (gleiche Tabelle, Tag-basiert)
- Alle Verknupfungstabellen (contact_topics, appointment_contacts, etc.) bleiben unberuhrt
- Kartenansicht funktioniert weiterhin (nutzt `coordinates`, `business_street` etc.)

