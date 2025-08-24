import { Types } from 'mongoose';
import { IForm, IFormResponse } from '../types';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

/**
 * Export Service
 * Handles exporting form responses to various formats (Excel, PDF, CSV)
 */
export class ExportService {

  /**
   * Export form responses to Excel format
   * @param formId - Form identifier
   * @param options - Export options
   * @returns Excel file buffer and metadata
   */
  static async exportToExcel(
    formId: string,
    options: IExportOptions = {}
  ): Promise<IExportResult> {
    try {
      const form = await Form.findById(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      // Build query with filters
      const query = this.buildResponseQuery(formId, options);
      
      // Get responses with pagination if needed
      const responses = await FormResponse.find(query)
        .sort({ submittedAt: -1 })
        .limit(options.limit || 10000); // Reasonable limit

      if (responses.length === 0) {
        return {
          success: false,
          error: 'No responses found for export'
        };
      }

      // Prepare data for Excel
      const excelData = this.prepareExcelData(form, responses, options);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Add main responses sheet
      const responsesSheet = XLSX.utils.json_to_sheet(excelData.responses);
      XLSX.utils.book_append_sheet(workbook, responsesSheet, 'Responses');
      
      // Add summary sheet if requested
      if (options.includeSummary) {
        const summaryData = this.generateSummaryData(form, responses);
        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      }
      
      // Add field analysis sheet if requested
      if (options.includeAnalysis) {
        const analysisData = this.generateFieldAnalysis(form, responses);
        const analysisSheet = XLSX.utils.json_to_sheet(analysisData);
        XLSX.utils.book_append_sheet(workbook, analysisSheet, 'Field Analysis');
      }
      
      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
        compression: true
      });

      return {
        success: true,
        data: {
          buffer: excelBuffer,
          filename: this.generateFileName(form.title, 'xlsx', options),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: excelBuffer.length,
          recordCount: responses.length,
          exportedAt: new Date(),
          metadata: {
            formTitle: form.title,
            totalResponses: responses.length,
            exportFormat: 'excel',
            exportOptions: options
          }
        }
      };
    } catch (error) {
      console.error('Excel export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Excel export failed'
      };
    }
  }

  /**
   * Export form responses to PDF format
   * @param formId - Form identifier
   * @param options - Export options
   * @returns PDF file buffer and metadata
   */
  static async exportToPDF(
    formId: string,
    options: IExportOptions = {}
  ): Promise<IExportResult> {
    try {
      const form = await Form.findById(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      // Build query with filters
      const query = this.buildResponseQuery(formId, options);
      
      // Get responses
      const responses = await FormResponse.find(query)
        .sort({ submittedAt: -1 })
        .limit(options.limit || 1000); // Lower limit for PDF due to size

      if (responses.length === 0) {
        return {
          success: false,
          error: 'No responses found for export'
        };
      }

      // Generate PDF
      const pdfBuffer = await this.generatePDF(form, responses, options);

      return {
        success: true,
        data: {
          buffer: pdfBuffer,
          filename: this.generateFileName(form.title, 'pdf', options),
          mimeType: 'application/pdf',
          size: pdfBuffer.length,
          recordCount: responses.length,
          exportedAt: new Date(),
          metadata: {
            formTitle: form.title,
            totalResponses: responses.length,
            exportFormat: 'pdf',
            exportOptions: options
          }
        }
      };
    } catch (error) {
      console.error('PDF export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF export failed'
      };
    }
  }

  /**
   * Export form responses to CSV format
   * @param formId - Form identifier
   * @param options - Export options
   * @returns CSV file buffer and metadata
   */
  static async exportToCSV(
    formId: string,
    options: IExportOptions = {}
  ): Promise<IExportResult> {
    try {
      const form = await Form.findById(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      // Build query with filters
      const query = this.buildResponseQuery(formId, options);
      
      // Get responses
      const responses = await FormResponse.find(query)
        .sort({ submittedAt: -1 })
        .limit(options.limit || 50000); // Higher limit for CSV

      if (responses.length === 0) {
        return {
          success: false,
          error: 'No responses found for export'
        };
      }

      // Prepare data for CSV
      const csvData = this.prepareCSVData(form, responses, options);
      
      // Generate CSV content
      const csvContent = this.generateCSV(csvData);
      const csvBuffer = Buffer.from(csvContent, 'utf8');

      return {
        success: true,
        data: {
          buffer: csvBuffer,
          filename: this.generateFileName(form.title, 'csv', options),
          mimeType: 'text/csv',
          size: csvBuffer.length,
          recordCount: responses.length,
          exportedAt: new Date(),
          metadata: {
            formTitle: form.title,
            totalResponses: responses.length,
            exportFormat: 'csv',
            exportOptions: options
          }
        }
      };
    } catch (error) {
      console.error('CSV export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CSV export failed'
      };
    }
  }

  /**
   * Get export statistics for a form
   * @param formId - Form identifier
   * @returns Export statistics and capabilities
   */
  static async getExportStats(formId: string): Promise<IExportStats> {
    try {
      const form = await Form.findById(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      const totalResponses = await FormResponse.countDocuments({ formId: new Types.ObjectId(formId) });
      
      // Calculate estimated file sizes
      const estimatedSizes = this.calculateEstimatedSizes(form, totalResponses);
      
      // Get recent export history (this would come from an export log collection)
      const recentExports = await this.getRecentExports(formId);

      return {
        formId,
        formTitle: form.title,
        totalResponses,
        estimatedSizes,
        supportedFormats: ['excel', 'pdf', 'csv'],
        recentExports,
        maxRecordsPerExport: {
          excel: 10000,
          pdf: 1000,
          csv: 50000
        },
        features: {
          includeMetadata: true,
          includeSummary: true,
          includeAnalysis: true,
          dateFiltering: true,
          fieldSelection: true,
          customFormatting: true
        }
      };
    } catch (error) {
      console.error('Export stats error:', error);
      throw error;
    }
  }

  // Helper methods
  private static buildResponseQuery(formId: string, options: IExportOptions): any {
    const query: any = { formId: new Types.ObjectId(formId) };

    // Add date filters
    if (options.dateFrom || options.dateTo) {
      query.submittedAt = {};
      if (options.dateFrom) {
        query.submittedAt.$gte = new Date(options.dateFrom);
      }
      if (options.dateTo) {
        query.submittedAt.$lte = new Date(options.dateTo);
      }
    }

    // Add field filters
    if (options.filters && options.filters.length > 0) {
      options.filters.forEach(filter => {
        if (filter.field && filter.value !== undefined) {
          const responseKey = `responses.${filter.field}`;
          switch (filter.operator) {
            case 'equals':
              query[responseKey] = filter.value;
              break;
            case 'contains':
              query[responseKey] = { $regex: filter.value, $options: 'i' };
              break;
            case 'not_empty':
              query[responseKey] = { $exists: true, $ne: null, $nin: ['', null] };
              break;
            // Add more operators as needed
          }
        }
      });
    }

    return query;
  }

  private static prepareExcelData(form: IForm, responses: IFormResponse[], options: IExportOptions): any {
    const headers = this.getExportHeaders(form, options);
    const data: any[] = [];

    responses.forEach(response => {
      const row: any = {};
      
      // Add metadata columns
      if (!options.selectedFields || options.selectedFields.includes('metadata')) {
        row['Submission ID'] = response._id?.toString();
        row['Submitted At'] = response.submittedAt?.toISOString();
        if (options.includeMetadata) {
          row['IP Address'] = response.ipAddress;
          row['User Agent'] = response.userAgent;
          row['Referrer'] = response.metadata?.referrer;
        }
      }

      // Add response data
      form.fields.forEach(field => {
        if (!options.selectedFields || options.selectedFields.includes(field.id)) {
          const value = response.responses[field.id];
          row[field.label] = this.formatCellValue(value, field.type);
        }
      });

      data.push(row);
    });

    return { responses: data };
  }

  private static prepareCSVData(form: IForm, responses: IFormResponse[], options: IExportOptions): any[] {
    const headers = this.getExportHeaders(form, options);
    const data: any[] = [headers];

    responses.forEach(response => {
      const row: any[] = [];
      
      // Add metadata columns
      if (!options.selectedFields || options.selectedFields.includes('metadata')) {
        row.push(response._id?.toString());
        row.push(response.submittedAt?.toISOString());
        if (options.includeMetadata) {
          row.push(response.ipAddress || '');
          row.push(response.userAgent || '');
          row.push(response.metadata?.referrer || '');
        }
      }

      // Add response data
      form.fields.forEach(field => {
        if (!options.selectedFields || options.selectedFields.includes(field.id)) {
          const value = response.responses[field.id];
          row.push(this.formatCellValue(value, field.type));
        }
      });

      data.push(row);
    });

    return data;
  }

  private static async generatePDF(form: IForm, responses: IFormResponse[], options: IExportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];
        
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add title
        doc.fontSize(20).text(form.title, { align: 'center' });
        doc.moveDown();
        
        // Add summary
        doc.fontSize(12).text(`Export Date: ${new Date().toLocaleString()}`);
        doc.text(`Total Responses: ${responses.length}`);
        doc.moveDown();

        // Add responses
        responses.slice(0, options.limit || 50).forEach((response, index) => {
          if (index > 0) doc.addPage();
          
          doc.fontSize(14).text(`Response #${index + 1}`, { underline: true });
          doc.fontSize(10).text(`Submitted: ${response.submittedAt?.toLocaleString()}`);
          doc.moveDown();

          form.fields.forEach(field => {
            if (!options.selectedFields || options.selectedFields.includes(field.id)) {
              const value = response.responses[field.id];
              if (value !== undefined && value !== null && value !== '') {
                doc.fontSize(10)
                   .fillColor('black')
                   .text(`${field.label}:`, { continued: false })
                   .text(`${this.formatCellValue(value, field.type)}`, { indent: 20 });
              }
            }
          });
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private static generateCSV(data: any[]): string {
    return data.map(row => 
      row.map((cell: any) => {
        const cellStr = String(cell || '');
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');
  }

  private static getExportHeaders(form: IForm, options: IExportOptions): string[] {
    const headers: string[] = [];

    // Add metadata headers
    if (!options.selectedFields || options.selectedFields.includes('metadata')) {
      headers.push('Submission ID', 'Submitted At');
      if (options.includeMetadata) {
        headers.push('IP Address', 'User Agent', 'Referrer');
      }
    }

    // Add field headers
    form.fields.forEach(field => {
      if (!options.selectedFields || options.selectedFields.includes(field.id)) {
        headers.push(field.label);
      }
    });

    return headers;
  }

  private static formatCellValue(value: any, fieldType: string): string {
    if (value === null || value === undefined) return '';
    
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  }

  private static generateFileName(formTitle: string, extension: string, options: IExportOptions): string {
    const safeTitle = formTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    const dateRange = options.dateFrom || options.dateTo ? `_${options.dateFrom || 'start'}_to_${options.dateTo || 'end'}` : '';
    
    return `${safeTitle}_export_${timestamp}${dateRange}.${extension}`;
  }

  private static generateSummaryData(form: IForm, responses: IFormResponse[]): any[] {
    const summary = [
      { Metric: 'Form Title', Value: form.title },
      { Metric: 'Total Responses', Value: responses.length },
      { Metric: 'Export Date', Value: new Date().toISOString() },
      { Metric: 'Date Range', Value: `${responses[responses.length - 1]?.submittedAt?.toISOString()} to ${responses[0]?.submittedAt?.toISOString()}` }
    ];

    // Add field-specific summaries
    form.fields.forEach(field => {
      const values = responses.map(r => r.responses[field.id]).filter(v => v !== null && v !== undefined && v !== '');
      const responseRate = ((values.length / responses.length) * 100).toFixed(1);
      
      summary.push({
        Metric: `${field.label} - Response Rate`,
        Value: `${responseRate}% (${values.length}/${responses.length})`
      });
    });

    return summary;
  }

  private static generateFieldAnalysis(form: IForm, responses: IFormResponse[]): any[] {
    const analysis: any[] = [];

    form.fields.forEach(field => {
      const values = responses.map(r => r.responses[field.id]).filter(v => v !== null && v !== undefined && v !== '');
      
      const fieldAnalysis: any = {
        'Field Name': field.label,
        'Field Type': field.type,
        'Total Responses': values.length,
        'Response Rate': `${((values.length / responses.length) * 100).toFixed(1)}%`,
        'Completion Rate': `${values.length}/${responses.length}`
      };

      // Add type-specific analysis
      if (field.type === 'dropdown' || field.type === 'radio') {
        const valueCounts: Record<string, number> = {};
        values.forEach(value => {
          const strValue = String(value);
          valueCounts[strValue] = (valueCounts[strValue] || 0) + 1;
        });
        
        const mostCommon = Object.entries(valueCounts)
          .sort(([,a], [,b]) => b - a)[0];
        
        if (mostCommon) {
          fieldAnalysis['Most Common Answer'] = `${mostCommon[0]} (${mostCommon[1]} times)`;
        }
      }

      analysis.push(fieldAnalysis);
    });

    return analysis;
  }

  private static calculateEstimatedSizes(form: IForm, responseCount: number): Record<string, string> {
    // Rough estimates based on average field sizes
    const avgFieldSize = 50; // bytes per field
    const fieldCount = form.fields.length;
    const avgResponseSize = fieldCount * avgFieldSize;

    const excelSize = responseCount * avgResponseSize * 1.5; // Excel overhead
    const pdfSize = responseCount * avgResponseSize * 3; // PDF formatting overhead
    const csvSize = responseCount * avgResponseSize * 1.1; // CSV is most efficient

    return {
      excel: this.formatFileSize(excelSize),
      pdf: this.formatFileSize(pdfSize),
      csv: this.formatFileSize(csvSize)
    };
  }

  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private static async getRecentExports(formId: string): Promise<IExportHistory[]> {
    // This would typically query an export history collection
    // For now, return empty array
    return [];
  }
}

// Type definitions
export interface IExportOptions {
  format?: 'excel' | 'pdf' | 'csv';
  dateFrom?: string;
  dateTo?: string;
  selectedFields?: string[];
  includeMetadata?: boolean;
  includeSummary?: boolean;
  includeAnalysis?: boolean;
  limit?: number;
  filters?: IExportFilter[];
}

export interface IExportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'not_empty' | 'greater_than' | 'less_than';
  value: any;
}

export interface IExportResult {
  success: boolean;
  data?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    size: number;
    recordCount: number;
    exportedAt: Date;
    metadata: any;
  };
  error?: string;
}

export interface IExportStats {
  formId: string;
  formTitle: string;
  totalResponses: number;
  estimatedSizes: Record<string, string>;
  supportedFormats: string[];
  recentExports: IExportHistory[];
  maxRecordsPerExport: Record<string, number>;
  features: {
    includeMetadata: boolean;
    includeSummary: boolean;
    includeAnalysis: boolean;
    dateFiltering: boolean;
    fieldSelection: boolean;
    customFormatting: boolean;
  };
}

export interface IExportHistory {
  id: string;
  format: string;
  recordCount: number;
  fileSize: number;
  exportedAt: Date;
  exportedBy?: string;
  downloadCount: number;
}

export default ExportService;