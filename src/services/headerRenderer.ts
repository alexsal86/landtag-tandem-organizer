import jsPDF from 'jspdf';

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

  constructor(pdf: jsPDF, leftMargin: number = 25) {
    this.pdf = pdf;
    this.leftMargin = leftMargin;
  }

  async renderHeader(template: HeaderTemplate | null): Promise<void> {
    if (!template) {
      console.log('HeaderRenderer: No template provided');
      return;
    }

    console.log('=== HEADER RENDERER START ===');
    console.log('Template layout type:', template.header_layout_type);
    console.log('Template elements:', template.header_text_elements);
    console.log('Template HTML:', template.letterhead_html);

    // Convert pixels to mm for jsPDF (1px = 0.264583mm at 96 DPI)
    const pxToMm = 0.264583;

    try {
      if (template.header_layout_type === 'structured') {
        console.log('Rendering structured header');
        await this.renderStructuredHeader(template, pxToMm);
      } else if (template.letterhead_html) {
        console.log('Rendering HTML header');
        this.renderHtmlHeader(template);
      } else {
        console.log('No valid header data found, using fallback');
        this.renderFallbackHeader(template);
      }
    } catch (error) {
      console.warn('Error rendering header:', error);
      // Fallback to simple text header
      this.renderFallbackHeader(template);
    }
    
    console.log('=== HEADER RENDERER END ===');
  }

  private async renderStructuredHeader(template: HeaderTemplate, pxToMm: number): Promise<void> {
    console.log('=== RENDERING STRUCTURED HEADER ===');
    
    // Parse header_text_elements if it's a string (JSON)
    let headerElements: any[] = [];
    if (template.header_text_elements) {
      if (typeof template.header_text_elements === 'string') {
        try {
          headerElements = JSON.parse(template.header_text_elements);
          console.log('Parsed elements from JSON string:', headerElements);
        } catch (e) {
          console.warn('Failed to parse header_text_elements:', e);
          headerElements = [];
        }
      } else if (Array.isArray(template.header_text_elements)) {
        headerElements = template.header_text_elements;
        console.log('Using array elements directly:', headerElements);
      }
    }
    
    console.log('Final elements to render:', headerElements);
    
    for (const element of headerElements) {
      console.log('Processing element:', element);
      if (element.type === 'text' && element.content) {
        console.log('Rendering text element:', element);
        this.renderTextElement(element, pxToMm);
      } else if (element.type === 'image' && element.imageUrl) {
        console.log('Rendering image element:', element);
        await this.renderImageElement(element.imageUrl, {
          x: element.x,
          y: element.y,
          width: element.width || 100,
          height: element.height || 50
        }, pxToMm);
      }
    }

    // Reset PDF state
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setDrawColor(0, 0, 0);
    console.log('=== STRUCTURED HEADER RENDERED ===');
  }

  private renderTextElement(element: HeaderElement, pxToMm: number): void {
    // Set font properties
    const fontSize = element.fontSize || 12;
    const fontFamily = element.fontFamily || 'helvetica';
    const fontWeight = element.fontWeight || 'normal';
    
    console.log('=== TEXT ELEMENT FONT DEBUG ===');
    console.log('Original fontSize from designer:', fontSize);
    console.log('Font family:', fontFamily);
    console.log('Font weight:', fontWeight);
    console.log('Element content:', element.content);
    
    // The StructuredHeaderEditor likely already uses point values
    // Try without conversion first - if it's still wrong, we'll adjust
    const fontSizeInPoints = fontSize; // Use original value
    console.log('Using fontSize directly (no conversion):', fontSizeInPoints);
    
    this.pdf.setFontSize(fontSizeInPoints);
    
    // Handle different font families - jsPDF has limited font support
    // Map from StructuredHeaderEditor font names to jsPDF font names
    let pdfFontFamily = 'helvetica'; // Default fallback
    
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
        // Fallback for unknown fonts
        if (fontFamily.toLowerCase().includes('times') || fontFamily.toLowerCase().includes('serif')) {
          pdfFontFamily = 'times';
        } else if (fontFamily.toLowerCase().includes('courier') || fontFamily.toLowerCase().includes('mono')) {
          pdfFontFamily = 'courier';
        } else {
          pdfFontFamily = 'helvetica';
        }
    }
    
    // Set font with proper weight
    const pdfFontWeight = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800' || fontWeight === '900' ? 'bold' : 'normal';
    this.pdf.setFont(pdfFontFamily, pdfFontWeight);
    
    // Use direct mm coordinates from structured editor
    const xInMm = element.x || 0;
    const yInMm = element.y || 0;
    
    // Adjust text position - jsPDF positions text by baseline, we need to add font height
    const textYInMm = yInMm + (fontSizeInPoints * 0.352778); // Convert font size from points to mm and adjust for baseline
    
    console.log('Text element position and font:', { 
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
    
    // Render debug box around text element (shows the actual bounding box)
    this.renderDebugBox(xInMm, yInMm, fontSizeInPoints, element.content || '');
    
    // Set text color AFTER debug rendering to avoid red text
    if (element.color && element.color.startsWith('#')) {
      const { r, g, b } = this.hexToRgb(element.color);
      this.pdf.setTextColor(r, g, b);
    } else {
      this.pdf.setTextColor(0, 0, 0); // Default to black
    }
    
    // Render text at adjusted position
    this.pdf.text(element.content || '', xInMm, textYInMm);
  }

  private async renderImageElement(
    imageUrl: string, 
    position: { x: number; y: number; width: number; height: number }, 
    pxToMm: number
  ): Promise<void> {
    try {
      console.log('Rendering image element:', { imageUrl, position });
      
      // Use direct mm coordinates from structured editor
      const xInMm = position.x;
      const yInMm = position.y; // No offset - use exact coordinates
      const widthInMm = position.width;
      const heightInMm = position.height;
      
      console.log('Image position in mm:', { xInMm, yInMm, widthInMm, heightInMm });
      
      // Render debug box around image element
      this.renderDebugBox(xInMm, yInMm, widthInMm, heightInMm, true);

      // Check if it's an SVG first (which jsPDF doesn't support directly)
      if (imageUrl.toLowerCase().includes('.svg')) {
        console.log('SVG detected, using placeholder');
        this.pdf.setDrawColor(100, 100, 100);
        this.pdf.setFillColor(245, 245, 245);
        this.pdf.rect(xInMm, yInMm, widthInMm, heightInMm, 'FD');
        
        this.pdf.setFontSize(8);
        this.pdf.setTextColor(100, 100, 100);
        const fileName = imageUrl.split('/').pop() || 'SVG';
        this.pdf.text(`[${fileName.substring(0, 20)}]`, xInMm + 2, yInMm + heightInMm / 2);
        return;
      }

      // For JPG, PNG and other supported formats
      console.log('Fetching image:', imageUrl);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const base64 = await this.blobToBase64(blob);
      
      // Determine image format
      let format = 'JPEG';
      const mimeType = blob.type.toLowerCase();
      if (mimeType.includes('png')) {
        format = 'PNG';
      } else if (mimeType.includes('gif')) {
        format = 'GIF';
      }
      
      console.log('Adding image to PDF:', { format, mimeType, size: blob.size });

      // Add the actual image to PDF
      this.pdf.addImage(base64, format, xInMm, yInMm, widthInMm, heightInMm);
      console.log('Image successfully added to PDF');

    } catch (error) {
      console.error('Error rendering image, using fallback:', error);
      
      // Fallback: render a simple placeholder
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
    // Simple fallback for HTML headers
    // In a full implementation, you might parse simple HTML/CSS
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
      // For text elements, calculate dimensions properly in mm
      const fontSize = width as number; // Font size in points
      const content = height as string; // Text content
      
      // Convert font size from points to mm (1 point = 0.352778 mm)
      const fontSizeMm = fontSize * 0.352778;
      
      // Estimate text width based on character count (rough approximation)
      // Average character width is about 0.6 of font height for most fonts
      boxWidth = Math.max(content.length * fontSizeMm * 0.6, 10);
      boxHeight = fontSizeMm * 1.2; // Font size with some padding
    }
    
    // Draw debug rectangle with red border
    this.pdf.setDrawColor(255, 0, 0); // Red border
    this.pdf.rect(x, y, boxWidth, boxHeight, 'D'); // Draw outline only
    
    // Add debug information text
    this.pdf.setFontSize(6);
    this.pdf.setTextColor(255, 0, 0); // Red text
    const debugText = `x:${x.toFixed(1)}mm y:${y.toFixed(1)}mm ${boxWidth.toFixed(1)}×${boxHeight.toFixed(1)}mm`;
    
    // Position debug text above or below the element
    const debugY = y > 15 ? y - 2 : y + boxHeight + 8;
    this.pdf.text(debugText, x, debugY);
  }
}