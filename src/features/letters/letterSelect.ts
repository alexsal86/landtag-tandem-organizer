/**
 * Feldauswahl für den Brief-Editor.
 *
 * Jeder Einstiegspunkt, der den Editor öffnet (Briefliste, Detailseite), lädt
 * den Brief über diese Konstante. Fehlt auch nur ein Feld, arbeitet der Editor
 * mit einem unvollständigen Datensatz weiter und der Autosave schreibt die
 * Lücken zurück — fehlt `content_nodes`, ersetzt der Lexical-Editor den
 * formatierten Inhalt durch reinen Text.
 */
export const LETTER_EDIT_SELECT =
  'id, title, content, content_html, content_nodes, recipient_name, recipient_address, contact_id, template_id, subject, reference_number, sender_info_id, information_block_ids, letter_date, status, sent_date, sent_method, expected_response_date, show_pagination, salutation_override, closing_formula, closing_name, revision_comment, revision_requested_at, revision_requested_by, submitted_for_review_at, submitted_for_review_by, approved_at, approved_by, sent_at, sent_by, workflow_locked, created_by, created_at, updated_at, tenant_id' as const;

/**
 * Listenzeilen laden bewusst keinen Brieftext (Egress). Die Metadaten reichen
 * für Karten und Filter; der vollständige Datensatz kommt beim Öffnen über
 * `LETTER_EDIT_SELECT` nach.
 */
export const LETTER_LIST_SELECT =
  'id, title, subject, reference_number, letter_date, status, recipient_name, recipient_address, contact_id, sender_info_id, template_id, information_block_ids, sent_date, sent_method, expected_response_date, show_pagination, created_by, created_at, updated_at, tenant_id' as const;
