import { IForm, ICustomThankYouPage, IFormResponse } from '../types';

/**
 * Custom Thank You Page Service
 * Handles creation, management, and rendering of custom completion pages
 */
export class CustomThankYouPageService {

  /**
   * Create default thank you page configuration
   * @param formId - Form identifier
   * @returns Default thank you page configuration
   */
  static createDefaultThankYouPage(formId: string): ICustomThankYouPage {
    return {
      id: `thankyou_${formId}_${Date.now()}`,
      formId,
      isEnabled: false,
      title: 'Thank you!',
      message: 'Your response has been recorded.',
      showSubmissionId: true,
      showResetButton: false,
      resetButtonText: 'Submit Another Response',
      redirectEnabled: false,
      redirectUrl: '',
      redirectDelay: 0,
      customCss: '',
      showShareButtons: false,
      shareMessage: 'Check out this form!',
      customData: {},
      analytics: {
        viewCount: 0,
        shareCount: 0,
        resetCount: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Validate thank you page configuration
   * @param config - Thank you page configuration
   * @returns Validation result
   */
  static validateThankYouPage(config: Partial<ICustomThankYouPage>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!config.title || config.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!config.message || config.message.trim().length === 0) {
      errors.push('Message is required');
    }

    // Validate title length
    if (config.title && config.title.length > 200) {
      errors.push('Title cannot exceed 200 characters');
    }

    // Validate message length
    if (config.message && config.message.length > 2000) {
      errors.push('Message cannot exceed 2000 characters');
    }

    // Validate redirect configuration
    if (config.redirectEnabled) {
      if (!config.redirectUrl || config.redirectUrl.trim().length === 0) {
        errors.push('Redirect URL is required when redirect is enabled');
      } else {
        try {
          new URL(config.redirectUrl);
        } catch {
          errors.push('Invalid redirect URL format');
        }
      }

      if (config.redirectDelay !== undefined && (config.redirectDelay < 0 || config.redirectDelay > 60)) {
        warnings.push('Redirect delay should be between 0 and 60 seconds');
      }
    }

    // Validate reset button text
    if (config.showResetButton && config.resetButtonText && config.resetButtonText.length > 50) {
      warnings.push('Reset button text should not exceed 50 characters');
    }

    // Validate share message
    if (config.showShareButtons && config.shareMessage && config.shareMessage.length > 280) {
      warnings.push('Share message should not exceed 280 characters (Twitter limit)');
    }

    // Validate custom CSS
    if (config.customCss && config.customCss.length > 10000) {
      warnings.push('Custom CSS is quite large and may affect performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Process dynamic content in thank you page
   * @param config - Thank you page configuration
   * @param response - Form response data
   * @param form - Form configuration
   * @returns Processed thank you page with dynamic content
   */
  static processThankYouPageContent(
    config: ICustomThankYouPage,
    response: IFormResponse,
    form: IForm
  ): ICustomThankYouPage {
    const processed = { ...config };

    // Process title with dynamic content
    processed.title = this.replacePlaceholders(config.title, response, form);

    // Process message with dynamic content
    processed.message = this.replacePlaceholders(config.message, response, form);

    // Process share message
    if (config.shareMessage) {
      processed.shareMessage = this.replacePlaceholders(config.shareMessage, response, form);
    }

    // Process custom redirect URL
    if (config.redirectUrl) {
      processed.redirectUrl = this.replacePlaceholders(config.redirectUrl, response, form);
    }

    return processed;
  }

  /**
   * Replace placeholders in text with actual values
   * @param text - Text containing placeholders
   * @param response - Form response data
   * @param form - Form configuration
   * @returns Text with replaced placeholders
   */
  private static replacePlaceholders(text: string, response: IFormResponse, form: IForm): string {
    let processedText = text;

    // Standard placeholders
    const placeholders = {
      '{{submission_id}}': response._id?.toString() || '',
      '{{form_title}}': form.title || '',
      '{{submission_date}}': new Date(response.submittedAt).toLocaleDateString(),
      '{{submission_time}}': new Date(response.submittedAt).toLocaleTimeString(),
      '{{response_count}}': '1', // This would need to be calculated from actual response count
    };

    // Replace standard placeholders
    Object.entries(placeholders).forEach(([placeholder, value]) => {
      processedText = processedText.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    // Replace field-specific placeholders
    if (response.responses) {
      Object.entries(response.responses).forEach(([fieldId, value]) => {
        const fieldPlaceholder = `{{field_${fieldId}}}`;
        const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
        processedText = processedText.replace(
          new RegExp(fieldPlaceholder.replace(/[{}]/g, '\\$&'), 'g'),
          displayValue
        );
      });
    }

    return processedText;
  }

  /**
   * Generate share URLs for thank you page
   * @param config - Thank you page configuration
   * @param formUrl - Public form URL
   * @returns Object with share URLs for different platforms
   */
  static generateShareUrls(config: ICustomThankYouPage, formUrl: string): {
    twitter: string;
    facebook: string;
    linkedin: string;
    email: string;
    whatsapp: string;
  } {
    const message = encodeURIComponent(config.shareMessage || 'Check out this form!');
    const url = encodeURIComponent(formUrl);

    return {
      twitter: `https://twitter.com/intent/tweet?text=${message}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      email: `mailto:?subject=${message}&body=${message}%20${url}`,
      whatsapp: `https://wa.me/?text=${message}%20${url}`
    };
  }

  /**
   * Generate reset form URL
   * @param formUrl - Original form URL
   * @param resetToken - Optional reset token for tracking
   * @returns Reset URL with appropriate parameters
   */
  static generateResetUrl(formUrl: string, resetToken?: string): string {
    const url = new URL(formUrl);
    
    if (resetToken) {
      url.searchParams.set('reset', resetToken);
    }
    
    // Add timestamp to ensure fresh form load
    url.searchParams.set('t', Date.now().toString());
    
    return url.toString();
  }

  /**
   * Track thank you page analytics
   * @param config - Thank you page configuration
   * @param action - Action to track ('view', 'share', 'reset')
   * @returns Updated analytics
   */
  static trackAnalytics(
    config: ICustomThankYouPage,
    action: 'view' | 'share' | 'reset'
  ): ICustomThankYouPage['analytics'] {
    const analytics = { ...config.analytics };

    switch (action) {
      case 'view':
        analytics.viewCount += 1;
        break;
      case 'share':
        analytics.shareCount += 1;
        break;
      case 'reset':
        analytics.resetCount += 1;
        break;
    }

    return analytics;
  }

  /**
   * Generate custom CSS with safety checks
   * @param customCss - User-provided CSS
   * @returns Sanitized and safe CSS
   */
  static sanitizeCustomCss(customCss: string): string {
    if (!customCss) return '';

    // Remove potentially dangerous CSS properties/values
    const dangerousPatterns = [
      /javascript:/gi,
      /expression\s*\(/gi,
      /@import/gi,
      /behavior\s*:/gi,
      /binding\s*:/gi,
      /-moz-binding/gi
    ];

    let sanitized = customCss;
    dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Limit CSS scope to thank you page container
    sanitized = sanitized.replace(
      /([^{]+){/g,
      (match, selector) => {
        // Skip if already scoped
        if (selector.includes('.thank-you-page')) {
          return match;
        }
        
        // Add scope to each selector
        const scopedSelector = selector
          .split(',')
          .map((s: string) => `.thank-you-page ${s.trim()}`)
          .join(', ');
        
        return `${scopedSelector} {`;
      }
    );

    return sanitized;
  }

  /**
   * Generate HTML for thank you page
   * @param config - Processed thank you page configuration
   * @param shareUrls - Share URLs object
   * @param resetUrl - Reset form URL
   * @param confettiHtml - Optional confetti HTML to include
   * @returns Complete HTML for thank you page
   */
  static generateThankYouPageHtml(
    config: ICustomThankYouPage,
    shareUrls: ReturnType<typeof CustomThankYouPageService.generateShareUrls>,
    resetUrl?: string,
    confettiHtml?: string
  ): string {
    const customCss = this.sanitizeCustomCss(config.customCss || '');
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${config.title}</title>
        <style>
          .thank-you-page {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
            line-height: 1.6;
          }
          
          .thank-you-title {
            font-size: 2.5rem;
            font-weight: 700;
            color: #1a202c;
            margin-bottom: 1rem;
          }
          
          .thank-you-message {
            font-size: 1.1rem;
            color: #4a5568;
            margin-bottom: 2rem;
            white-space: pre-wrap;
          }
          
          .submission-info {
            background: #f7fafc;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 2rem;
            color: #2d3748;
          }
          
          .action-buttons {
            margin: 2rem 0;
          }
          
          .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0 8px 8px 0;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.2s;
          }
          
          .btn-primary {
            background: #3182ce;
            color: white;
          }
          
          .btn-primary:hover {
            background: #2c5aa0;
          }
          
          .btn-secondary {
            background: #e2e8f0;
            color: #4a5568;
          }
          
          .btn-secondary:hover {
            background: #cbd5e0;
          }
          
          .share-buttons {
            margin: 2rem 0;
          }
          
          .share-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #2d3748;
          }
          
          .share-btn {
            display: inline-block;
            margin: 0 4px;
            padding: 8px 16px;
            border-radius: 4px;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
          }
          
          .share-twitter { background: #1da1f2; color: white; }
          .share-facebook { background: #4267b2; color: white; }
          .share-linkedin { background: #0077b5; color: white; }
          .share-email { background: #34495e; color: white; }
          .share-whatsapp { background: #25d366; color: white; }
          
          .redirect-notice {
            margin-top: 2rem;
            padding: 1rem;
            background: #fef5e7;
            border-radius: 6px;
            color: #744210;
          }
          
          ${customCss}
        </style>
      </head>
      <body>
        <div class="thank-you-page">
          <h1 class="thank-you-title">${config.title}</h1>
          <p class="thank-you-message">${config.message}</p>
          
          ${config.showSubmissionId ? `
            <div class="submission-info">
              <strong>Submission ID:</strong> ${config.customData?.submissionId || 'N/A'}
            </div>
          ` : ''}
          
          <div class="action-buttons">
            ${config.showResetButton && resetUrl ? `
              <a href="${resetUrl}" class="btn btn-primary">
                ${config.resetButtonText || 'Submit Another Response'}
              </a>
            ` : ''}
          </div>
          
          ${config.showShareButtons ? `
            <div class="share-buttons">
              <div class="share-title">${config.shareMessage || 'Share this form'}</div>
              <a href="${shareUrls.twitter}" target="_blank" class="share-btn share-twitter">Twitter</a>
              <a href="${shareUrls.facebook}" target="_blank" class="share-btn share-facebook">Facebook</a>
              <a href="${shareUrls.linkedin}" target="_blank" class="share-btn share-linkedin">LinkedIn</a>
              <a href="${shareUrls.email}" class="share-btn share-email">Email</a>
              <a href="${shareUrls.whatsapp}" target="_blank" class="share-btn share-whatsapp">WhatsApp</a>
            </div>
          ` : ''}
          
          ${config.redirectEnabled && config.redirectUrl ? `
            <div class="redirect-notice">
              You will be redirected in ${config.redirectDelay || 0} seconds...
            </div>
            <script>
              setTimeout(function() {
                window.location.href = '${config.redirectUrl}';
              }, ${(config.redirectDelay || 0) * 1000});
            </script>
          ` : ''}
          
          ${confettiHtml || ''}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Create thank you page preview
   * @param config - Thank you page configuration
   * @returns Preview data
   */
  static createPreview(config: ICustomThankYouPage): {
    html: string;
    previewData: {
      title: string;
      message: string;
      hasRedirect: boolean;
      hasSharing: boolean;
      hasReset: boolean;
      customStyling: boolean;
    };
  } {
    // Mock data for preview
    const mockResponse = {
      _id: 'preview_123',
      submittedAt: new Date(),
      responses: {
        'field_1': 'John Doe',
        'field_2': 'john@example.com'
      }
    } as any;

    const mockForm = {
      title: 'Sample Form',
      description: 'This is a preview'
    } as any;

    const processedConfig = this.processThankYouPageContent(config, mockResponse, mockForm);
    processedConfig.customData = { submissionId: 'preview_123' };

    const shareUrls = this.generateShareUrls(processedConfig, 'https://example.com/form/preview');
    const resetUrl = config.showResetButton ? 'https://example.com/form/preview?reset=1' : undefined;

    const html = this.generateThankYouPageHtml(processedConfig, shareUrls, resetUrl);

    return {
      html,
      previewData: {
        title: processedConfig.title,
        message: processedConfig.message,
        hasRedirect: !!config.redirectEnabled,
        hasSharing: !!config.showShareButtons,
        hasReset: !!config.showResetButton,
        customStyling: !!(config.customCss && config.customCss.trim())
      }
    };
  }
}

export default CustomThankYouPageService;