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
    this.pdf.setFontSize(element.fontSize || 12);
    this.pdf.setFont('helvetica', element.fontWeight === 'bold' ? 'bold' : 'normal');
    
    // Set text color
    if (element.color && element.color.startsWith('#')) {
      const { r, g, b } = this.hexToRgb(element.color);
      this.pdf.setTextColor(r, g, b);
    }
    
    // Calculate position in mm for A4 (210mm width, 45mm header height max)
    const maxHeaderWidth = 210; // A4 width in mm
    const maxHeaderHeight = 45; // Header height limit in mm
    
    // Convert canvas coordinates (595px x 200px) to PDF coordinates (210mm x 45mm)
    const xInMm = (element.x || 0) / 595 * maxHeaderWidth;
    const yInMm = 10 + ((element.y || 0) / 200) * maxHeaderHeight; // 10mm top margin
    
    console.log('Text element position:', { 
      canvasX: element.x, 
      canvasY: element.y, 
      pdfX: xInMm, 
      pdfY: yInMm,
      content: element.content 
    });
    
    // Render text
    this.pdf.text(element.content || '', xInMm, yInMm);
  }

  private async renderImageElement(
    imageUrl: string, 
    position: { x: number; y: number; width: number; height: number }, 
    pxToMm: number
  ): Promise<void> {
    try {
      console.log('Rendering image element:', { imageUrl, position });
      
      // Calculate position and size in mm for A4 (210mm width, 45mm header height max)
      const maxHeaderWidth = 210; // A4 width in mm
      const maxHeaderHeight = 45; // Header height limit in mm
      
      // Convert canvas coordinates (595px x 200px) to PDF coordinates (210mm x 45mm)
      const xInMm = (position.x / 595) * maxHeaderWidth;
      const yInMm = 10 + (position.y / 200) * maxHeaderHeight; // 10mm top margin
      const widthInMm = Math.min((position.width / 595) * maxHeaderWidth, maxHeaderWidth - xInMm);
      const heightInMm = Math.min((position.height / 200) * maxHeaderHeight, maxHeaderHeight - (yInMm - 10));
      
      console.log('Image position in mm:', { xInMm, yInMm, widthInMm, heightInMm });

      // Fetch and convert image to base64
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
      } else if (mimeType.includes('svg')) {
        // For SVG, we need to handle it differently
        format = 'SVG';
      }
      
      console.log('Image format detected:', format, 'MIME type:', mimeType);

      if (format === 'SVG') {
        // For SVG, convert to PNG first or render as rectangle with text
        this.pdf.setDrawColor(100, 100, 100);
        this.pdf.setFillColor(245, 245, 245);
        this.pdf.rect(xInMm, yInMm, widthInMm, heightInMm, 'FD');
        
        this.pdf.setFontSize(8);
        this.pdf.setTextColor(100, 100, 100);
        const fileName = imageUrl.split('/').pop() || 'SVG';
        this.pdf.text(`[${fileName.substring(0, 20)}]`, xInMm + 2, yInMm + heightInMm / 2);
        
        console.log('SVG rendered as placeholder');
      } else {
        // Render actual image
        this.pdf.addImage(base64, format, xInMm, yInMm, widthInMm, heightInMm);
        console.log('Image rendered successfully');
      }

    } catch (error) {
      console.warn('Error rendering image, using fallback:', error);
      
      // Fallback: render a simple placeholder
      const xInMm = (position.x / 595) * 210;
      const yInMm = 10 + (position.y / 200) * 45;
      const widthInMm = Math.min((position.width / 595) * 210, 210 - xInMm);
      const heightInMm = Math.min((position.height / 200) * 45, 45 - (yInMm - 10));
      
      this.pdf.setDrawColor(200, 200, 200);
      this.pdf.setFillColor(250, 250, 250);
      this.pdf.rect(xInMm, yInMm, widthInMm, heightInMm, 'FD');
      
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(128, 128, 128);
      const fileName = imageUrl.split('/').pop() || 'Bild';
      this.pdf.text(`[${fileName.substring(0, 15)}...]`, xInMm + 1, yInMm + heightInMm / 2);
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
}