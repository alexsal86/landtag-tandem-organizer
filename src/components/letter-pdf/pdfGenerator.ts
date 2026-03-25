import jsPDF from 'jspdf';
import { debugConsole } from '@/utils/debugConsole';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { HeaderRenderer } from '@/services/headerRenderer';
import { buildFooterBlocksFromStored, resolveBlockWidthMm, toFooterBlockTypographyContract } from '@/components/letters/footerBlockUtils';
import { supabase } from '@/integrations/supabase/client';
import { buildVariableMap, substituteBlockLines, substituteVariables, isLineMode } from '@/lib/letterVariables';
import type { BlockLine } from '@/components/letters/BlockLineEditor';
import { getLetterAssetPublicUrl } from '@/components/letters/letterAssetUrls';
import { DEFAULT_DIN5008_LAYOUT, isLetterLayoutSettings, type LetterLayoutSettings } from '@/types/letterLayout';
import { isRecord } from '@/utils/typeSafety';
import type { Letter, LetterTemplate, DbContact, SenderInfoContract, InformationBlockContract, AttachmentContract } from './types';
import type { FooterLineBlock } from '@/components/letters/footerBlockUtils';

// DIN 5008 measurements in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LEFT_MARGIN = 25;
const RIGHT_MARGIN = 20;
const HEADER_HEIGHT = 45;
const ADDRESS_FIELD_TOP = 46;
const ADDRESS_FIELD_LEFT = LEFT_MARGIN;
const ADDRESS_FIELD_WIDTH = 85;
const ADDRESS_FIELD_HEIGHT = 40;
const INFO_BLOCK_TOP = 50;
const INFO_BLOCK_LEFT = 125;
const INFO_BLOCK_WIDTH = 75;
const CONTENT_TOP = 98.46;
const FOOTER_TOP = 272;
const PAGINATION_GAP = 4.23;

type PdfFontWeight = 'normal' | 'bold';

interface Coordinates {
  x: number;
  y: number;
}

interface FontSettings {
  size: number;
  weight: PdfFontWeight;
  color: [number, number, number];
}

interface SpacingSettings {
  lineHeight: number;
}

interface TextBlock {
  id: string;
  title?: string;
  titleHighlight?: boolean;
  titleFont?: FontSettings;
  origin: Coordinates;
  widthMm: number;
  lines: string[];
  font: FontSettings;
  spacing: SpacingSettings;
}

interface PageMetrics {
  widthMm: number;
  heightMm: number;
  margins: {
    leftMm: number;
    rightMm: number;
  };
  footerTopMm: number;
  contentTopMm: number;
  paginationGapMm: number;
}

interface FoldHoleMarks {
  enabled: boolean;
  left: number;
  strokeWidthPt: number;
  foldMarkWidth: number;
  holeMarkWidth: number;
  topMarkY: number;
  holeMarkY: number;
  bottomMarkY: number;
}

const DEFAULT_PAGE_METRICS: PageMetrics = {
  widthMm: PAGE_WIDTH,
  heightMm: PAGE_HEIGHT,
  margins: { leftMm: LEFT_MARGIN, rightMm: RIGHT_MARGIN },
  footerTopMm: FOOTER_TOP,
  contentTopMm: CONTENT_TOP,
  paginationGapMm: PAGINATION_GAP,
};

export function convertHtmlToText(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  const processElement = (element: Element): string => {
    let text = '';
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        switch (tagName) {
          case 'br': text += '\n'; break;
          case 'p': case 'div': text += processElement(el) + '\n\n'; break;
          case 'h1': case 'h2': case 'h3': text += '\n' + processElement(el).toUpperCase() + '\n\n'; break;
          case 'li': text += '• ' + processElement(el) + '\n'; break;
          case 'strong': case 'b': text += processElement(el).toUpperCase(); break;
          case 'em': case 'i': text += '_' + processElement(el) + '_'; break;
          default: text += processElement(el);
        }
      }
    }
    return text;
  };
  
  return processElement(temp).replace(/\n{3,}/g, '\n\n').trim();
}

const parseHexColor = (hexColor: string, fallback: [number, number, number] = [0, 0, 0]): [number, number, number] => {
  if (!hexColor.startsWith('#')) return fallback;
  const hex = hexColor.slice(1);
  if (hex.length !== 6) return fallback;

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return fallback;
  return [r, g, b] as [number, number, number];
};

const toLayoutSettings = (rawLayout: unknown): LetterLayoutSettings => (
  isLetterLayoutSettings(rawLayout) ? rawLayout : DEFAULT_DIN5008_LAYOUT
);

const toFoldHoleMarks = (value: unknown): FoldHoleMarks | null => {
  if (!isRecord(value) || value.enabled !== true) return null;
  const marks = value as Partial<FoldHoleMarks>;
  if (typeof marks.left !== 'number' || typeof marks.strokeWidthPt !== 'number') return null;
  if (typeof marks.foldMarkWidth !== 'number' || typeof marks.holeMarkWidth !== 'number') return null;
  if (typeof marks.topMarkY !== 'number' || typeof marks.holeMarkY !== 'number' || typeof marks.bottomMarkY !== 'number') return null;
  return {
    enabled: true,
    left: marks.left,
    strokeWidthPt: marks.strokeWidthPt,
    foldMarkWidth: marks.foldMarkWidth,
    holeMarkWidth: marks.holeMarkWidth,
    topMarkY: marks.topMarkY,
    holeMarkY: marks.holeMarkY,
    bottomMarkY: marks.bottomMarkY,
  };
};

const toPdfTextBlock = (block: FooterLineBlock, availableWidthMm: number, startX: number, startY: number): TextBlock | null => {
  const lines = block.lines
    .map((line) => line.type === 'spacer'
      ? ''
      : line.type === 'label-value'
        ? `${line.label || ''} ${line.value || ''}`.trim()
        : (line.value || '')
    );

  const hasText = lines.some((line) => line.trim().length > 0);
  if (!hasText) return null;

  const titleLine = block.lines.find((line) => line.type === 'block-start')?.label || block.title;
  const baseFontSize = Math.max(6, Math.min(14, block.lines.find((line) => typeof line.fontSize === 'number')?.fontSize || 8));
  const lineHeight = baseFontSize * 0.4;
  const blockWidth = resolveBlockWidthMm(block.widthUnit || 'percent', Number(block.widthValue) || 25, availableWidthMm);
  const baseColor = parseHexColor(block.lines.find((line) => typeof line.color === 'string')?.color || '#000000');
  const baseWeight: PdfFontWeight = block.lines.some((line) => line.valueBold === true) ? 'bold' : 'normal';

  const typography = toFooterBlockTypographyContract(block);
  const titleFontSizeRaw = typography.titleFontSize;
  const titleWeightRaw: PdfFontWeight = typography.titleFontWeight;
  const titleColorRaw = typography.titleColor ? parseHexColor(typography.titleColor, [16, 112, 48]) : [16, 112, 48];

  return {
    id: block.id,
    title: titleLine || undefined,
    titleHighlight: typography.titleHighlight,
    titleFont: {
      size: Math.max(8, Math.min(20, titleFontSizeRaw)),
      weight: titleWeightRaw,
      color: titleColorRaw,
    },
    origin: { x: startX, y: startY },
    widthMm: blockWidth,
    lines,
    font: {
      size: baseFontSize,
      weight: baseWeight,
      color: baseColor,
    },
    spacing: {
      lineHeight,
    },
  };
};

const getStringValue = (record: Record<string, unknown> | null | undefined, key: string): string | undefined => {
  if (!record) return undefined;
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
};

const getBooleanValue = (record: Record<string, unknown> | null | undefined, key: string): boolean => {
  if (!record) return false;
  return record[key] === true;
};


const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
};

function drawDebugGuides(pdf: jsPDF, pageNum: number) {
  pdf.setLineWidth(0.2);
  
  if (pageNum === 1) {
    pdf.setDrawColor(255, 0, 0);
    pdf.line(0, HEADER_HEIGHT, PAGE_WIDTH, HEADER_HEIGHT);
    pdf.setFontSize(8);
    pdf.setTextColor(255, 0, 0);
    pdf.text("45mm - Header Ende (DIN 5008)", 5, HEADER_HEIGHT - 3);
    
    pdf.setDrawColor(255, 0, 0);
    pdf.rect(ADDRESS_FIELD_LEFT, ADDRESS_FIELD_TOP, ADDRESS_FIELD_WIDTH, ADDRESS_FIELD_HEIGHT);
    pdf.text("Adressfeld: 85×40mm @ Position 46mm/25mm", ADDRESS_FIELD_LEFT, ADDRESS_FIELD_TOP - 3);
    
    pdf.setDrawColor(255, 100, 100);
    pdf.setLineWidth(0.1);
    pdf.rect(ADDRESS_FIELD_LEFT, ADDRESS_FIELD_TOP, ADDRESS_FIELD_WIDTH, 17.7);
    pdf.setFontSize(6);
    pdf.text("Rücksendeangaben: 17.7mm Höhe", ADDRESS_FIELD_LEFT + 2, ADDRESS_FIELD_TOP + 15);
    
    pdf.setDrawColor(0, 0, 255);
    pdf.setLineWidth(0.2);
    pdf.rect(INFO_BLOCK_LEFT, INFO_BLOCK_TOP, INFO_BLOCK_WIDTH, ADDRESS_FIELD_HEIGHT);
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 255);
    pdf.text("Info-Block: 75×40mm @ 50mm/125mm", INFO_BLOCK_LEFT, INFO_BLOCK_TOP - 3);
    
    pdf.setDrawColor(0, 255, 0);
    pdf.line(LEFT_MARGIN, CONTENT_TOP, PAGE_WIDTH - RIGHT_MARGIN, CONTENT_TOP);
    pdf.setTextColor(0, 255, 0);
    pdf.text("98.46mm - Inhaltsbeginn (DIN 5008)", LEFT_MARGIN, CONTENT_TOP - 3);
    
    pdf.setFontSize(6);
    pdf.setTextColor(0, 0, 0);
    pdf.setDrawColor(255, 0, 0);
    pdf.line(0, ADDRESS_FIELD_TOP, ADDRESS_FIELD_LEFT - 2, ADDRESS_FIELD_TOP);
    pdf.text("46mm", 2, ADDRESS_FIELD_TOP + 2);
    pdf.setDrawColor(0, 0, 255);
    pdf.line(0, INFO_BLOCK_TOP, INFO_BLOCK_LEFT - 2, INFO_BLOCK_TOP);
    pdf.text("50mm", 2, INFO_BLOCK_TOP + 2);
    pdf.setDrawColor(0, 255, 0);
    pdf.line(0, CONTENT_TOP, LEFT_MARGIN - 2, CONTENT_TOP);
    pdf.text("98.46mm", 2, CONTENT_TOP + 2);
  }
  
  pdf.setDrawColor(255, 165, 0);
  pdf.line(LEFT_MARGIN, 0, LEFT_MARGIN, PAGE_HEIGHT);
  pdf.setTextColor(255, 165, 0);
  pdf.setFontSize(8);
  pdf.text("Linker Rand:", LEFT_MARGIN + 2, 15);
  pdf.text("25mm", LEFT_MARGIN + 2, 20);
  
  pdf.line(PAGE_WIDTH - RIGHT_MARGIN, 0, PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT);
  pdf.text("Rechter Rand:", PAGE_WIDTH - RIGHT_MARGIN - 25, 15);
  pdf.text("20mm", PAGE_WIDTH - RIGHT_MARGIN - 15, 20);
  
  const footerBottom = PAGE_HEIGHT - 7;
  pdf.setDrawColor(128, 0, 128);
  pdf.rect(LEFT_MARGIN, FOOTER_TOP, PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN, footerBottom - FOOTER_TOP);
  pdf.line(0, FOOTER_TOP, PAGE_WIDTH, FOOTER_TOP);
  pdf.line(0, footerBottom, PAGE_WIDTH, footerBottom);
  pdf.setTextColor(128, 0, 128);
  pdf.text("Fußzeile: 272mm", 5, FOOTER_TOP - 2);
  pdf.text("Unterer Rand: 7mm", 5, footerBottom + 3);
  
  const paginationY = 263.77;
  pdf.setDrawColor(255, 0, 255);
  pdf.rect(LEFT_MARGIN, paginationY - 2, PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN, 4);
  pdf.setTextColor(255, 0, 255);
  pdf.setFontSize(6);
  pdf.text("Paginierung: Unterkante 4.23mm über Fußzeile", LEFT_MARGIN + 2, paginationY + 1);
  
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  pdf.rect(PAGE_WIDTH - 50, 5, 45, 25);
  pdf.setFontSize(7);
  pdf.setTextColor(0, 0, 0);
  pdf.text("DIN A4:", PAGE_WIDTH - 48, 10);
  pdf.text("210×297mm", PAGE_WIDTH - 48, 15);
  pdf.text("Font: Arial", PAGE_WIDTH - 48, 20);
  pdf.text("Size: 11pt", PAGE_WIDTH - 48, 25);
}

function renderFooterBlocks(pdf: jsPDF, template: LetterTemplate | null) {
  if (!template?.footer_blocks) return;
  
  const footerY = FOOTER_TOP + 3;
  const availableWidth = 165;
  let currentX = LEFT_MARGIN;
  
  const sortedBlocks = buildFooterBlocksFromStored(template.footer_blocks);

  sortedBlocks.forEach((block) => {
    const textBlock = toPdfTextBlock(block, availableWidth, currentX, footerY);
    if (!textBlock) return;

    const blockWidth = textBlock.widthMm;
    const fontSize = textBlock.font.size;
    const lineHeight = textBlock.spacing.lineHeight;
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', textBlock.font.weight);
    pdf.setTextColor(...textBlock.font.color);

    let blockY = textBlock.origin.y;

    if (textBlock.title) {
      if (textBlock.titleHighlight) {
        const titleFontSize = Math.max(8, Math.min(20, textBlock.titleFont?.size || 13));
        const titleFontWeight = textBlock.titleFont?.weight || 'bold';
        const titleColor = textBlock.titleFont?.color || [16, 112, 48];
        pdf.setFont('helvetica', titleFontWeight);
        pdf.setFontSize(titleFontSize);
        pdf.setTextColor(...titleColor);
        const wrappedTitle = pdf.splitTextToSize(textBlock.title, blockWidth - 2);
        const titleLineHeight = titleFontSize * 0.4;
        wrappedTitle.forEach((titleLine: string) => {
          if (blockY <= 290) {
            pdf.text(titleLine, currentX + 1, blockY);
            blockY += titleLineHeight;
          }
        });
        blockY += 2;
        pdf.setFontSize(fontSize);
        pdf.setTextColor(0, 0, 0);
      } else {
        pdf.setFont('helvetica', 'bold');
        const wrappedTitle = pdf.splitTextToSize(textBlock.title, blockWidth - 2);
        wrappedTitle.forEach((titleLine: string) => {
          if (blockY <= 290) {
            pdf.text(titleLine, currentX + 1, blockY);
            blockY += lineHeight;
          }
        });
        blockY += 1;
      }
      pdf.setFont('helvetica', textBlock.font.weight);
    }

    textBlock.lines.forEach((line) => {
      if (blockY > 290) return;
      let formattedLine = line;
      if (formattedLine.startsWith('Tel: ')) formattedLine = formattedLine.replace('Tel: ', '');
      if (formattedLine.startsWith('Web: ')) formattedLine = formattedLine.replace('Web: ', '').replace(/^https?:\/\/(www\.)?/, '');
      if (formattedLine.includes('@') && !formattedLine.startsWith('@')) formattedLine = formattedLine.replace('@', '@\n');
      if (formattedLine.startsWith('Instagram: ')) formattedLine = formattedLine.replace('Instagram: ', '@ ');
      if (formattedLine.startsWith('Facebook: ')) formattedLine = formattedLine.replace('Facebook: ', '@ ');
      
      const wrappedLines = pdf.splitTextToSize(formattedLine, blockWidth - 2);
      wrappedLines.forEach((wrappedLine: string) => {
        if (blockY <= 290) {
          pdf.text(wrappedLine, currentX + 1, blockY);
          blockY += lineHeight;
        }
      });
    });
    
    currentX += blockWidth;
  });
  
  pdf.setTextColor(0, 0, 0);
}

function renderFooterBlocksSimple(pdf: jsPDF, template: LetterTemplate | null) {
  if (!template?.footer_blocks) return;
  
  const footerY = FOOTER_TOP + 3;
  const availableWidth = 165;
  let currentX = LEFT_MARGIN;
  
  const sortedBlocks = buildFooterBlocksFromStored(template.footer_blocks);

  sortedBlocks.forEach((block) => {
    const textBlock = toPdfTextBlock(block, availableWidth, currentX, footerY);
    if (!textBlock) return;

    const blockWidth = textBlock.widthMm;
    const fontSize = textBlock.font.size;
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', textBlock.font.weight);
    pdf.setTextColor(...textBlock.font.color);
    let blockY = textBlock.origin.y;

    textBlock.lines.forEach((line) => {
      if (blockY > 290) return;
      const textWidth = pdf.getTextWidth(line);
      if (textWidth <= blockWidth - 2) {
        pdf.text(line, currentX + 1, blockY);
        blockY += fontSize;
      } else {
        const words = line.split(' ');
        let currentLine = '';
        words.forEach((word: string) => {
          const testLine = currentLine ? currentLine + ' ' + word : word;
          const testWidth = pdf.getTextWidth(testLine);
          if (testWidth <= blockWidth - 2) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              pdf.text(currentLine, currentX + 1, blockY);
              blockY += fontSize;
            }
            currentLine = word;
          }
        });
        if (currentLine && blockY <= 290) {
          pdf.text(currentLine, currentX + 1, blockY);
          blockY += fontSize;
        }
      }
    });
    
    currentX += blockWidth;
  });
  
  pdf.setTextColor(0, 0, 0);
}

interface GeneratePDFOptions {
  letter: Letter;
  template: LetterTemplate | null;
  senderInfo: SenderInfoContract | null;
  informationBlock: InformationBlockContract | null;
  attachments: AttachmentContract[];
  showPagination: boolean;
  returnBlob?: boolean;
  debugMode?: boolean;
  contact?: DbContact | null;
}

function renderBlockLinesToPdf(pdf: jsPDF, lines: BlockLine[], x: number, startY: number, maxWidth: number): void {
  let y = startY;
  for (const line of lines) {
    if (line.type === 'spacer') {
      y += line.spacerHeight || 2;
      continue;
    }
    const fontSize = line.fontSize || 9;
    pdf.setFontSize(fontSize);
    const lineHeightMm = fontSize * 0.45;
    
    if (line.type === 'label-value') {
      if (line.label) {
        pdf.setFont('helvetica', line.labelBold !== false ? 'bold' : 'normal');
        pdf.text(line.label, x, y);
        const labelWidth = pdf.getTextWidth(line.label);
        if (line.value) {
          pdf.setFont('helvetica', line.valueBold ? 'bold' : 'normal');
          pdf.text(line.value, x + labelWidth, y);
        }
      } else if (line.value) {
        pdf.setFont('helvetica', line.valueBold ? 'bold' : 'normal');
        pdf.text(line.value, x, y);
      }
    } else {
      // text-only
      pdf.setFont('helvetica', line.valueBold ? 'bold' : 'normal');
      const wrappedLines = pdf.splitTextToSize(line.value || '', maxWidth);
      wrappedLines.forEach((wl: string) => {
        pdf.text(wl, x, y);
        y += lineHeightMm;
      });
      continue; // already advanced y
    }
    y += lineHeightMm;
  }
  pdf.setFont('helvetica', 'normal');
}
function renderFoldHoleMarks(pdf: jsPDF, marks: FoldHoleMarks): void {
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(marks.strokeWidthPt ? marks.strokeWidthPt * 0.3528 : 0.3);
  const left = marks.left || 3;
  const foldWidth = marks.foldMarkWidth || 5;
  const holeWidth = marks.holeMarkWidth || 8;
  if (marks.topMarkY) pdf.line(left, marks.topMarkY, left + foldWidth, marks.topMarkY);
  if (marks.holeMarkY) pdf.line(left, marks.holeMarkY, left + holeWidth, marks.holeMarkY);
  if (marks.bottomMarkY) pdf.line(left, marks.bottomMarkY, left + foldWidth, marks.bottomMarkY);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
}

export async function generatePDF(options: GeneratePDFOptions): Promise<{ blob: Blob; filename: string } | void> {
  const { letter, template, senderInfo, informationBlock, attachments, showPagination, returnBlob = false, debugMode = false, contact } = options;
  
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  const layout = toLayoutSettings(template?.layout_settings);
  const pageMetrics: PageMetrics = {
    widthMm: layout.pageWidth,
    heightMm: layout.pageHeight,
    margins: {
      leftMm: layout.margins.left,
      rightMm: layout.margins.right,
    },
    footerTopMm: layout.footer.top,
    contentTopMm: layout.content.top,
    paginationGapMm: DEFAULT_PAGE_METRICS.paginationGapMm,
  };
  
  // ── Build FULL variable map identical to LetterEditor ──
  const recipientVarData = contact ? {
    name: contact.name,
    street: [contact.private_street, contact.private_house_number].filter(Boolean).join(' ') || [contact.business_street, contact.business_house_number].filter(Boolean).join(' '),
    postal_code: contact.private_postal_code || contact.business_postal_code || '',
    city: contact.private_city || contact.business_city || '',
    country: contact.private_country || contact.business_country || '',
    gender: contact.gender || '',
    title: contact.title || '',
    last_name: contact.last_name || contact.name?.split(' ').pop() || '',
  } : letter.recipient_name ? { name: letter.recipient_name, street: '', postal_code: '', city: '', country: '' } : null;

  const senderVarData = senderInfo ? {
    name: senderInfo.name, organization: senderInfo.organization,
    street: senderInfo.street, house_number: senderInfo.house_number,
    postal_code: senderInfo.postal_code, city: senderInfo.city,
    wahlkreis_street: senderInfo.wahlkreis_street ?? undefined,
    wahlkreis_house_number: senderInfo.wahlkreis_house_number ?? undefined,
    wahlkreis_postal_code: senderInfo.wahlkreis_postal_code ?? undefined,
    wahlkreis_city: senderInfo.wahlkreis_city ?? undefined,
    landtag_street: senderInfo.landtag_street ?? undefined,
    landtag_house_number: senderInfo.landtag_house_number ?? undefined,
    landtag_postal_code: senderInfo.landtag_postal_code ?? undefined,
    landtag_city: senderInfo.landtag_city ?? undefined,
    phone: senderInfo.phone ?? undefined,
    email: senderInfo.email,
    wahlkreis_email: senderInfo.wahlkreis_email ?? undefined,
    landtag_email: senderInfo.landtag_email ?? undefined,
    return_address_line: senderInfo.return_address_line ?? undefined,
    website: senderInfo.website ?? undefined,
  } : null;

  const infoBlockVarData = informationBlock ? {
    reference: isRecord(informationBlock.block_data) && typeof informationBlock.block_data.reference_pattern === 'string' ? informationBlock.block_data.reference_pattern : undefined,
    handler: isRecord(informationBlock.block_data) && typeof informationBlock.block_data.contact_name === 'string' ? informationBlock.block_data.contact_name : undefined,
    our_reference: '',
  } : null;

  const varMap = buildVariableMap(
    { subject: letter.subject || '', letterDate: letter.letter_date || undefined, referenceNumber: letter.reference_number || undefined },
    senderVarData, recipientVarData, infoBlockVarData, attachments
  );

  // ── Substitute ALL blockContent areas from template ──
  const blockContent = layout.blockContent || {};
  const substitutedLineBlocks: Record<string, BlockLine[]> = {};
  for (const [key, data] of Object.entries(blockContent)) {
    if (isLineMode(data)) {
      substitutedLineBlocks[key] = substituteBlockLines(data.lines, varMap);
    }
  }

  // Debug guides only in debug mode
  if (debugMode) {
    drawDebugGuides(pdf, 1);
  }
  renderFooterBlocks(pdf, template);
  
  // ── Fold & hole marks ──
  const foldMarks = toFoldHoleMarks(layout.foldHoleMarks);
  if (foldMarks) {
    renderFoldHoleMarks(pdf, foldMarks);
  }

  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
  
  // Template header
  if (template) {
    const headerRenderer = new HeaderRenderer(pdf, LEFT_MARGIN, undefined, debugMode);
    await headerRenderer.renderHeader(template);
  }
  
  // ── Return address ──
  const returnAddressFontSize = layout.addressField?.returnAddressFontSize || 8;
  const recipientFontSize = layout.addressField?.recipientFontSize || 10;
  let addressYPos = ADDRESS_FIELD_TOP + 17.7;

  if (substitutedLineBlocks['returnAddress']?.length) {
    renderBlockLinesToPdf(pdf, substitutedLineBlocks['returnAddress'], ADDRESS_FIELD_LEFT, ADDRESS_FIELD_TOP + 2, ADDRESS_FIELD_WIDTH);
  } else if (senderInfo?.return_address_line) {
    const returnAddressMaxWidth = Math.max(10, ADDRESS_FIELD_WIDTH - 10);
    pdf.setFontSize(returnAddressFontSize);
    pdf.setFont('helvetica', 'normal');
    const returnAddressLines = pdf.splitTextToSize(senderInfo.return_address_line, returnAddressMaxWidth);
    const returnAddressStartY = addressYPos - 2;
    const lineHeightMm = (pdf.getLineHeightFactor() * returnAddressFontSize) / pdf.internal.scaleFactor;
    const lastLineBaselineY = returnAddressStartY + (returnAddressLines.length - 1) * lineHeightMm;
    pdf.text(returnAddressLines, ADDRESS_FIELD_LEFT, returnAddressStartY);
    const lastLine = returnAddressLines[returnAddressLines.length - 1] || '';
    const lastLineWidth = pdf.getTextWidth(lastLine);
    const underlineY = lastLineBaselineY + 0.6;
    pdf.line(ADDRESS_FIELD_LEFT, underlineY, ADDRESS_FIELD_LEFT + lastLineWidth, underlineY);
    addressYPos = underlineY + 2.2;
  }
  
  // ── Recipient address ──
  if (substitutedLineBlocks['addressField']?.length) {
    renderBlockLinesToPdf(pdf, substitutedLineBlocks['addressField'], ADDRESS_FIELD_LEFT, addressYPos, ADDRESS_FIELD_WIDTH);
  } else if (letter.recipient_name || letter.recipient_address) {
    pdf.setFontSize(recipientFontSize);
    pdf.setFont('helvetica', 'normal');
    const recipientLineHeight = recipientFontSize * 0.4;
    if (letter.recipient_name) {
      pdf.text(letter.recipient_name, ADDRESS_FIELD_LEFT, addressYPos);
      addressYPos += recipientLineHeight;
    }
    if (letter.recipient_address) {
      const addressLines = letter.recipient_address.split('\n').filter(line => line.trim());
      addressLines.forEach(line => {
        if (addressYPos < ADDRESS_FIELD_TOP + ADDRESS_FIELD_HEIGHT - 2) {
          pdf.text(line.trim(), ADDRESS_FIELD_LEFT, addressYPos);
          addressYPos += recipientLineHeight;
        }
      });
    }
  }
  
  // ── Information block ──
  let infoYPos = INFO_BLOCK_TOP + 3;

  if (substitutedLineBlocks['infoBlock']?.length) {
    renderBlockLinesToPdf(pdf, substitutedLineBlocks['infoBlock'], INFO_BLOCK_LEFT, infoYPos, INFO_BLOCK_WIDTH);
  } else if (informationBlock) {
    // Fallback to legacy info block rendering
    const infoData = isRecord(informationBlock.block_data) ? informationBlock.block_data : null;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(informationBlock.label || 'Information', INFO_BLOCK_LEFT, infoYPos);
    infoYPos += 5;
    pdf.setFont('helvetica', 'normal');
    
    switch (informationBlock.block_type) {
      case 'contact':
        {
          const contactName = getStringValue(infoData, 'contact_name');
          const contactPhone = getStringValue(infoData, 'contact_phone');
          const contactEmail = getStringValue(infoData, 'contact_email');
          if (contactName) { pdf.text(contactName, INFO_BLOCK_LEFT, infoYPos); infoYPos += 4; }
          if (contactPhone) { pdf.text(`Tel: ${contactPhone}`, INFO_BLOCK_LEFT, infoYPos); infoYPos += 4; }
          if (contactEmail) { pdf.text(contactEmail, INFO_BLOCK_LEFT, infoYPos); infoYPos += 4; }
        }
        break;
      case 'date': {
        const date = new Date();
        const formatDate = (d: Date, fmt: string) => {
          switch (fmt) {
            case 'dd.mm.yyyy': return format(d, 'd. MMMM yyyy', { locale: de });
            case 'dd.mm.yy': return d.toLocaleDateString('de-DE', { year: '2-digit', month: '2-digit', day: '2-digit' });
            case 'yyyy-mm-dd': return d.toISOString().split('T')[0];
            default: return format(d, 'd. MMMM yyyy', { locale: de });
          }
        };
        pdf.text(formatDate(date, getStringValue(infoData, 'date_format') || 'dd.mm.yyyy'), INFO_BLOCK_LEFT, infoYPos);
        infoYPos += 4;
        if (getBooleanValue(infoData, 'show_time')) {
          pdf.text(`${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`, INFO_BLOCK_LEFT, infoYPos);
          infoYPos += 4;
        }
        break;
      }
      case 'reference': {
        const refText = `${getStringValue(infoData, 'reference_prefix') || ''}${letter.reference_number || getStringValue(infoData, 'reference_pattern') || ''}`;
        pdf.text(refText, INFO_BLOCK_LEFT, infoYPos);
        infoYPos += 4;
        break;
      }
      case 'custom':
        if (getStringValue(infoData, 'custom_content') || (Array.isArray(infoData?.custom_lines))) {
          const customLines = toStringArray(infoData?.custom_lines).length > 0
            ? toStringArray(infoData?.custom_lines)
            : String(getStringValue(infoData, 'custom_content') || '').split('\n');
          customLines
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .forEach((line) => {
            if (infoYPos < ADDRESS_FIELD_TOP + ADDRESS_FIELD_HEIGHT - 5) {
              pdf.text(line, INFO_BLOCK_LEFT, infoYPos);
              infoYPos += 4;
            }
          });
        }
        break;
    }
  }
  
  // Letter date (only if not already in info block lines)
  if (letter.letter_date && !substitutedLineBlocks['infoBlock']?.length) {
    const hasDateBlock = informationBlock?.block_type === 'date';
    if (!hasDateBlock && infoYPos < INFO_BLOCK_TOP + INFO_BLOCK_WIDTH - 10) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Datum', INFO_BLOCK_LEFT, infoYPos);
      infoYPos += 5;
      pdf.setFont('helvetica', 'normal');
      const formattedDate = format(new Date(letter.letter_date), 'd. MMMM yyyy', { locale: de });
      pdf.text(formattedDate, INFO_BLOCK_LEFT, infoYPos);
    }
  }
  
  // Subject line
  const subjectFontSize = layout.subject?.fontSize || 13;
  const contentFontSize = layout.content?.fontSize || 11;
  const lineHeight = layout.content?.lineHeight || 4.5;
  let contentStartY = CONTENT_TOP + 3;
  
  if (letter.subject || letter.title) {
    pdf.setFontSize(subjectFontSize);
    pdf.setFont('helvetica', layout.subject?.fontWeight || 'bold');
    pdf.text(letter.subject || letter.title, LEFT_MARGIN, contentStartY);
    contentStartY += 9; // 2 blank lines after subject (matching HTML: height 9mm)
  }
  
  // ── Salutation (with {{anrede}} substitution) ──
  let salutationText = layout.salutation?.template || '';
  if (salutationText === '{{anrede}}') {
    salutationText = varMap['{{anrede}}'] || 'Sehr geehrte Damen und Herren,';
  } else if (salutationText.includes('{{')) {
    for (const [placeholder, value] of Object.entries(varMap)) {
      salutationText = salutationText.split(placeholder).join(value);
    }
  }
  if (salutationText) {
    const salutationFontSize = layout.salutation?.fontSize || contentFontSize;
    pdf.setFontSize(salutationFontSize);
    pdf.setFont('helvetica', 'normal');
    pdf.text(salutationText, LEFT_MARGIN, contentStartY);
    contentStartY += lineHeight; // 1 blank line after salutation
  }
  
  // Letter content
  pdf.setFontSize(contentFontSize);
  pdf.setFont('helvetica', 'normal');
  const contentText = letter.content_html ? convertHtmlToText(letter.content_html) : letter.content;
  
  let currentPage = 1;
  let letterPages = 1;
  const shouldShowPagination = showPagination || letter.show_pagination;
  
  const renderContentText = (text: string, startY: number): number => {
    let currentY = startY;
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    paragraphs.forEach((paragraph, paragIndex) => {
      const currentMaxWidth = pageMetrics.widthMm - pageMetrics.margins.leftMm - pageMetrics.margins.rightMm;
      const lines = pdf.splitTextToSize(paragraph.trim(), currentMaxWidth);
      
      lines.forEach((line: string) => {
        const paginationTop = 263.77;
        const contentBottom = shouldShowPagination
          ? paginationTop - pageMetrics.paginationGapMm
          : Math.min(pageMetrics.contentTopMm + 165, pageMetrics.footerTopMm - pageMetrics.paginationGapMm);
        
        if (currentY + lineHeight > contentBottom) {
          pdf.addPage();
          letterPages++;
          currentPage++;
          if (debugMode) drawDebugGuides(pdf, currentPage);
          renderFooterBlocksSimple(pdf, template);
          currentY = layout.content?.page2TopMm || 30;
          pdf.setFontSize(contentFontSize);
          pdf.setFont('helvetica', 'normal');
        }
        
        pdf.text(line, pageMetrics.margins.leftMm, currentY);
        currentY += lineHeight;
      });
      
      if (paragIndex < paragraphs.length - 1) currentY += lineHeight / 2;
    });
    return currentY;
  };
  
  let endY = renderContentText(contentText, contentStartY);
  
  // Closing formula and signature
  if (layout.closing?.formula) {
    endY += lineHeight; // blank line before closing
    pdf.setFontSize(layout.closing?.fontSize || contentFontSize);
    pdf.setFont('helvetica', 'normal');
    pdf.text(layout.closing.formula, LEFT_MARGIN, endY);
    endY += lineHeight;
    
    // Signature image
    const signatureImagePath = layout.closing?.signatureImagePath;
    if (signatureImagePath) {
      const signatureUrl = getLetterAssetPublicUrl(signatureImagePath);
      if (signatureUrl) {
        try {
          const response = await fetch(signatureUrl);
          if (response.ok) {
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            const sigHeight = 9; // ~9mm for signature
            pdf.addImage(base64, 'PNG', LEFT_MARGIN, endY, 30, sigHeight);
            endY += sigHeight + 1;
          }
        } catch (e) {
          debugConsole.warn('Could not load signature image:', e);
          endY += 13.5; // fallback gap for missing signature
        }
      } else {
        endY += 13.5;
      }
    } else {
      endY += 4.5; // gap before name when no signature image
    }
    
    // Signature name
    if (layout.closing?.signatureName) {
      pdf.setFont('helvetica', 'normal');
      pdf.text(layout.closing.signatureName, LEFT_MARGIN, endY);
      endY += lineHeight;
    }
    if (layout.closing?.signatureTitle) {
      pdf.setFont('helvetica', 'normal');
      pdf.text(layout.closing.signatureTitle, LEFT_MARGIN, endY);
      endY += lineHeight;
    }
  }
  
  // Attachments
  if (attachments && attachments.length > 0) {
    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      try {
        const { data: fileData, error: fileError } = await supabase.storage.from('documents').download(attachment.file_path);
        if (fileError) { debugConsole.error('Error downloading attachment:', fileError); continue; }
        
        pdf.addPage();
        currentPage++;
        const attachmentMargin = 20;
        
        // Debug guides for attachments
        if (debugMode) {
          pdf.setLineWidth(0.2);
          pdf.setDrawColor(255, 0, 255);
          pdf.line(0, attachmentMargin, PAGE_WIDTH, attachmentMargin);
          pdf.setFontSize(8);
          pdf.setTextColor(255, 0, 255);
          pdf.text("20mm - Anlage Oberrand", 5, attachmentMargin - 3);
          pdf.line(0, PAGE_HEIGHT - attachmentMargin, PAGE_WIDTH, PAGE_HEIGHT - attachmentMargin);
          pdf.line(attachmentMargin, 0, attachmentMargin, PAGE_HEIGHT);
          pdf.line(PAGE_WIDTH - attachmentMargin, 0, PAGE_WIDTH - attachmentMargin, PAGE_HEIGHT);
          pdf.setDrawColor(200, 0, 200);
          pdf.rect(attachmentMargin, attachmentMargin, PAGE_WIDTH - 2 * attachmentMargin, PAGE_HEIGHT - 2 * attachmentMargin);
        }
        pdf.setTextColor(0, 0, 0);
        pdf.setDrawColor(0, 0, 0);
        
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        const attachmentTitle = attachment.title || attachment.file_name;
        pdf.text(`Anlage ${i + 1}: ${attachmentTitle}`, attachmentMargin, attachmentMargin + 10);
        
        const reader = new FileReader();
        await new Promise((resolve) => {
          reader.onload = function() {
            try {
              if (attachment.file_type?.startsWith('image/')) {
                const imgData = reader.result as string;
                const availableWidth = PAGE_WIDTH - 2 * attachmentMargin;
                const availableHeight = PAGE_HEIGHT - 2 * attachmentMargin - 30;
                pdf.addImage(imgData, 'JPEG', attachmentMargin, attachmentMargin + 20, availableWidth, Math.min(200, availableHeight));
              } else if (attachment.file_type === 'application/pdf') {
                pdf.setFontSize(11);
                pdf.setFont('helvetica', 'normal');
                pdf.text('PDF-Dokument eingebettet:', attachmentMargin, attachmentMargin + 30);
                pdf.text(`Dateiname: ${attachment.file_name}`, attachmentMargin, attachmentMargin + 45);
                pdf.text(`Größe: ${attachment.file_size ? Math.round(attachment.file_size / 1024) + ' KB' : 'Unbekannt'}`, attachmentMargin, attachmentMargin + 60);
                const boxWidth = PAGE_WIDTH - 2 * attachmentMargin;
                pdf.setDrawColor(200, 200, 200);
                pdf.rect(attachmentMargin, attachmentMargin + 70, boxWidth, 150);
                pdf.setFontSize(24);
                pdf.setTextColor(150, 150, 150);
                pdf.text('PDF', attachmentMargin + boxWidth/2 - 15, attachmentMargin + 70 + 75);
                pdf.setTextColor(0, 0, 0);
              } else {
                pdf.setFontSize(11);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Dateiname: ${attachment.file_name}`, attachmentMargin, attachmentMargin + 30);
                pdf.text(`Dateityp: ${attachment.file_type || 'Unbekannt'}`, attachmentMargin, attachmentMargin + 45);
                pdf.text(`Größe: ${attachment.file_size ? Math.round(attachment.file_size / 1024) + ' KB' : 'Unbekannt'}`, attachmentMargin, attachmentMargin + 60);
                const boxWidth = PAGE_WIDTH - 2 * attachmentMargin;
                pdf.setDrawColor(200, 200, 200);
                pdf.rect(attachmentMargin, attachmentMargin + 70, boxWidth, 100);
                pdf.setFontSize(16);
                pdf.setTextColor(100, 100, 100);
                pdf.text('DATEI', attachmentMargin + boxWidth/2 - 15, attachmentMargin + 70 + 50);
                pdf.setTextColor(0, 0, 0);
              }
            } catch (error) {
              debugConsole.error('Error embedding attachment:', error);
              pdf.setFontSize(11);
              pdf.setFont('helvetica', 'normal');
              pdf.text('Anhang konnte nicht eingebettet werden', attachmentMargin, attachmentMargin + 30);
            }
            resolve(null);
          };
          reader.readAsDataURL(fileData);
        });
      } catch (error) {
        debugConsole.error('Error processing attachment:', error);
        pdf.addPage();
        currentPage++;
        const attachmentMargin = 20;
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Anlage ${i + 1}: ${attachment.title || attachment.file_name}`, attachmentMargin, attachmentMargin + 10);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Fehler beim Laden der Anlage', attachmentMargin, attachmentMargin + 30);
      }
    }
  }
  
  // Pagination
  if (shouldShowPagination) {
    const totalLetterPages = letterPages;
    for (let page = 1; page <= totalLetterPages; page++) {
      pdf.setPage(page);
      const paginationY = 263.77;
      
      if (debugMode) {
        pdf.setDrawColor(255, 0, 255);
        pdf.setLineWidth(0.1);
        const pageText = `Seite ${page} von ${totalLetterPages}`;
        const pageTextWidth = pdf.getTextWidth(pageText);
        const pageTextX = (PAGE_WIDTH - pageTextWidth) / 2;
        pdf.rect(pageTextX - 2, paginationY - 3, pageTextWidth + 4, 5);
        pdf.setTextColor(255, 0, 255);
        pdf.setFontSize(6);
        pdf.text("Pagination: Unterkante 4.23mm über Fußzeile", pageTextX, paginationY - 4);
      }
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      const pt = `Seite ${page} von ${totalLetterPages}`;
      const ptw = pdf.getTextWidth(pt);
      pdf.text(pt, PAGE_WIDTH - RIGHT_MARGIN - ptw, paginationY);
      pdf.setTextColor(0, 0, 0);
    }
  }
  
  const fileName = `${letter.title || 'Brief'}_${new Date().toISOString().split('T')[0]}.pdf`;
  
  if (returnBlob) {
    return { blob: pdf.output('blob'), filename: fileName };
  } else {
    pdf.save(fileName);
  }
}
