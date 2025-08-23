import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

/**
 * QR Code Service
 * Handles QR code generation for forms
 */
export class QRCodeService {

  /**
   * Generate QR code for form URL
   * @param formUrl - URL to encode in QR code
   * @param options - QR code generation options
   * @returns Base64 encoded QR code image
   */
  static async generateQRCode(
    formUrl: string,
    options: {
      size?: number;
      format?: 'png' | 'svg';
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
      margin?: number;
      color?: {
        dark?: string;
        light?: string;
      };
    } = {}
  ): Promise<string> {
    try {
      const {
        size = 256,
        format = 'png',
        errorCorrectionLevel = 'M',
        margin = 2,
        color = { dark: '#000000', light: '#FFFFFF' }
      } = options;

      const qrOptions = {
        errorCorrectionLevel,
        type: 'image/png' as const,
        quality: 0.92,
        margin,
        color,
        width: size
      };

      if (format === 'svg') {
        return await QRCode.toString(formUrl, { ...qrOptions, type: 'svg' });
      } else {
        return await QRCode.toDataURL(formUrl, qrOptions);
      }
    } catch (error) {
      console.error('QR code generation error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR code and save to file
   * @param formUrl - URL to encode
   * @param filename - Output filename
   * @param options - QR code options
   * @returns File path of saved QR code
   */
  static async generateQRCodeFile(
    formUrl: string,
    filename: string,
    options: {
      size?: number;
      format?: 'png' | 'svg';
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
      margin?: number;
      color?: {
        dark?: string;
        light?: string;
      };
    } = {}
  ): Promise<string> {
    try {
      const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
      const qrDir = path.join(uploadsDir, 'qr-codes');

      // Ensure QR codes directory exists
      if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
      }

      const {
        size = 256,
        format = 'png',
        errorCorrectionLevel = 'M',
        margin = 2,
        color = { dark: '#000000', light: '#FFFFFF' }
      } = options;

      const fileExtension = format === 'svg' ? 'svg' : 'png';
      const fullFilename = `${filename}.${fileExtension}`;
      const filePath = path.join(qrDir, fullFilename);

      const qrOptions = {
        errorCorrectionLevel,
        margin,
        color,
        width: size
      };

      if (format === 'svg') {
        const svgString = await QRCode.toString(formUrl, { ...qrOptions, type: 'svg' });
        fs.writeFileSync(filePath, svgString);
      } else {
        await QRCode.toFile(filePath, formUrl, { ...qrOptions, type: 'png' });
      }

      return `/uploads/qr-codes/${fullFilename}`;
    } catch (error) {
      console.error('QR code file generation error:', error);
      throw new Error('Failed to generate QR code file');
    }
  }

  /**
   * Generate QR code with custom styling
   * @param formUrl - URL to encode
   * @param style - Custom styling options
   * @returns Styled QR code data
   */
  static async generateStyledQRCode(
    formUrl: string,
    style: {
      primaryColor?: string;
      backgroundColor?: string;
      logo?: string;
      size?: number;
      style?: 'square' | 'rounded' | 'dots';
    } = {}
  ): Promise<string> {
    try {
      const {
        primaryColor = '#000000',
        backgroundColor = '#FFFFFF',
        size = 256,
        style: qrStyle = 'square'
      } = style;

      // For basic styling, use color options
      const qrOptions = {
        errorCorrectionLevel: 'M' as const,
        type: 'image/png' as const,
        quality: 0.92,
        margin: 2,
        color: {
          dark: primaryColor,
          light: backgroundColor
        },
        width: size
      };

      const qrCodeDataUrl = await QRCode.toDataURL(formUrl, qrOptions);

      // For advanced styling (rounded corners, dots, etc.), 
      // you would need additional image processing libraries
      // This is a simplified implementation
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Styled QR code generation error:', error);
      throw new Error('Failed to generate styled QR code');
    }
  }

  /**
   * Generate multiple QR codes for different purposes
   * @param formId - Form ID
   * @param baseUrl - Base URL for the application
   * @returns Object with different QR codes
   */
  static async generateFormQRCodes(
    formId: string,
    baseUrl: string
  ): Promise<{
    public: string;
    preview: string;
    embed: string;
    analytics: string;
  }> {
    try {
      const urls = {
        public: `${baseUrl}/form/${formId}`,
        preview: `${baseUrl}/form/${formId}/preview`,
        embed: `${baseUrl}/embed/${formId}`,
        analytics: `${baseUrl}/form/${formId}/analytics`
      };

      const [publicQR, previewQR, embedQR, analyticsQR] = await Promise.all([
        this.generateQRCode(urls.public, { size: 200 }),
        this.generateQRCode(urls.preview, { size: 200 }),
        this.generateQRCode(urls.embed, { size: 200 }),
        this.generateQRCode(urls.analytics, { size: 200 })
      ]);

      return {
        public: publicQR,
        preview: previewQR,
        embed: embedQR,
        analytics: analyticsQR
      };
    } catch (error) {
      console.error('Form QR codes generation error:', error);
      throw new Error('Failed to generate form QR codes');
    }
  }

  /**
   * Generate QR code with tracking parameters
   * @param formUrl - Base form URL
   * @param trackingParams - Tracking parameters to add
   * @param options - QR code options
   * @returns QR code with tracking
   */
  static async generateTrackingQRCode(
    formUrl: string,
    trackingParams: {
      source?: string;
      medium?: string;
      campaign?: string;
      content?: string;
      term?: string;
    } = {},
    options: {
      size?: number;
      color?: { dark?: string; light?: string };
    } = {}
  ): Promise<string> {
    try {
      const url = new URL(formUrl);
      
      // Add tracking parameters
      if (trackingParams.source) url.searchParams.set('utm_source', trackingParams.source);
      if (trackingParams.medium) url.searchParams.set('utm_medium', trackingParams.medium);
      if (trackingParams.campaign) url.searchParams.set('utm_campaign', trackingParams.campaign);
      if (trackingParams.content) url.searchParams.set('utm_content', trackingParams.content);
      if (trackingParams.term) url.searchParams.set('utm_term', trackingParams.term);

      // Add QR code tracking
      url.searchParams.set('ref', 'qr');
      url.searchParams.set('t', Date.now().toString());

      return await this.generateQRCode(url.toString(), options);
    } catch (error) {
      console.error('Tracking QR code generation error:', error);
      throw new Error('Failed to generate tracking QR code');
    }
  }

  /**
   * Generate QR code with custom data (vCard, WiFi, etc.)
   * @param type - Type of data to encode
   * @param data - Data object
   * @param options - QR code options
   * @returns QR code for custom data
   */
  static async generateCustomDataQRCode(
    type: 'vcard' | 'wifi' | 'email' | 'sms' | 'geo',
    data: any,
    options: { size?: number; color?: { dark?: string; light?: string } } = {}
  ): Promise<string> {
    try {
      let qrData: string;

      switch (type) {
        case 'vcard':
          qrData = this.generateVCardData(data);
          break;
        case 'wifi':
          qrData = this.generateWiFiData(data);
          break;
        case 'email':
          qrData = `mailto:${data.email}?subject=${encodeURIComponent(data.subject || '')}&body=${encodeURIComponent(data.body || '')}`;
          break;
        case 'sms':
          qrData = `sms:${data.number}?body=${encodeURIComponent(data.message || '')}`;
          break;
        case 'geo':
          qrData = `geo:${data.lat},${data.lng}?q=${data.lat},${data.lng}(${encodeURIComponent(data.label || '')})`;
          break;
        default:
          throw new Error(`Unsupported QR code type: ${type}`);
      }

      return await this.generateQRCode(qrData, options);
    } catch (error) {
      console.error('Custom data QR code generation error:', error);
      throw new Error('Failed to generate custom data QR code');
    }
  }

  /**
   * Get QR code analytics and usage stats
   * @param formId - Form ID
   * @returns QR code usage statistics
   */
  static async getQRCodeStats(formId: string): Promise<{
    totalScans: number;
    uniqueScans: number;
    scansByDate: Array<{ date: string; scans: number }>;
    deviceTypes: Record<string, number>;
    locations: Array<{ country: string; scans: number }>;
  }> {
    // This would typically integrate with analytics service
    // For now, return mock data structure
    return {
      totalScans: 0,
      uniqueScans: 0,
      scansByDate: [],
      deviceTypes: {},
      locations: []
    };
  }

  // Helper methods

  private static generateVCardData(data: {
    firstName?: string;
    lastName?: string;
    organization?: string;
    phone?: string;
    email?: string;
    url?: string;
  }): string {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      data.firstName || data.lastName ? `FN:${(data.firstName || '')} ${(data.lastName || '')}`.trim() : '',
      data.organization ? `ORG:${data.organization}` : '',
      data.phone ? `TEL:${data.phone}` : '',
      data.email ? `EMAIL:${data.email}` : '',
      data.url ? `URL:${data.url}` : '',
      'END:VCARD'
    ].filter(Boolean);

    return vcard.join('\n');
  }

  private static generateWiFiData(data: {
    ssid: string;
    password?: string;
    security?: 'WPA' | 'WEP' | 'nopass';
    hidden?: boolean;
  }): string {
    const { ssid, password = '', security = 'WPA', hidden = false } = data;
    return `WIFI:T:${security};S:${ssid};P:${password};H:${hidden ? 'true' : 'false'};;`;
  }

  /**
   * Validate QR code generation parameters
   * @param params - Parameters to validate
   * @returns Validation result
   */
  static validateQRParams(params: {
    url?: string;
    size?: number;
    format?: string;
    color?: any;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (params.url) {
      try {
        new URL(params.url);
      } catch {
        errors.push('Invalid URL format');
      }
    }

    if (params.size && (params.size < 50 || params.size > 1000)) {
      errors.push('Size must be between 50 and 1000 pixels');
    }

    if (params.format && !['png', 'svg'].includes(params.format)) {
      errors.push('Format must be either png or svg');
    }

    if (params.color?.dark && !/^#[0-9A-F]{6}$/i.test(params.color.dark)) {
      errors.push('Dark color must be a valid hex color');
    }

    if (params.color?.light && !/^#[0-9A-F]{6}$/i.test(params.color.light)) {
      errors.push('Light color must be a valid hex color');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default QRCodeService;