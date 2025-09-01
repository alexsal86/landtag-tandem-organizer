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
    if (!template) return;

    // Convert pixels to mm for jsPDF (1px = 0.264583mm at 96 DPI)
    const pxToMm = 0.264583;

    try {
      if (template.header_layout_type === 'structured') {
        await this.renderStructuredHeader(template, pxToMm);
      } else if (template.letterhead_html) {
        this.renderHtmlHeader(template);
      }
    } catch (error) {
      console.warn('Error rendering header:', error);
      // Fallback to simple text header
      this.renderFallbackHeader(template);
    }
  }

  private async renderStructuredHeader(template: HeaderTemplate, pxToMm: number): Promise<void> {
    // Render text elements
    const textElements = Array.isArray(template.header_text_elements) ? template.header_text_elements : [];
    
    textElements.forEach(element => {
      if (element.type === 'text' && element.content) {
        this.renderTextElement(element, pxToMm);
      }
    });

    // Render header image if available
    if (template.header_image_url && template.header_image_position) {
      await this.renderImageElement(template.header_image_url, template.header_image_position, pxToMm);
    }

    // Reset PDF state
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setDrawColor(0, 0, 0);
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
    
    // Calculate position in mm
    const x = this.leftMargin + (element.x || 0) * pxToMm;
    const y = 20 + (element.y || 0) * pxToMm;
    
    // Render text
    this.pdf.text(element.content || '', x, y);
  }

  private async renderImageElement(
    imageUrl: string, 
    position: { x: number; y: number; width: number; height: number }, 
    pxToMm: number
  ): Promise<void> {
    try {
      // For now, render a placeholder rectangle
      // In a full implementation, you would:
      // 1. Fetch the image from the URL
      // 2. Convert it to base64 if needed
      // 3. Use pdf.addImage() to embed it

      const x = this.leftMargin + position.x * pxToMm;
      const y = 20 + position.y * pxToMm;
      const width = position.width * pxToMm;
      const height = position.height * pxToMm;

      // Placeholder rectangle
      this.pdf.setDrawColor(200, 200, 200);
      this.pdf.setFillColor(245, 245, 245);
      this.pdf.rect(x, y, width, height, 'FD');
      
      // Placeholder text
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(128, 128, 128);
      const fileName = imageUrl.split('/').pop() || 'Bild';
      this.pdf.text(`[${fileName}]`, x + 2, y + height / 2);

      // TODO: Implement actual image loading and rendering
      // const response = await fetch(imageUrl);
      // const blob = await response.blob();
      // const base64 = await this.blobToBase64(blob);
      // this.pdf.addImage(base64, 'JPEG', x, y, width, height);

    } catch (error) {
      console.warn('Error rendering image:', error);
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