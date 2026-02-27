# Analyse: Kontakte-System (Datenbedarf & Tabellenspalten)

## Ziel
Diese Analyse beantwortet zwei Fragen:
1. Welche **Informationen pro Kontakt wirklich nötig** sind (MVP / operativer Kern).
2. Welche **Tabellenspalten aktuell existieren**.

## 1) Ist-Zustand: Tabellen im Kontakte-System

Im aktuellen Supabase-Schema gibt es mindestens diese kontaktbezogenen Tabellen:

- `contacts` (Hauptstammdaten)
- `contact_activities` (Historie/Aktivitäten)
- `contact_topics` (Zuordnung zu Themen)
- `contact_usage_stats` (Nutzungszähler)
- `appointment_contacts` (Termin ↔ Kontakt)
- `document_contacts` (Dokument ↔ Kontakt)
- `case_file_contacts` (Akte ↔ Kontakt)
- `event_planning_contacts` (Planungs-Kontakte)

### `contacts`: Spaltenumfang

Die Tabelle `contacts` enthält derzeit **106 Spalten**.

Vollständige Spaltenliste:

`accessibility_features, added_at, added_reason, additional_info, address, annual_revenue, avatar_url, awards_recognitions, bank_account_number, bank_name, bank_routing_number, bic_swift, billing_address, birthday, business_city, business_country, business_description, business_house_number, business_phone, business_phone_2, business_postal_code, business_street, category, certifications, commercial_register_number, company, company_size, compliance_notes, contact_type, contract_end_date, contract_start_date, contract_type, coordinates, created_at, credit_limit, customer_number, data_protection_notes, department, diversity_certifications, email, email_2, email_3, employees_count, established_year, facebook, first_name, founding_date, gdpr_consent_date, geocoded_at, geocoding_source, iban, id, industry, instagram, is_favorite, key_contacts, languages_supported, last_contact, last_name, legal_form, linkedin, location, main_contact_person, marketing_consent, meeting_preferences, mobile_phone, name, newsletter_subscription, notes, organization, organization_id, parent_company, partnership_level, payment_terms, phone, position, preferred_communication_method, priority, private_city, private_country, private_house_number, private_phone, private_phone_2, private_postal_code, private_street, rating, role, service_areas, shipping_address, social_media_accounts, specializations, subsidiaries, supplier_number, sustainability_practices, tags, tax_number, tenant_id, time_zone, title, trade_associations, twitter, updated_at, user_id, vat_number, website, xing`

## 2) Welche Informationen brauchen wir „wirklich“ pro Kontakt?

### Empfehlung: Kernfelder als Pflicht / Standard

#### Für **Personen**
- `name` (Pflicht)
- **mindestens ein Kontaktkanal**: `email` ODER `phone` (Pflichtregel)
- `organization_id` (optional, aber sehr sinnvoll)
- `category`, `priority` (für Arbeitssteuerung)
- `tags` (für Filter/Suchen)
- `notes` (frei)

#### Für **Organisationen**
- `name` (Pflicht)
- `category`, `priority` (Pflicht wie heute)
- `main_contact_person` (optional)
- `email` und/oder `phone` (mindestens ein Kanal empfohlen)
- `website`, `business_street`, `business_house_number`, `business_postal_code`, `business_city`, `business_country` (optional, aber für Geocoding/Einladungen nützlich)

### Was aktuell auffällt
- Im Create-Flow sind bei Personen aktuell `name`, `email`, `category`, `priority` Pflicht; bei Organisationen `name`, `category`, `priority`.
- Sehr viele Felder sind vorhanden, aber nur selten im UI-Flow relevant.
- Teilweise doppelte Semantik (`organization` als Text + `organization_id` als FK).

## 3) Verbesserungen mit hoher Wirkung

1. **Datenmodell in Schichten aufteilen**
   - `contacts_core`-Gedanke in der App (auch wenn physisch gleiche Tabelle bleibt):
     - Kernfelder (immer sichtbar)
     - Erweiterte Felder (aufklappbar)
     - Spezial-/Compliance-/Finance-Felder (nur für bestimmte Rollen/Workflows)

2. **Pflichtregeln vereinfachen**
   - Für Personen: statt harter `email`-Pflicht lieber „`email` ODER `phone`“.
   - Für Organisationen: mindestens ein Kontaktkanal empfehlen/validieren.

3. **Dubletten- und Identitätslogik stärken**
   - `organization_id` als primäre Verknüpfung nutzen, `organization` (Text) nur als Migrations-/Fallback-Feld.
   - Mittelfristig `organization` konsolidieren (read-only deriviert oder entfernen).

4. **Felder mit geringer Nutzung markieren**
   - Kandidaten für „advanced only“ oder Auslagerung in `contact_profiles`/`contact_compliance`:
     - z. B. Bank-/Compliance-/Nachhaltigkeits- und Diversity-Felder.

5. **„Last Contact“ systemisch pflegen**
   - `last_contact` nicht manuell, sondern aus `contact_activities` ableiten (Trigger/Job), damit konsistent.

## 4) Konkreter Vorschlag für einen pragmatischen Zielzustand

### Pflicht (MVP)
- `id`, `tenant_id`, `user_id`
- `contact_type`, `name`
- `category`, `priority`
- `email` oder `phone` (regelbasiert)
- `created_at`, `updated_at`

### Standard (häufig gebraucht)
- `organization_id`, `role`, `position`
- `address` oder strukturierte Geschäftsadresse
- `tags`, `notes`, `website`
- `is_favorite`, `last_contact`

### Erweitert (nur bei Bedarf)
- Socials, rechtliche/steuerliche Details, Finance/Vertragsfelder, Sustainability/Diversity/Accessibility

## 5) Nächste sinnvolle Umsetzungs-Schritte

1. Feldnutzung messen (echte DB-Belegung je Spalte, nicht nur Code-Referenzen).
2. UI in „Basis / Erweitert“ umstellen.
3. Validierungsregeln auf „mind. ein Kontaktkanal“ ändern.
4. `organization` vs `organization_id` bereinigen.
5. Nach 4–8 Wochen Telemetrie: ungenutzte Felder ausblenden oder in Extension-Tabellen verschieben.
