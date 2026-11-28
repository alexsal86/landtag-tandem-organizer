# Case Items – Intake-Validierungsregeln

Diese Regeln beschreiben die erwartete Validierung für die neuen strukturierten Intake-Felder in `case_items`.

## Feldbedeutung

- `subject`: kurzer Betreff für Listen/Übersichten.
- `summary`: kurze inhaltliche Zusammenfassung des Anliegens.
- `source_received_at`: Zeitpunkt, zu dem das Anliegen eingegangen ist.
- `source_reference`: externe Referenz (z. B. Ticket-ID, Mail-ID).
- `reporter_name`: Name der meldenden Person/Quelle.
- `reporter_contact`: Kontaktweg (Mail, Telefon, Profil-Link etc.).
- `intake_payload`: kanal-spezifische Rohdaten (JSONB).
  - Optional unterstützt: `contact_name` (Kontaktname) und `contact_detail` (E-Mail/Telefon/Handle).
- `confidentiality_level`: Einstufung `public|internal|restricted|strictly_confidential`.
- `contains_personal_data`: Kennzeichen für personenbezogene Daten.

## Mindestregeln (kanalübergreifend)

- Empfohlen: `subject` und `summary` befüllen.
- `source_received_at` sollte gesetzt werden, wenn der Eingang nicht „jetzt“ ist.
- `confidentiality_level` darf nur die erlaubten Werte enthalten.
- Falls `contains_personal_data = true`, sollte mindestens `confidentiality_level = 'restricted'` gesetzt werden.

## Pflichtfelder je Kanal (Anwendungsvalidierung)

> Diese Regeln sollen primär in UI/Service-Ebene validiert werden, damit bestehende Datensätze kompatibel bleiben.

### `email`

- Pflicht: `subject`
- Pflicht: `source_received_at`
- Pflicht: mindestens einer aus `source_reference` (Message-ID) oder `intake_payload.message_id`

### `phone`

- Pflicht: `subject`
- Pflicht: `source_received_at`
- Pflicht: mindestens einer aus `reporter_name` oder `reporter_contact`

### `social`

- Pflicht: `subject`
- Pflicht: `source_received_at`
- Pflicht: mindestens einer aus `source_reference` (Post/Thread-ID) oder `intake_payload.post_id`

### `in_person`

- Pflicht: `subject`
- Pflicht: `source_received_at`
- Empfohlen: `reporter_name`

### `other`

- Pflicht: `subject`
- Pflicht: `summary`
- Empfohlen: `source_reference` oder strukturierte Angaben im `intake_payload`

## Benachrichtigungen bei Erwähnungen in Interaktionen

Erwähnte Personen (`data-lexical-mention-user-id` im HTML von `details`) werden vom
Trigger `trg_case_interaction_mention_notification` auf `case_item_interactions`
benachrichtigt. Der Client verschickt dafür keine eigene Meldung mehr: die
6-Argument-Fassung von `create_notification` löst den Mandanten über den
Hauptmandanten der Person auf und trifft bei mehreren Mitgliedschaften den falschen
Arbeitsbereich.

- Der Mandant kommt aus der Interaktion bzw. – falls leer – aus Vorgang oder
  Fallakte; Empfänger müssen aktive Mitglieder dieses Büros sein.
- Die erzeugende Person erhält keine Meldung über die eigene Erwähnung. Beim
  Bearbeiten von `details` werden nur neu hinzugekommene Erwähnungen gemeldet.
- Typ `case_interaction_mention` („In Vorgang erwähnt“) wird in bestehenden Büros
  nachgezogen und für neue Büros am Tenant-Trigger angelegt.
- Der Deep Link öffnet den Vorgang (`/mywork?tab=cases&caseItemId=…`), ohne Vorgang
  die Fallakte (`/casefiles?caseFileId=…`).
- `case_interaction_mention_selftest(p_tenant)` prüft die Zustellung mit einer echten
  Interaktion und rollt sie anschließend zurück.
