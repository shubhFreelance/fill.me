import dns from 'dns';
import { promisify } from 'util';

/**
 * Custom Domain Service
 * Handles custom domain management and verification
 */
export class CustomDomainService {

  private static readonly dnsLookup = promisify(dns.lookup);
  private static readonly dnsResolve = promisify(dns.resolve);

  /**
   * Validate domain format
   * @param domain - Domain to validate
   * @returns Validation result
   */
  static validateDomain(domain: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Remove protocol if present
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Basic domain validation
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    
    if (!domainRegex.test(cleanDomain)) {
      errors.push('Invalid domain format');
    }

    // Check for forbidden characters
    if (cleanDomain.includes('..')) {
      errors.push('Domain cannot contain consecutive dots');
    }

    // Check length
    if (cleanDomain.length > 253) {
      errors.push('Domain name too long (max 253 characters)');
    }

    // Check for reserved domains
    const reservedDomains = ['localhost', 'example.com', 'test.com', 'invalid'];
    if (reservedDomains.some(reserved => cleanDomain.includes(reserved))) {
      errors.push('Cannot use reserved domain names');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify domain ownership through DNS verification
   * @param domain - Domain to verify
   * @param verificationToken - Unique verification token
   * @returns Verification result
   */
  static async verifyDomainOwnership(
    domain: string, 
    verificationToken: string
  ): Promise<{ 
    isVerified: boolean; 
    method: string; 
    details: any; 
    errors: string[] 
  }> {
    const errors: string[] = [];
    
    try {
      // Method 1: TXT record verification
      const txtVerification = await this.verifyTxtRecord(domain, verificationToken);
      if (txtVerification.isVerified) {
        return {
          isVerified: true,
          method: 'TXT',
          details: txtVerification.details,
          errors: []
        };
      }

      // Method 2: CNAME record verification
      const cnameVerification = await this.verifyCnameRecord(domain, verificationToken);
      if (cnameVerification.isVerified) {
        return {
          isVerified: true,
          method: 'CNAME',
          details: cnameVerification.details,
          errors: []
        };
      }

      // Method 3: File-based verification (meta tag or file upload)
      const fileVerification = await this.verifyFileMethod(domain, verificationToken);
      if (fileVerification.isVerified) {
        return {
          isVerified: true,
          method: 'FILE',
          details: fileVerification.details,
          errors: []
        };
      }

      errors.push('Domain verification failed for all methods');
      return {
        isVerified: false,
        method: 'NONE',
        details: null,
        errors
      };

    } catch (error: any) {
      errors.push(`Verification error: ${error.message}`);
      return {
        isVerified: false,
        method: 'ERROR',
        details: null,
        errors
      };
    }
  }

  /**
   * Generate verification instructions for domain setup
   * @param domain - Domain to setup
   * @param verificationToken - Verification token
   * @returns Setup instructions
   */
  static generateVerificationInstructions(
    domain: string, 
    verificationToken: string
  ): {
    txtRecord: { name: string; value: string; instructions: string };
    cnameRecord: { name: string; value: string; instructions: string };
    fileMethod: { filename: string; content: string; instructions: string };
    metaTag: { tag: string; instructions: string };
  } {
    const baseUrl = process.env.BACKEND_URL || 'https://api.youform.com';
    
    return {
      txtRecord: {
        name: `_youform-verification.${domain}`,
        value: verificationToken,
        instructions: `Add a TXT record with name "_youform-verification.${domain}" and value "${verificationToken}" to your DNS settings.`
      },
      cnameRecord: {
        name: `verify.${domain}`,
        value: `verify.youform.com`,
        instructions: `Add a CNAME record with name "verify.${domain}" pointing to "verify.youform.com".`
      },
      fileMethod: {
        filename: `youform-verification-${verificationToken}.txt`,
        content: verificationToken,
        instructions: `Upload a file named "youform-verification-${verificationToken}.txt" containing "${verificationToken}" to your domain root (http://${domain}/youform-verification-${verificationToken}.txt).`
      },
      metaTag: {
        tag: `<meta name="youform-verification" content="${verificationToken}">`,
        instructions: `Add the meta tag '<meta name="youform-verification" content="${verificationToken}">' to your website's <head> section.`
      }
    };
  }

  /**
   * Check domain SSL certificate status
   * @param domain - Domain to check
   * @returns SSL status information
   */
  static async checkSSLStatus(domain: string): Promise<{
    hasSSL: boolean;
    issuer?: string;
    validFrom?: Date;
    validTo?: Date;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // This is a simplified implementation
      // In production, you'd use actual SSL checking libraries
      const https = require('https');
      const url = require('url');

      return new Promise((resolve) => {
        const options = {
          hostname: domain,
          port: 443,
          path: '/',
          method: 'GET',
          timeout: 5000
        };

        const req = https.request(options, (res: any) => {
          const cert = res.socket.getPeerCertificate();
          if (cert && Object.keys(cert).length > 0) {
            resolve({
              hasSSL: true,
              issuer: cert.issuer?.CN || 'Unknown',
              validFrom: new Date(cert.valid_from),
              validTo: new Date(cert.valid_to),
              errors: []
            });
          } else {
            resolve({
              hasSSL: false,
              errors: ['No SSL certificate found']
            });
          }
        });

        req.on('error', () => {
          resolve({
            hasSSL: false,
            errors: ['SSL connection failed']
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            hasSSL: false,
            errors: ['SSL check timeout']
          });
        });

        req.end();
      });

    } catch (error: any) {
      return {
        hasSSL: false,
        errors: [`SSL check error: ${error.message}`]
      };
    }
  }

  /**
   * Generate domain configuration for CDN/proxy setup
   * @param domain - Custom domain
   * @param formId - Form ID
   * @returns Configuration details
   */
  static generateDomainConfig(domain: string, formId: string): {
    origin: string;
    cname: string;
    headers: Record<string, string>;
    paths: string[];
    redirects: Array<{ from: string; to: string }>;
  } {
    const baseUrl = process.env.FRONTEND_URL || 'https://youform.com';
    
    return {
      origin: baseUrl,
      cname: 'forms.youform.com',
      headers: {
        'X-Custom-Domain': domain,
        'X-Form-ID': formId,
        'X-Forwarded-Host': domain
      },
      paths: [
        `/form/${formId}`,
        `/embed/${formId}`,
        `/api/public/forms/${formId}`,
        `/uploads/*`
      ],
      redirects: [
        { from: '/', to: `/form/${formId}` },
        { from: '/index.html', to: `/form/${formId}` }
      ]
    };
  }

  /**
   * Get domain analytics and metrics
   * @param domain - Custom domain
   * @returns Domain analytics
   */
  static async getDomainAnalytics(domain: string): Promise<{
    totalVisits: number;
    uniqueVisitors: number;
    countries: Record<string, number>;
    referrers: Record<string, number>;
    lastVerified: Date | null;
    uptime: number;
  }> {
    // This would integrate with analytics service
    // Returning mock structure for now
    return {
      totalVisits: 0,
      uniqueVisitors: 0,
      countries: {},
      referrers: {},
      lastVerified: null,
      uptime: 99.9
    };
  }

  // Private helper methods

  private static async verifyTxtRecord(
    domain: string, 
    token: string
  ): Promise<{ isVerified: boolean; details: any }> {
    try {
      const txtRecords = await this.dnsResolve(domain, 'TXT') as string[][];
      const verificationRecord = `_youform-verification.${domain}`;
      
      // Check if any TXT record contains our verification token
      const found = txtRecords.some(record => 
        record.some(value => value.includes(token))
      );

      return {
        isVerified: found,
        details: { records: txtRecords, searchToken: token }
      };
    } catch (error) {
      return { isVerified: false, details: { error: error.message } };
    }
  }

  private static async verifyCnameRecord(
    domain: string, 
    token: string
  ): Promise<{ isVerified: boolean; details: any }> {
    try {
      const verifySubdomain = `verify.${domain}`;
      const cnameRecords = await this.dnsResolve(verifySubdomain, 'CNAME') as string[];
      
      const found = cnameRecords.some(record => 
        record.includes('verify.youform.com')
      );

      return {
        isVerified: found,
        details: { records: cnameRecords, subdomain: verifySubdomain }
      };
    } catch (error) {
      return { isVerified: false, details: { error: error.message } };
    }
  }

  private static async verifyFileMethod(
    domain: string, 
    token: string
  ): Promise<{ isVerified: boolean; details: any }> {
    try {
      const axios = require('axios');
      const verificationUrl = `http://${domain}/youform-verification-${token}.txt`;
      
      const response = await axios.get(verificationUrl, { timeout: 5000 });
      const isVerified = response.data.trim() === token;

      return {
        isVerified,
        details: { url: verificationUrl, content: response.data }
      };
    } catch (error) {
      // Try HTTPS
      try {
        const axios = require('axios');
        const verificationUrl = `https://${domain}/youform-verification-${token}.txt`;
        
        const response = await axios.get(verificationUrl, { timeout: 5000 });
        const isVerified = response.data.trim() === token;

        return {
          isVerified,
          details: { url: verificationUrl, content: response.data }
        };
      } catch (httpsError) {
        return { 
          isVerified: false, 
          details: { error: `HTTP/HTTPS verification failed: ${error.message}` }
        };
      }
    }
  }

  /**
   * Check if domain is available for use
   * @param domain - Domain to check
   * @returns Availability status
   */
  static async checkDomainAvailability(domain: string): Promise<{
    isAvailable: boolean;
    isUsedByOtherUser: boolean;
    currentUserId?: string;
    errors: string[];
  }> {
    // This would check against your database of registered domains
    // Simplified implementation
    return {
      isAvailable: true,
      isUsedByOtherUser: false,
      errors: []
    };
  }

  /**
   * Generate domain verification token
   * @param userId - User ID
   * @param domain - Domain name
   * @returns Verification token
   */
  static generateVerificationToken(userId: string, domain: string): string {
    const crypto = require('crypto');
    const data = `${userId}-${domain}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }
}

export default CustomDomainService;