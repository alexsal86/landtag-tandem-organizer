import jsPDF from 'jspdf';
import { debugConsole } from '@/utils/debugConsole';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { HeaderRenderer } from '@/services/headerRenderer';
import { buildFooterBlocksFromStored, resolveBlockWidthMm } from '@/components/letters/footerBlockUtils';
import { supabase } from '@/integrations/supabase/client';
import { buildVariableMap, substituteBlockLines, isLineMode } from '@/lib/letterVariables';
import type { BlockLine } from '@/components/letters/BlockLineEditor';
import { getBlockLineFontStack } from '@/components/letters/BlockLineEditor';
import { getLetterAssetPublicUrl } from '@/components/letters/letterAssetUrls';
import type { Letter, LetterTemplate } from './types';

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
  
  sortedBlocks.forEach((block: any) => {
    const blockContent = Array.isArray(block.lines)
      ? block.lines.map((line: any) => line.type === 'spacer' ? '' : (line.type === 'label-value' ? `${line.label || ''} ${line.value || ''}`.trim() : (line.value || ''))).join('\n')
      : (block.content || '');
    if (!blockContent) return;
    
    const blockWidth = resolveBlockWidthMm(block.widthUnit || 'percent', Number(block.widthValue) || 25, availableWidth);
    const fontSize = Math.max(6, Math.min(14, block.fontSize || 8));
    const lineHeightMultiplier = block.lineHeight || 0.8;
    const lineHeight = lineHeightMultiplier <= 0.8 ? fontSize * 0.4 : fontSize * lineHeightMultiplier * 0.5;
    pdf.setFontSize(fontSize);
    
    const fontWeight = block.fontWeight === 'bold' ? 'bold' : 'normal';
    pdf.setFont('helvetica', fontWeight);
    
    if (block.color && block.color.startsWith('#')) {
      try {
        const hex = block.color.substring(1);
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        pdf.setTextColor(r, g, b);
      } catch (e) {
        pdf.setTextColor(0, 0, 0);
      }
    } else {
      pdf.setTextColor(0, 0, 0);
    }
    
    let blockY = footerY;
    
    if (block.title) {
      if (block.titleHighlight) {
        const titleFontSize = Math.max(8, Math.min(20, block.titleFontSize || 13));
        const titleFontWeight = block.titleFontWeight || 'bold';
        const titleColor = block.titleColor || '#107030';
        
        pdf.setFont('helvetica', titleFontWeight);
        pdf.setFontSize(titleFontSize);
        
        if (titleColor.startsWith('#')) {
          try {
            const hex = titleColor.substring(1);
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            pdf.setTextColor(r, g, b);
          } catch (e) {
            pdf.setTextColor(16, 112, 48);
          }
        } else {
          pdf.setTextColor(16, 112, 48);
        }
        
        const wrappedTitle = pdf.splitTextToSize(block.title, blockWidth - 2);
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
        const wrappedTitle = pdf.splitTextToSize(block.title, blockWidth - 2);
        wrappedTitle.forEach((titleLine: string) => {
          if (blockY <= 290) {
            pdf.text(titleLine, currentX + 1, blockY);
            blockY += lineHeight;
          }
        });
        blockY += 1;
      }
      pdf.setFont('helvetica', fontWeight);
    }
    
    const lines = blockContent.split('\n');
    lines.forEach((line: string) => {
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
  
  sortedBlocks.forEach((block: any) => {
    const blockContent = Array.isArray(block.lines)
      ? block.lines.map((line: any) => line.type === 'spacer' ? '' : (line.type === 'label-value' ? `${line.label || ''} ${line.value || ''}`.trim() : (line.value || ''))).join('\n')
      : (block.content || '');
    if (!blockContent) return;
    
    const blockWidth = resolveBlockWidthMm(block.widthUnit || 'percent', Number(block.widthValue) || 25, availableWidth);
    const fontSize = Math.max(6, Math.min(14, block.fontSize || 8));
    pdf.setFontSize(fontSize);
    const fontWeight = block.fontWeight === 'bold' ? 'bold' : 'normal';
    pdf.setFont('helvetica', fontWeight);
    
    if (block.color && block.color.startsWith('#')) {
      try {
        const hex = block.color.substring(1);
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        pdf.setTextColor(r, g, b);
      } catch (e) {
        pdf.setTextColor(0, 0, 0);
      }
    } else {
      pdf.setTextColor(0, 0, 0);
    }
    
    const lines = blockContent.split('\n');
    let blockY = footerY;
    
    lines.forEach((line: string) => {
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
  senderInfo: any;
  informationBlock: any;
  attachments: any[];
  showPagination: boolean;
  returnBlob?: boolean;
  debugMode?: boolean;
}

export async function generatePDF(options: GeneratePDFOptions): Promise<{ blob: Blob; filename: string } | void> {
  const { letter, template, senderInfo, informationBlock, attachments, showPagination, returnBlob = false, debugMode = false } = options;
  
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Get layout settings from template
  const layout = template?.layout_settings || {
    pageWidth: 210, pageHeight: 297,
    margins: { left: 25, right: 20, top: 45, bottom: 25 },
    header: { height: 45, marginBottom: 8.46 },
    addressField: { top: 46, left: 25, width: 85, height: 40, returnAddressFontSize: 8, recipientFontSize: 10 },
    infoBlock: { top: 50, left: 125, width: 75, height: 40 },
    subject: { top: 98.46, marginBottom: 8, fontSize: 13 },
    content: { top: 98.46, maxHeight: 165, lineHeight: 4.5, fontSize: 11 },
    footer: { top: 272, height: 18 },
  };
  
  // Debug guides only in debug mode
  if (debugMode) {
    drawDebugGuides(pdf, 1);
  }
  renderFooterBlocks(pdf, template);
  
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
  
  // Template header
  if (template) {
    const headerRenderer = new HeaderRenderer(pdf, LEFT_MARGIN, undefined, debugMode);
    await headerRenderer.renderHeader(template as any);
  }
  
  // Return address line
  const returnAddressFontSize = layout.addressField?.returnAddressFontSize || 8;
  const recipientFontSize = layout.addressField?.recipientFontSize || 10;
  let addressYPos = ADDRESS_FIELD_TOP + 17.7;
  if (senderInfo?.return_address_line) {
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
  
  // Recipient address
  if (letter.recipient_name || letter.recipient_address) {
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
  
  // Information block - use BlockLine data from template if available
  const blockContent = (layout as any).blockContent || {};
  const infoBlockData = blockContent.infoBlock;
  let infoYPos = INFO_BLOCK_TOP + 3;
  
  if (infoBlockData && isLineMode(infoBlockData)) {
    // Use line-mode data with variable substitution
    const varMap = buildVariableMap(
      { subject: letter.subject || '', letterDate: letter.letter_date || undefined, referenceNumber: letter.reference_number || undefined },
      senderInfo ? { name: senderInfo.name, organization: senderInfo.organization, phone: senderInfo.phone, email: senderInfo.email } : null,
      letter.recipient_name ? { name: letter.recipient_name } : null,
      null, null
    );
    const substitutedLines = substituteBlockLines(infoBlockData.lines, varMap);
    renderBlockLinesToPdf(pdf, substitutedLines, INFO_BLOCK_LEFT, infoYPos, INFO_BLOCK_WIDTH);
  } else if (informationBlock) {
    // Fallback to legacy info block rendering
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(informationBlock.label || 'Information', INFO_BLOCK_LEFT, infoYPos);
    infoYPos += 5;
    pdf.setFont('helvetica', 'normal');
    
    switch (informationBlock.block_type) {
      case 'contact':
        if (informationBlock.block_data?.contact_name) { pdf.text(informationBlock.block_data.contact_name, INFO_BLOCK_LEFT, infoYPos); infoYPos += 4; }
        if (informationBlock.block_data?.contact_phone) { pdf.text(`Tel: ${informationBlock.block_data.contact_phone}`, INFO_BLOCK_LEFT, infoYPos); infoYPos += 4; }
        if (informationBlock.block_data?.contact_email) { pdf.text(informationBlock.block_data.contact_email, INFO_BLOCK_LEFT, infoYPos); infoYPos += 4; }
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
        pdf.text(formatDate(date, informationBlock.block_data?.date_format || 'dd.mm.yyyy'), INFO_BLOCK_LEFT, infoYPos);
        infoYPos += 4;
        if (informationBlock.block_data?.show_time) {
          pdf.text(`${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`, INFO_BLOCK_LEFT, infoYPos);
          infoYPos += 4;
        }
        break;
      }
      case 'reference': {
        const refText = `${informationBlock.block_data?.reference_prefix || ''}${letter.reference_number || informationBlock.block_data?.reference_pattern || ''}`;
        pdf.text(refText, INFO_BLOCK_LEFT, infoYPos);
        infoYPos += 4;
        break;
      }
      case 'custom':
        if (informationBlock.block_data?.custom_content || informationBlock.block_data?.custom_lines) {
          const customLines = Array.isArray(informationBlock.block_data?.custom_lines)
            ? informationBlock.block_data.custom_lines
            : String(informationBlock.block_data?.custom_content || '').split('\n');
          customLines.map((line: string) => line.trim()).filter((line: string) => line.length > 0).forEach((line: string) => {
            if (infoYPos < ADDRESS_FIELD_TOP + ADDRESS_FIELD_HEIGHT - 5) {
              pdf.text(line, INFO_BLOCK_LEFT, infoYPos);
              infoYPos += 4;
            }
          });
        }
        break;
    }
  }
  
  // Letter date
  if (letter.letter_date) {
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
  
  // Salutation
  const salutationText = layout.salutation?.template || '';
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
      const currentMaxWidth = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
      const lines = pdf.splitTextToSize(paragraph.trim(), currentMaxWidth);
      
      lines.forEach((line: string) => {
        const paginationTop = 263.77;
        const contentBottom = shouldShowPagination
          ? paginationTop - PAGINATION_GAP
          : Math.min(CONTENT_TOP + 165, FOOTER_TOP - PAGINATION_GAP);
        
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
        
        pdf.text(line, LEFT_MARGIN, currentY);
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
      
      pdf.setDrawColor(255, 0, 255);
      pdf.setLineWidth(0.1);
      const pageText = `Seite ${page} von ${totalLetterPages}`;
      const pageTextWidth = pdf.getTextWidth(pageText);
      const pageTextX = (PAGE_WIDTH - pageTextWidth) / 2;
      pdf.rect(pageTextX - 2, paginationY - 3, pageTextWidth + 4, 5);
      pdf.setTextColor(255, 0, 255);
      pdf.setFontSize(6);
      pdf.text("Pagination: Unterkante 4.23mm über Fußzeile", pageTextX, paginationY - 4);
      
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
