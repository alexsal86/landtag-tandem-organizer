import { supabase } from '@/integrations/supabase/client';
import { LetterLayoutSettings, DEFAULT_DIN5008_LAYOUT } from '@/types/letterLayout';

export interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
  is_default: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  default_sender_id?: string | null;
  default_info_blocks?: string[] | null;
  header_layout_type?: string | null;
  header_text_elements?: unknown;
  footer_blocks?: unknown;
  layout_settings?: LetterLayoutSettings | null;
}

export interface SenderInformation {
  id: string;
  name: string;
  organization: string;
  is_default: boolean | null;
}

export interface InformationBlock {
  id: string;
  name: string;
  label: string;
  is_default: boolean | null;
}

export type { MarginKey, TabRect } from '@/types/letterLayout';

export interface GalleryImage {
  name: string;
  path: string;
  blobUrl: string;
}

const STORAGE_PATH_PREFIXES = [
  '/storage/v1/object/public/letter-assets/',
  '/storage/v1/object/sign/letter-assets/',
  '/storage/v1/object/authenticated/letter-assets/',
];

export const extractStoragePathFromUrl = (value?: string | null): string | null => {
  if (!value) return null;
  if (!value.startsWith('http://') && !value.startsWith('https://')) return value;
  try {
    const parsed = new URL(value);
    const matchedPrefix = STORAGE_PATH_PREFIXES.find((prefix) => parsed.pathname.includes(prefix));
    if (!matchedPrefix) return null;
    const [, rawPath = ''] = parsed.pathname.split(matchedPrefix);
    if (!rawPath) return null;
    return decodeURIComponent(rawPath);
  } catch {
    return null;
  }
};

export const normalizeImageItem = <T>(item: T): T => {
  if (!item || typeof item !== 'object' || (item as Record<string, unknown>).type !== 'image') return item;
  const rec = item as Record<string, unknown>;
  const storagePath = rec.storagePath as string | undefined || extractStoragePathFromUrl(rec.imageUrl as string | undefined);
  if (!storagePath) return item;
  const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(storagePath);
  return { ...item, storagePath, imageUrl: publicUrl };
};

export const normalizeLayoutBlockContentImages = (layoutSettings: LetterLayoutSettings) => {
  const enforceDIN5008Metrics = (settings: LetterLayoutSettings): LetterLayoutSettings => ({
    ...settings,
    footer: { ...settings.footer, top: 272, height: settings.footer?.height ?? DEFAULT_DIN5008_LAYOUT.footer.height },
    subject: { ...settings.subject, top: 98.46 },
    content: { ...settings.content, top: 98.46, maxHeight: 165 },
    pagination: {
      enabled: settings.pagination?.enabled ?? true,
      top: 263.77,
      align: settings.pagination?.align || 'right',
      fontSize: settings.pagination?.fontSize ?? 8,
    },
    foldHoleMarks: {
      enabled: settings.foldHoleMarks?.enabled ?? true,
      left: settings.foldHoleMarks?.left ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.left ?? 3,
      strokeWidthPt: settings.foldHoleMarks?.strokeWidthPt ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.strokeWidthPt ?? 1,
      foldMarkWidth: settings.foldHoleMarks?.foldMarkWidth ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.foldMarkWidth ?? 5,
      holeMarkWidth: settings.foldHoleMarks?.holeMarkWidth ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.holeMarkWidth ?? 8,
      topMarkY: settings.foldHoleMarks?.topMarkY ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.topMarkY ?? 105,
      holeMarkY: settings.foldHoleMarks?.holeMarkY ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.holeMarkY ?? 148.5,
      bottomMarkY: settings.foldHoleMarks?.bottomMarkY ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.bottomMarkY ?? 210,
    },
  });

  const blockContent = ((layoutSettings as unknown as Record<string, unknown>).blockContent || {}) as Record<string, unknown[]>;
  const normalizedContent = Object.fromEntries(
    Object.entries(blockContent).map(([key, items]) => {
      if (!Array.isArray(items)) return [key, items];
      return [key, items.map(normalizeImageItem)];
    })
  );

  const normalizedLayout = enforceDIN5008Metrics(layoutSettings);
  return { ...normalizedLayout, blockContent: normalizedContent } as LetterLayoutSettings;
};

const DEFAULT_ATTACHMENT_PREVIEW_LINES = ['- Antrag_2026-02-15.pdf', '- Stellungnahme_Verkehrsausschuss.docx', '- Anlagenverzeichnis.xlsx'];

export const createDefaultAttachmentElements = (): Record<string, unknown>[] => ([{
  id: `attachments-default-${Date.now()}`,
  type: 'text',
  x: 0,
  y: 0,
  content: '{{anlagen_liste}}',
  isVariable: true,
  variablePreviewText: DEFAULT_ATTACHMENT_PREVIEW_LINES.join('\n'),
  fontSize: 10,
  fontFamily: 'Arial',
  fontWeight: 'bold',
  color: '#000000',
  textLineHeight: 1.2,
}]);

export { DEFAULT_ATTACHMENT_PREVIEW_LINES };
