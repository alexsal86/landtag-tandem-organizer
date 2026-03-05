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
