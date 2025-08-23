import { IForm, IFormResponse } from '../types';

/**
 * Confetti Animation Service
 * Handles confetti animations for form submissions and completion pages
 */
export class ConfettiAnimationService {

  /**
   * Default confetti configuration
   */
  private static readonly DEFAULT_CONFIG = {
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'],
    duration: 3000,
    scalar: 0.8,
    drift: 0,
    gravity: 1,
    ticks: 200,
    shapes: ['square', 'circle'],
    zIndex: 100
  };

  /**
   * Animation presets for different occasions
   */
  private static readonly PRESETS = {
    celebration: {
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#ff0000', '#ff7300', '#fffb00', '#48ff00', '#00ffd5', '#002bff', '#7a00ff', '#ff00c8'],
      duration: 4000,
      scalar: 1.2,
      gravity: 0.8
    },
    success: {
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#00ff00', '#32cd32', '#90ee90', '#7fff00', '#adff2f'],
      duration: 2500,
      scalar: 0.9,
      gravity: 1.1
    },
    burst: {
      particleCount: 200,
      spread: 120,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'],
      duration: 2000,
      scalar: 0.7,
      gravity: 1.5
    },
    fireworks: {
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#ff0000', '#ff7300', '#fffb00', '#48ff00', '#00ffd5', '#002bff', '#ff00c8'],
      duration: 5000,
      scalar: 1.0,
      gravity: 0.6,
      multiple: true,
      launches: 5,
      launchDelay: 500
    },
    rain: {
      particleCount: 300,
      spread: 180,
      origin: { x: 0.5, y: 0 },
      colors: ['#87ceeb', '#4682b4', '#5f9ea0', '#6495ed', '#7b68ee'],
      duration: 3500,
      scalar: 0.6,
      gravity: 2.0,
      shapes: ['circle']
    },
    minimal: {
      particleCount: 40,
      spread: 45,
      origin: { y: 0.8 },
      colors: ['#333333', '#666666', '#999999'],
      duration: 1500,
      scalar: 0.5,
      gravity: 1.3
    }
  };

  /**
   * Form-specific confetti configurations based on form type/category
   */
  private static readonly FORM_TYPE_CONFIGS = {
    celebration: 'celebration',
    birthday: 'celebration',
    wedding: 'celebration',
    congratulations: 'celebration',
    success: 'success',
    completion: 'success',
    achievement: 'success',
    contact: 'minimal',
    feedback: 'success',
    survey: 'success',
    quiz: 'burst',
    assessment: 'burst',
    registration: 'success',
    application: 'success',
    booking: 'minimal',
    order: 'success',
    newsletter: 'minimal',
    evaluation: 'success'
  };

  /**
   * Generate confetti configuration for a form
   * @param form - Form configuration
   * @param customConfig - Optional custom configuration
   * @returns Confetti configuration object
   */
  static generateConfettiConfig(
    form: IForm,
    customConfig?: Partial<IConfettiConfig>
  ): IConfettiConfig {
    // Determine preset based on form properties
    let presetName = 'success'; // default

    // Check form title for keywords
    const titleLower = form.title.toLowerCase();
    for (const [keyword, preset] of Object.entries(this.FORM_TYPE_CONFIGS)) {
      if (titleLower.includes(keyword)) {
        presetName = preset;
        break;
      }
    }

    // Check form description for keywords
    if (form.description && presetName === 'success') {
      const descriptionLower = form.description.toLowerCase();
      for (const [keyword, preset] of Object.entries(this.FORM_TYPE_CONFIGS)) {
        if (descriptionLower.includes(keyword)) {
          presetName = preset;
          break;
        }
      }
    }

    // Get base configuration
    const baseConfig = this.PRESETS[presetName as keyof typeof this.PRESETS] || this.PRESETS.success;

    // Apply form theme colors if available
    let themeColors = baseConfig.colors;
    if (form.customization?.primaryColor) {
      themeColors = this.generateColorVariations(form.customization.primaryColor);
    }

    // Merge configurations
    const finalConfig: IConfettiConfig = {
      ...this.DEFAULT_CONFIG,
      ...baseConfig,
      colors: themeColors,
      ...customConfig
    };

    return finalConfig;
  }

  /**
   * Generate color variations from a primary color
   * @param primaryColor - Primary color in hex format
   * @returns Array of color variations
   */
  private static generateColorVariations(primaryColor: string): string[] {
    // Parse hex color
    const hex = primaryColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const variations: string[] = [primaryColor];

    // Generate lighter variations
    for (let i = 1; i <= 3; i++) {
      const factor = 0.3 * i;
      const newR = Math.min(255, Math.round(r + (255 - r) * factor));
      const newG = Math.min(255, Math.round(g + (255 - g) * factor));
      const newB = Math.min(255, Math.round(b + (255 - b) * factor));
      variations.push(`rgb(${newR}, ${newG}, ${newB})`);
    }

    // Generate darker variations
    for (let i = 1; i <= 2; i++) {
      const factor = 0.3 * i;
      const newR = Math.max(0, Math.round(r * (1 - factor)));
      const newG = Math.max(0, Math.round(g * (1 - factor)));
      const newB = Math.max(0, Math.round(b * (1 - factor)));
      variations.push(`rgb(${newR}, ${newG}, ${newB})`);
    }

    return variations;
  }

  /**
   * Generate confetti JavaScript code for client-side execution
   * @param config - Confetti configuration
   * @returns JavaScript code string
   */
  static generateConfettiScript(config: IConfettiConfig): string {
    const configJson = JSON.stringify(config, null, 2);
    
    if (config.multiple && config.launches && config.launchDelay) {
      // Multiple launches (fireworks style)
      return `
        (function() {
          const confettiConfig = ${configJson};
          let launchCount = 0;
          const maxLaunches = confettiConfig.launches || 3;
          const delay = confettiConfig.launchDelay || 500;
          
          function launchConfetti() {
            if (typeof confetti === 'function') {
              const singleConfig = { ...confettiConfig };
              delete singleConfig.multiple;
              delete singleConfig.launches;
              delete singleConfig.launchDelay;
              
              // Randomize origin for variety
              singleConfig.origin = {
                x: Math.random() * 0.6 + 0.2,
                y: Math.random() * 0.3 + 0.7
              };
              
              confetti(singleConfig);
            }
            
            launchCount++;
            if (launchCount < maxLaunches) {
              setTimeout(launchConfetti, delay);
            }
          }
          
          launchConfetti();
        })();
      `;
    } else {
      // Single launch
      return `
        (function() {
          const confettiConfig = ${configJson};
          if (typeof confetti === 'function') {
            confetti(confettiConfig);
          }
        })();
      `;
    }
  }

  /**
   * Generate HTML with embedded confetti script
   * @param config - Confetti configuration
   * @param includeLibrary - Whether to include the confetti library
   * @returns Complete HTML string
   */
  static generateConfettiHtml(config: IConfettiConfig, includeLibrary: boolean = true): string {
    const script = this.generateConfettiScript(config);
    
    return `
      ${includeLibrary ? '<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>' : ''}
      <script>
        ${script}
      </script>
    `;
  }

  /**
   * Create confetti trigger for form submission
   * @param form - Form configuration
   * @param response - Form response data
   * @param customConfig - Optional custom configuration
   * @returns Confetti trigger configuration
   */
  static createSubmissionConfetti(
    form: IForm,
    response: IFormResponse,
    customConfig?: Partial<IConfettiConfig>
  ): IConfettiTrigger {
    const config = this.generateConfettiConfig(form, customConfig);
    
    // Enhanced config based on response data
    const enhancedConfig = { ...config };
    
    // Increase celebration for high-value responses
    if (this.isHighValueResponse(response)) {
      enhancedConfig.particleCount = Math.floor(enhancedConfig.particleCount * 1.5);
      enhancedConfig.duration = enhancedConfig.duration * 1.2;
    }
    
    // Adjust for completion time
    const completionTime = this.calculateCompletionTime(response);
    if (completionTime > 0 && completionTime < 30) { // Very quick completion
      enhancedConfig.particleCount = Math.floor(enhancedConfig.particleCount * 0.8);
    } else if (completionTime > 300) { // Very long completion
      enhancedConfig.particleCount = Math.floor(enhancedConfig.particleCount * 1.3);
      enhancedConfig.duration = enhancedConfig.duration * 1.1;
    }

    return {
      id: `confetti_${response._id}`,
      config: enhancedConfig,
      trigger: 'immediate',
      delay: 0,
      conditions: {
        formSubmitted: true,
        responseValid: response.isValid
      },
      createdAt: new Date()
    };
  }

  /**
   * Check if response is considered high-value
   * @param response - Form response data
   * @returns Boolean indicating if response is high-value
   */
  private static isHighValueResponse(response: IFormResponse): boolean {
    const responses = response.responses || {};
    const responseCount = Object.keys(responses).length;
    
    // High value if many fields filled
    if (responseCount > 10) return true;
    
    // Check for specific field types that indicate value
    const highValueKeywords = ['email', 'phone', 'purchase', 'payment', 'subscribe', 'register'];
    const responseText = JSON.stringify(responses).toLowerCase();
    
    return highValueKeywords.some(keyword => responseText.includes(keyword));
  }

  /**
   * Calculate form completion time from response
   * @param response - Form response data
   * @returns Completion time in seconds
   */
  private static calculateCompletionTime(response: IFormResponse): number {
    // This would typically be calculated from form start time to submission time
    // For now, we'll use a simple estimation based on response complexity
    const responseCount = Object.keys(response.responses || {}).length;
    return responseCount * 15; // Estimate 15 seconds per field
  }

  /**
   * Validate confetti configuration
   * @param config - Confetti configuration to validate
   * @returns Validation result
   */
  static validateConfettiConfig(config: Partial<IConfettiConfig>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate particle count
    if (config.particleCount !== undefined) {
      if (config.particleCount < 1) {
        errors.push('Particle count must be at least 1');
      } else if (config.particleCount > 500) {
        warnings.push('High particle count may impact performance');
      }
    }

    // Validate spread
    if (config.spread !== undefined) {
      if (config.spread < 0 || config.spread > 360) {
        errors.push('Spread must be between 0 and 360 degrees');
      }
    }

    // Validate duration
    if (config.duration !== undefined) {
      if (config.duration < 100) {
        warnings.push('Very short duration may not be visible');
      } else if (config.duration > 10000) {
        warnings.push('Very long duration may be annoying to users');
      }
    }

    // Validate colors
    if (config.colors && Array.isArray(config.colors)) {
      if (config.colors.length === 0) {
        errors.push('At least one color must be specified');
      }
      
      // Validate color format
      config.colors.forEach((color, index) => {
        if (typeof color !== 'string' || (!color.startsWith('#') && !color.startsWith('rgb'))) {
          warnings.push(`Color at index ${index} may not be in valid format`);
        }
      });
    }

    // Validate origin
    if (config.origin) {
      if (config.origin.x !== undefined && (config.origin.x < 0 || config.origin.x > 1)) {
        errors.push('Origin x must be between 0 and 1');
      }
      if (config.origin.y !== undefined && (config.origin.y < 0 || config.origin.y > 1)) {
        errors.push('Origin y must be between 0 and 1');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get available presets list
   * @returns Array of available preset names with descriptions
   */
  static getAvailablePresets(): Array<{
    name: string;
    description: string;
    config: Partial<IConfettiConfig>;
  }> {
    return [
      {
        name: 'celebration',
        description: 'Colorful celebration confetti with high particle count',
        config: this.PRESETS.celebration
      },
      {
        name: 'success',
        description: 'Green-themed success confetti',
        config: this.PRESETS.success
      },
      {
        name: 'burst',
        description: 'Explosive burst from center',
        config: this.PRESETS.burst
      },
      {
        name: 'fireworks',
        description: 'Multiple launches like fireworks',
        config: this.PRESETS.fireworks
      },
      {
        name: 'rain',
        description: 'Confetti falling like rain from top',
        config: this.PRESETS.rain
      },
      {
        name: 'minimal',
        description: 'Subtle, minimal confetti effect',
        config: this.PRESETS.minimal
      }
    ];
  }
}

// Interfaces for confetti configuration
export interface IConfettiConfig {
  particleCount: number;
  spread: number;
  origin: { x?: number; y?: number };
  colors: string[];
  duration: number;
  scalar: number;
  drift: number;
  gravity: number;
  ticks: number;
  shapes: string[];
  zIndex: number;
  multiple?: boolean;
  launches?: number;
  launchDelay?: number;
}

export interface IConfettiTrigger {
  id: string;
  config: IConfettiConfig;
  trigger: 'immediate' | 'delayed' | 'user_action';
  delay: number;
  conditions: {
    formSubmitted: boolean;
    responseValid: boolean;
  };
  createdAt: Date;
}

export default ConfettiAnimationService;