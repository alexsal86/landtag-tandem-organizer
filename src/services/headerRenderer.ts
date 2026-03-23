import jsPDF from 'jspdf';
import { debugConsole } from '@/utils/debugConsole';

interface HeaderElement {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  imageUrl?: string;
}

interface HeaderTemplate {
  header_layout_type?: string;
  header_text_elements?: HeaderElement[];
  header_image_url?: string;
  header_image_position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  letterhead_html?: string;
  letterhead_css?: string;
  name?: string;
}

export class HeaderRenderer {
  private pdf: jsPDF;
  private leftMargin: number;
  private layoutSettings: any;
  private debugMode: boolean;

  constructor(pdf: jsPDF, leftMargin: number = 25, layoutSettings?: any, debugMode: boolean = false) {
    this.pdf = pdf;
    this.leftMargin = leftMargin;
    this.debugMode = debugMode;
    this.layoutSettings = layoutSettings || {
      pageWidth: 210,
      pageHeight: 297,
      margins: { left: 25, right: 20, top: 45, bottom: 25 },
      header: { height: 45, marginBottom: 8.46 },
    };
  }

  async renderHeader(template: HeaderTemplate | null): Promise<void> {
    if (!template) {
      debugConsole.log('HeaderRenderer: No template provided');
      return;
    }

    debugConsole.log('=== HEADER RENDERER START ===');
    debugConsole.log('Template layout type:', template.header_layout_type);
    debugConsole.log('Template elements:', template.header_text_elements);
    debugConsole.log('Template HTML:', template.letterhead_html);

    const pxToMm = 0.264583;

    try {
      if (template.header_layout_type === 'structured') {
        debugConsole.log('Rendering structured header');
        await this.renderStructuredHeader(template, pxToMm);
      } else if (template.letterhead_html) {
        debugConsole.log('Rendering HTML header');
        this.renderHtmlHeader(template);
      } else {
        debugConsole.log('No valid header data found, using fallback');
        this.renderFallbackHeader(template);
      }
    } catch (error) {
      debugConsole.warn('Error rendering header:', error);
      this.renderFallbackHeader(template);
    }
    
    debugConsole.log('=== HEADER RENDERER END ===');
  }

  private async renderStructuredHeader(template: HeaderTemplate, pxToMm: number): Promise<void> {
    debugConsole.log('=== RENDERING STRUCTURED HEADER ===');
    
    let headerElements: any[] = [];
    if (template.header_text_elements) {
      if (typeof template.header_text_elements === 'string') {
        try {
          headerElements = JSON.parse(template.header_text_elements);
          debugConsole.log('Parsed elements from JSON string:', headerElements);
        } catch (e) {
          debugConsole.warn('Failed to parse header_text_elements:', e);
          headerElements = [];
        }
      } else if (Array.isArray(template.header_text_elements)) {
        headerElements = template.header_text_elements;
        debugConsole.log('Using array elements directly:', headerElements);
      }
    }
    
    debugConsole.log('Final elements to render:', headerElements);
    
    for (const element of headerElements) {
      debugConsole.log('Processing element:', element);
      if (element.type === 'text' && element.content) {
        debugConsole.log('Rendering text element:', element);
        this.renderTextElement(element, pxToMm);
      } else if (element.type === 'image' && element.imageUrl) {
        debugConsole.log('Rendering image element:', element);
        await this.renderImageElement(element.imageUrl, {
          x: element.x,
          y: element.y,
          width: element.width || 100,
          height: element.height || 50
        }, pxToMm);
      }
    }

    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setDrawColor(0, 0, 0);
    debugConsole.log('=== STRUCTURED HEADER RENDERED ===');
  }

  private renderTextElement(element: HeaderElement, pxToMm: number): void {
    const fontSize = element.fontSize || 12;
    const fontFamily = element.fontFamily || 'helvetica';
    const fontWeight = element.fontWeight || 'normal';
    
    debugConsole.log('=== TEXT ELEMENT FONT DEBUG ===');
    debugConsole.log('Original fontSize from designer:', fontSize);
    debugConsole.log('Font family:', fontFamily);
    debugConsole.log('Font weight:', fontWeight);
    debugConsole.log('Element content:', element.content);
    
    this.pdf.setFontSize(fontSize);
    
    let pdfFontFamily = 'helvetica';
    
    switch (fontFamily) {
      case 'Arial':
      case 'Helvetica':
        pdfFontFamily = 'helvetica';
        break;
      case 'Times':
        pdfFontFamily = 'times';
        break;
      case 'Courier':
        pdfFontFamily = 'courier';
        break;
      default:
        if (fontFamily.toLowerCase().includes('times') || fontFamily.toLowerCase().includes('serif')) {
          pdfFontFamily = 'times';
        } else if (fontFamily.toLowerCase().includes('courier') || fontFamily.toLowerCase().includes('mono')) {
          pdfFontFamily = 'courier';
        } else {
          pdfFontFamily = 'helvetica';
        }
    }
    
    const pdfFontWeight = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800' || fontWeight === '900' ? 'bold' : 'normal';
    this.pdf.setFont(pdfFontFamily, pdfFontWeight);
    
    const xInMm = element.x || 0;
    const yInMm = element.y || 0;
    const textYInMm = yInMm + (fontSize * 0.352778);
    
    debugConsole.log('Text element position and font:', { 
      elementX: element.x, 
      elementY: element.y, 
      pdfX: xInMm, 
      pdfY: yInMm,
      adjustedTextY: textYInMm,
      pdfFontFamily,
      pdfFontWeight,
      fontSize,
      content: element.content 
    });
    
    this.renderDebugBox(xInMm, yInMm, fontSize, element.content || '');
    
    if (element.color && element.color.startsWith('#')) {
      const { r, g, b } = this.hexToRgb(element.color);
      this.pdf.setTextColor(r, g, b);
    } else {
      this.pdf.setTextColor(0, 0, 0);
    }
    
    debugConsole.log('Setting font size again RIGHT before text rendering:', fontSize);
    this.pdf.setFontSize(fontSize);
    this.pdf.setFont(pdfFontFamily, pdfFontWeight);
    
    this.pdf.text(element.content || '', xInMm, textYInMm);
  }

  private async renderImageElement(
    imageUrl: string, 
    position: { x: number; y: number; width: number; height: number }, 
    pxToMm: number
  ): Promise<void> {
    try {
      debugConsole.log('Rendering image element:', { imageUrl, position });
      
      const xInMm = position.x;
      const yInMm = position.y;
      const widthInMm = position.width;
      const heightInMm = position.height;
      
      debugConsole.log('Image position in mm:', { xInMm, yInMm, widthInMm, heightInMm });
      
      this.renderDebugBox(xInMm, yInMm, widthInMm, heightInMm, true);

      if (imageUrl.toLowerCase().includes('.svg')) {
        debugConsole.log('SVG detected, using placeholder');
        this.pdf.setDrawColor(100, 100, 100);
        this.pdf.setFillColor(245, 245, 245);
        this.pdf.rect(xInMm, yInMm, widthInMm, heightInMm, 'FD');
        
        this.pdf.setFontSize(8);
        this.pdf.setTextColor(100, 100, 100);
        const fileName = imageUrl.split('/').pop() || 'SVG';
        this.pdf.text(`[${fileName.substring(0, 20)}]`, xInMm + 2, yInMm + heightInMm / 2);
        return;
      }

      debugConsole.log('Fetching image:', imageUrl);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const base64 = await this.blobToBase64(blob);
      
      let format = 'JPEG';
      const mimeType = blob.type.toLowerCase();
      if (mimeType.includes('png')) {
        format = 'PNG';
      } else if (mimeType.includes('gif')) {
        format = 'GIF';
      }
      
      debugConsole.log('Adding image to PDF:', { format, mimeType, size: blob.size });

      this.pdf.addImage(base64, format, xInMm, yInMm, widthInMm, heightInMm);
      debugConsole.log('Image successfully added to PDF');

    } catch (error) {
      debugConsole.error('Error rendering image, using fallback:', error);
      
      const xInMm = position.x;
      const yInMm = position.y;
      const widthInMm = position.width;
      const heightInMm = position.height;
      
      this.pdf.setDrawColor(200, 200, 200);
      this.pdf.setFillColor(250, 250, 250);
      this.pdf.rect(xInMm, yInMm, widthInMm, heightInMm, 'FD');
      
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(128, 128, 128);
      const fileName = imageUrl.split('/').pop() || 'Bild';
      this.pdf.text(`[FEHLER: ${fileName.substring(0, 10)}...]`, xInMm + 1, yInMm + heightInMm / 2);
    }
  }

  private renderHtmlHeader(template: HeaderTemplate): void {
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(template.name || 'Briefkopf', this.leftMargin, 20);
  }

  private renderFallbackHeader(template: HeaderTemplate): void {
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(template.name || 'Briefvorlage', this.leftMargin, 20);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private renderDebugBox(x: number, y: number, width: number | string, height?: number | string, isImage: boolean = false): void {
    let boxWidth: number;
    let boxHeight: number;
    
    if (isImage) {
      boxWidth = width as number;
      boxHeight = height as number;
    } else {
      const fontSize = width as number;
      const content = height as string;
      const fontSizeMm = fontSize * 0.352778;
      boxWidth = Math.max(content.length * fontSizeMm * 0.6, 10);
      boxHeight = fontSizeMm * 1.2;
    }
    
    this.pdf.setDrawColor(255, 0, 0);
    this.pdf.rect(x, y, boxWidth, boxHeight, 'D');
    
    this.pdf.setFontSize(6);
    this.pdf.setTextColor(255, 0, 0);
    const debugText = `x:${x.toFixed(1)}mm y:${y.toFixed(1)}mm ${boxWidth.toFixed(1)}×${boxHeight.toFixed(1)}mm`;
    
    const debugY = y > 15 ? y - 2 : y + boxHeight + 8;
    this.pdf.text(debugText, x, debugY);
  }
}
