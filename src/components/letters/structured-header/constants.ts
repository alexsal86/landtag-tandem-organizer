import type { HeaderElement } from '@/components/canvas-engine/types';

export const BLOCK_VARIABLES: Record<string, { label: string; value: string; previewText: string }[]> = {
  header: [
    { label: 'Absender Name', value: '{{absender_name}}', previewText: 'Alexander Salomon' },
    { label: 'Organisation', value: '{{absender_organisation}}', previewText: 'Fraktion GRÜNE im Landtag' },
  ],
  addressField: [
    { label: 'Empfänger Name', value: '{{empfaenger_name}}', previewText: 'Max Mustermann' },
    { label: 'Straße', value: '{{empfaenger_strasse}}', previewText: 'Musterstraße 12' },
    { label: 'PLZ', value: '{{empfaenger_plz}}', previewText: '70173' },
    { label: 'Ort', value: '{{empfaenger_ort}}', previewText: 'Stuttgart' },
    { label: 'Land', value: '{{empfaenger_land}}', previewText: 'Deutschland' },
  ],
  returnAddress: [
    { label: 'Absender Name', value: '{{absender_name}}', previewText: 'Alexander Salomon' },
    { label: 'Organisation', value: '{{absender_organisation}}', previewText: 'Fraktion GRÜNE' },
    { label: 'Straße', value: '{{absender_strasse}}', previewText: 'Konrad-Adenauer-Str. 3' },
    { label: 'PLZ/Ort', value: '{{absender_plz_ort}}', previewText: '70173 Stuttgart' },
  ],
  infoBlock: [
    { label: 'Datum', value: '{{datum}}', previewText: '24. Februar 2026' },
    { label: 'Aktenzeichen', value: '{{aktenzeichen}}', previewText: 'Az. 2026/0815' },
    { label: 'Bearbeiter', value: '{{bearbeiter}}', previewText: 'A. Salomon' },
    { label: 'Telefon', value: '{{telefon}}', previewText: '0711 2063-0' },
    { label: 'E-Mail', value: '{{email}}', previewText: 'alexander.salomon@gruene.landtag-bw.de' },
    { label: 'Unser Zeichen', value: '{{unser_zeichen}}', previewText: 'AS/kl' },
  ],
  subject: [
    { label: 'Betreff', value: '{{betreff}}', previewText: 'Ihr Schreiben vom 15. Januar 2026 – Stellungnahme' },
  ],
  attachments: [
    { label: 'Anlagen-Liste', value: '{{anlagen_liste}}', previewText: '- Antrag_2026-02-15.pdf\n- Stellungnahme_Verkehrsausschuss.docx\n- Anlagenverzeichnis.xlsx' },
  ],
  footer: [
    { label: 'Absender Name', value: '{{absender_name}}', previewText: 'Alexander Salomon' },
    { label: 'Organisation', value: '{{absender_organisation}}', previewText: 'Fraktion GRÜNE' },
    { label: 'Telefon', value: '{{telefon}}', previewText: '0711 2063-0' },
    { label: 'E-Mail', value: '{{email}}', previewText: 'alexander.salomon@gruene.landtag-bw.de' },
  ],
};

export const createElementId = () => crypto.randomUUID();

export const getShapeFillColor = (element: HeaderElement, fallback = '#000000') =>
  element.type === 'shape' ? (element.fillColor ?? element.color ?? fallback) : fallback;

export const getShapeStrokeColor = (element: HeaderElement, fallback = '#000000') =>
  element.type === 'shape' ? (element.strokeColor ?? element.color ?? fallback) : fallback;

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
