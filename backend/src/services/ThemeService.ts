import { IFormCustomization } from '../types';

/**
 * Theme Service
 * Handles theme management and custom design options
 */
export class ThemeService {

  /**
   * Predefined themes with complete customization settings
   */
  static readonly PREDEFINED_THEMES = {
    default: {
      name: 'Default',
      description: 'Clean and professional default theme',
      primaryColor: '#3b82f6',
      fontFamily: 'Inter',
      backgroundColor: '#ffffff',
      theme: 'default' as const,
      customCss: ''
    },
    minimal: {
      name: 'Minimal',
      description: 'Clean minimal design with subtle colors',
      primaryColor: '#6b7280',
      fontFamily: 'Inter',
      backgroundColor: '#f9fafb',
      theme: 'minimal' as const,
      customCss: `
        .form-container { box-shadow: none; border: 1px solid #e5e7eb; }
        .form-field { margin-bottom: 1.5rem; }
        .form-button { border-radius: 4px; font-weight: 500; }
      `
    },
    modern: {
      name: 'Modern',
      description: 'Bold and contemporary design',
      primaryColor: '#10b981',
      fontFamily: 'Poppins',
      backgroundColor: '#ffffff',
      theme: 'modern' as const,
      customCss: `
        .form-container { border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        .form-field { margin-bottom: 2rem; }
        .form-button { border-radius: 8px; font-weight: 600; padding: 12px 24px; }
        .form-input { border-radius: 8px; border: 2px solid #e5e7eb; }
        .form-input:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
      `
    },
    classic: {
      name: 'Classic',
      description: 'Traditional and elegant design',
      primaryColor: '#7c3aed',
      fontFamily: 'Georgia',
      backgroundColor: '#fefefe',
      theme: 'classic' as const,
      customCss: `
        .form-container { border: 2px solid #e5e7eb; border-radius: 0; }
        .form-field { margin-bottom: 1.25rem; }
        .form-button { border-radius: 0; font-weight: 400; text-transform: uppercase; letter-spacing: 1px; }
        .form-label { font-weight: 600; color: #374151; }
      `
    },
    gradient: {
      name: 'Gradient',
      description: 'Eye-catching gradient design',
      primaryColor: '#8b5cf6',
      fontFamily: 'Poppins',
      backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      theme: 'custom' as const,
      customCss: `
        .form-container { 
          background: rgba(255,255,255,0.95); 
          backdrop-filter: blur(10px);
          border-radius: 16px; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .form-field { margin-bottom: 2rem; }
        .form-button { 
          background: linear-gradient(45deg, #8b5cf6, #a855f7);
          border: none;
          border-radius: 12px; 
          font-weight: 600; 
          padding: 14px 28px;
        }
        .form-input { 
          border-radius: 12px; 
          border: 1px solid rgba(139,92,246,0.3);
          background: rgba(255,255,255,0.8);
        }
      `
    },
    dark: {
      name: 'Dark Mode',
      description: 'Sleek dark theme for modern interfaces',
      primaryColor: '#3b82f6',
      fontFamily: 'Inter',
      backgroundColor: '#1f2937',
      theme: 'custom' as const,
      customCss: `
        .form-container { 
          background: #374151; 
          color: #f9fafb;
          border-radius: 12px; 
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }
        .form-field { margin-bottom: 1.5rem; }
        .form-label { color: #f3f4f6; font-weight: 500; }
        .form-input { 
          background: #4b5563; 
          border: 1px solid #6b7280; 
          color: #f9fafb;
          border-radius: 8px;
        }
        .form-input:focus { 
          border-color: #3b82f6; 
          background: #374151;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        .form-button { 
          background: #3b82f6;
          border-radius: 8px; 
          font-weight: 600; 
        }
      `
    }
  };

  /**
   * Available font families
   */
  static readonly FONT_FAMILIES = [
    'Inter',
    'Roboto',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Poppins',
    'Georgia',
    'Times New Roman',
    'Arial',
    'Helvetica'
  ];

  /**
   * Color palette suggestions
   */
  static readonly COLOR_PALETTES = {
    blue: ['#3b82f6', '#1d4ed8', '#2563eb', '#1e40af', '#1e3a8a'],
    green: ['#10b981', '#059669', '#047857', '#065f46', '#064e3b'],
    purple: ['#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95'],
    red: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'],
    orange: ['#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'],
    pink: ['#ec4899', '#db2777', '#be185d', '#9d174d', '#831843'],
    indigo: ['#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81'],
    gray: ['#6b7280', '#4b5563', '#374151', '#1f2937', '#111827']
  };

  /**
   * Apply theme to form customization
   * @param themeName - Name of predefined theme
   * @param existingCustomization - Existing customization to merge
   * @returns Updated customization object
   */
  static applyTheme(
    themeName: keyof typeof ThemeService.PREDEFINED_THEMES,
    existingCustomization?: Partial<IFormCustomization>
  ): IFormCustomization {
    const theme = this.PREDEFINED_THEMES[themeName];
    if (!theme) {
      throw new Error(`Theme '${themeName}' not found`);
    }

    return {
      primaryColor: theme.primaryColor,
      fontFamily: theme.fontFamily,
      backgroundColor: theme.backgroundColor,
      theme: theme.theme,
      customCss: theme.customCss,
      ...existingCustomization // Allow overrides
    };
  }

  /**
   * Generate CSS variables from customization
   * @param customization - Form customization object
   * @returns CSS string with custom properties
   */
  static generateCssVariables(customization: IFormCustomization): string {
    const cssVariables = [
      `--form-primary-color: ${customization.primaryColor};`,
      `--form-font-family: ${customization.fontFamily};`,
      `--form-background: ${customization.backgroundColor};`
    ];

    // Add derived colors
    const primaryColor = customization.primaryColor;
    if (this.isValidHexColor(primaryColor)) {
      cssVariables.push(
        `--form-primary-light: ${this.lightenColor(primaryColor, 20)};`,
        `--form-primary-dark: ${this.darkenColor(primaryColor, 20)};`,
        `--form-primary-alpha: ${this.hexToRgba(primaryColor, 0.1)};`
      );
    }

    return `:root {\n  ${cssVariables.join('\n  ')}\n}`;
  }

  /**
   * Generate complete theme CSS
   * @param customization - Form customization object
   * @returns Complete CSS string for the theme
   */
  static generateThemeCSS(customization: IFormCustomization): string {
    let css = this.generateCssVariables(customization);

    // Add base theme styles
    css += '\n\n' + this.getBaseThemeCSS(customization.theme);

    // Add custom CSS if provided
    if (customization.customCss) {
      css += '\n\n/* Custom CSS */\n' + customization.customCss;
    }

    return css;
  }

  /**
   * Get base CSS for theme type
   * @param themeType - Theme type
   * @returns Base CSS for the theme
   */
  static getBaseThemeCSS(themeType: string): string {
    const baseStyles = {
      default: `
        .form-container {
          font-family: var(--form-font-family);
          background: var(--form-background);
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .form-button {
          background: var(--form-primary-color);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
        }
        .form-button:hover {
          background: var(--form-primary-dark);
        }
        .form-input {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 10px 12px;
          font-family: var(--form-font-family);
        }
        .form-input:focus {
          outline: none;
          border-color: var(--form-primary-color);
          box-shadow: 0 0 0 3px var(--form-primary-alpha);
        }
      `,
      minimal: `
        .form-container {
          font-family: var(--form-font-family);
          background: var(--form-background);
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
        }
        .form-button {
          background: var(--form-primary-color);
          color: white;
          border: none;
          padding: 10px 20px;
          font-weight: 400;
          cursor: pointer;
        }
        .form-input {
          border: 1px solid #d1d5db;
          padding: 8px 10px;
          font-family: var(--form-font-family);
        }
      `,
      modern: `
        .form-container {
          font-family: var(--form-font-family);
          background: var(--form-background);
          padding: 2.5rem;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        .form-button {
          background: var(--form-primary-color);
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .form-button:hover {
          background: var(--form-primary-dark);
          transform: translateY(-1px);
        }
        .form-input {
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px 16px;
          font-family: var(--form-font-family);
          transition: all 0.2s ease;
        }
        .form-input:focus {
          outline: none;
          border-color: var(--form-primary-color);
          box-shadow: 0 0 0 3px var(--form-primary-alpha);
        }
      `,
      classic: `
        .form-container {
          font-family: var(--form-font-family);
          background: var(--form-background);
          padding: 2rem;
          border: 2px solid #e5e7eb;
        }
        .form-button {
          background: var(--form-primary-color);
          color: white;
          border: none;
          padding: 12px 24px;
          font-weight: 400;
          text-transform: uppercase;
          letter-spacing: 1px;
          cursor: pointer;
        }
        .form-input {
          border: 1px solid #9ca3af;
          padding: 10px 12px;
          font-family: var(--form-font-family);
        }
      `
    };

    return baseStyles[themeType as keyof typeof baseStyles] || baseStyles.default;
  }

  /**
   * Validate theme customization
   * @param customization - Customization object to validate
   * @returns Validation result
   */
  static validateCustomization(customization: Partial<IFormCustomization>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate primary color
    if (customization.primaryColor && !this.isValidHexColor(customization.primaryColor)) {
      errors.push('Primary color must be a valid hex color (e.g., #3b82f6)');
    }

    // Validate font family
    if (customization.fontFamily && !this.FONT_FAMILIES.includes(customization.fontFamily)) {
      warnings.push(`Font family '${customization.fontFamily}' is not in the recommended list`);
    }

    // Validate background color
    if (customization.backgroundColor) {
      if (!this.isValidHexColor(customization.backgroundColor) && 
          !this.isValidGradient(customization.backgroundColor)) {
        errors.push('Background must be a valid hex color or CSS gradient');
      }
    }

    // Validate theme type
    if (customization.theme && 
        !['default', 'minimal', 'modern', 'classic', 'custom'].includes(customization.theme)) {
      errors.push('Invalid theme type');
    }

    // Validate custom CSS
    if (customization.customCss) {
      const cssErrors = this.validateCustomCSS(customization.customCss);
      errors.push(...cssErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get theme recommendations based on form type
   * @param formType - Type of form
   * @param industry - Industry context
   * @returns Recommended themes
   */
  static getThemeRecommendations(
    formType?: string,
    industry?: string
  ): Array<{ name: string; reason: string; theme: keyof typeof ThemeService.PREDEFINED_THEMES }> {
    const recommendations = [];

    if (formType === 'survey' || formType === 'feedback') {
      recommendations.push({
        name: 'Modern',
        reason: 'Engaging design that encourages completion',
        theme: 'modern' as const
      });
    }

    if (formType === 'application' || formType === 'registration') {
      recommendations.push({
        name: 'Classic',
        reason: 'Professional appearance for formal processes',
        theme: 'classic' as const
      });
    }

    if (industry === 'technology' || industry === 'startup') {
      recommendations.push({
        name: 'Gradient',
        reason: 'Contemporary design for tech-forward companies',
        theme: 'gradient' as const
      });
    }

    if (industry === 'healthcare' || industry === 'legal') {
      recommendations.push({
        name: 'Minimal',
        reason: 'Clean, trustworthy design for professional services',
        theme: 'minimal' as const
      });
    }

    // Always include default as a safe option
    recommendations.push({
      name: 'Default',
      reason: 'Reliable, professional design that works for any use case',
      theme: 'default' as const
    });

    return recommendations;
  }

  // Helper methods

  private static isValidHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  private static isValidGradient(background: string): boolean {
    return background.includes('gradient') || background.includes('linear') || background.includes('radial');
  }

  private static lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  private static darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
      (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
      (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
  }

  private static hexToRgba(hex: string, alpha: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
  }

  private static validateCustomCSS(css: string): string[] {
    const errors: string[] = [];
    
    // Basic CSS validation
    if (css.includes('<script>') || css.includes('javascript:')) {
      errors.push('Custom CSS cannot contain script tags or javascript URLs');
    }
    
    if (css.includes('@import')) {
      errors.push('Custom CSS cannot contain @import statements');
    }
    
    return errors;
  }
}

export default ThemeService;