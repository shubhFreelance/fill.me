import { IForm, ILanguage, ILanguageSettings } from '../types';

/**
 * Multi-Language Service
 * Handles internationalization (i18n) for forms and application content
 */
export class MultiLanguageService {

  /**
   * Default supported languages
   */
  private static readonly DEFAULT_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' as const },
    { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr' as const },
    { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr' as const },
    { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr' as const },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr' as const },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr' as const },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr' as const },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr' as const },
    { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr' as const },
    { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr' as const },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' as const },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', direction: 'rtl' as const },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' as const },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', direction: 'ltr' as const },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr' as const },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr' as const },
    { code: 'sv', name: 'Swedish', nativeName: 'Svenska', direction: 'ltr' as const },
    { code: 'da', name: 'Danish', nativeName: 'Dansk', direction: 'ltr' as const },
    { code: 'no', name: 'Norwegian', nativeName: 'Norsk', direction: 'ltr' as const },
    { code: 'fi', name: 'Finnish', nativeName: 'Suomi', direction: 'ltr' as const }
  ];

  /**
   * Default form field translations
   */
  private static readonly DEFAULT_FORM_TRANSLATIONS = {
    en: {
      'form.submit': 'Submit',
      'form.reset': 'Reset',
      'form.next': 'Next',
      'form.previous': 'Previous',
      'form.required': 'This field is required',
      'form.optional': 'Optional',
      'form.select_option': 'Select an option',
      'form.select_multiple': 'Select multiple options',
      'form.file_upload': 'Upload file',
      'form.file_drag_drop': 'Drag and drop files here or click to browse',
      'form.file_size_limit': 'Maximum file size: {size}',
      'form.date_placeholder': 'Select date',
      'form.time_placeholder': 'Select time',
      'form.progress': 'Progress: {current} of {total}',
      'form.thank_you': 'Thank you for your submission!',
      'form.error': 'Please fix the errors below',
      'field.text.placeholder': 'Enter text',
      'field.email.placeholder': 'Enter your email',
      'field.phone.placeholder': 'Enter your phone number',
      'field.number.placeholder': 'Enter a number',
      'field.url.placeholder': 'Enter URL',
      'field.textarea.placeholder': 'Enter your message',
      'field.dropdown.placeholder': 'Choose an option',
      'field.radio.choose': 'Choose one option',
      'field.checkbox.select': 'Select all that apply',
      'field.rating.rate': 'Rate from {min} to {max}',
      'field.scale.rate': 'Rate on a scale from {min} to {max}',
      'validation.email': 'Please enter a valid email address',
      'validation.url': 'Please enter a valid URL',
      'validation.number': 'Please enter a valid number',
      'validation.phone': 'Please enter a valid phone number',
      'validation.min_length': 'Minimum {length} characters required',
      'validation.max_length': 'Maximum {length} characters allowed',
      'validation.file_type': 'File type not allowed',
      'validation.file_size': 'File size too large'
    },
    es: {
      'form.submit': 'Enviar',
      'form.reset': 'Reiniciar',
      'form.next': 'Siguiente',
      'form.previous': 'Anterior',
      'form.required': 'Este campo es obligatorio',
      'form.optional': 'Opcional',
      'form.select_option': 'Selecciona una opción',
      'form.select_multiple': 'Selecciona múltiples opciones',
      'form.file_upload': 'Subir archivo',
      'form.file_drag_drop': 'Arrastra y suelta archivos aquí o haz clic para explorar',
      'form.file_size_limit': 'Tamaño máximo de archivo: {size}',
      'form.date_placeholder': 'Seleccionar fecha',
      'form.time_placeholder': 'Seleccionar hora',
      'form.progress': 'Progreso: {current} de {total}',
      'form.thank_you': '¡Gracias por tu envío!',
      'form.error': 'Por favor, corrige los errores a continuación',
      'field.text.placeholder': 'Ingresa texto',
      'field.email.placeholder': 'Ingresa tu email',
      'field.phone.placeholder': 'Ingresa tu número de teléfono',
      'field.number.placeholder': 'Ingresa un número',
      'field.url.placeholder': 'Ingresa URL',
      'field.textarea.placeholder': 'Ingresa tu mensaje',
      'field.dropdown.placeholder': 'Elige una opción',
      'field.radio.choose': 'Elige una opción',
      'field.checkbox.select': 'Selecciona todas las que apliquen',
      'field.rating.rate': 'Califica de {min} a {max}',
      'field.scale.rate': 'Califica en una escala de {min} a {max}',
      'validation.email': 'Por favor ingresa una dirección de email válida',
      'validation.url': 'Por favor ingresa una URL válida',
      'validation.number': 'Por favor ingresa un número válido',
      'validation.phone': 'Por favor ingresa un número de teléfono válido',
      'validation.min_length': 'Se requieren mínimo {length} caracteres',
      'validation.max_length': 'Máximo {length} caracteres permitidos',
      'validation.file_type': 'Tipo de archivo no permitido',
      'validation.file_size': 'Tamaño de archivo demasiado grande'
    },
    fr: {
      'form.submit': 'Soumettre',
      'form.reset': 'Réinitialiser',
      'form.next': 'Suivant',
      'form.previous': 'Précédent',
      'form.required': 'Ce champ est obligatoire',
      'form.optional': 'Optionnel',
      'form.select_option': 'Sélectionnez une option',
      'form.select_multiple': 'Sélectionnez plusieurs options',
      'form.file_upload': 'Télécharger un fichier',
      'form.file_drag_drop': 'Glissez-déposez des fichiers ici ou cliquez pour parcourir',
      'form.file_size_limit': 'Taille maximale du fichier : {size}',
      'form.date_placeholder': 'Sélectionner une date',
      'form.time_placeholder': 'Sélectionner une heure',
      'form.progress': 'Progression : {current} sur {total}',
      'form.thank_you': 'Merci pour votre soumission !',
      'form.error': 'Veuillez corriger les erreurs ci-dessous',
      'field.text.placeholder': 'Entrez du texte',
      'field.email.placeholder': 'Entrez votre email',
      'field.phone.placeholder': 'Entrez votre numéro de téléphone',
      'field.number.placeholder': 'Entrez un nombre',
      'field.url.placeholder': 'Entrez une URL',
      'field.textarea.placeholder': 'Entrez votre message',
      'field.dropdown.placeholder': 'Choisissez une option',
      'field.radio.choose': 'Choisissez une option',
      'field.checkbox.select': 'Sélectionnez tout ce qui s\'applique',
      'field.rating.rate': 'Notez de {min} à {max}',
      'field.scale.rate': 'Notez sur une échelle de {min} à {max}',
      'validation.email': 'Veuillez entrer une adresse email valide',
      'validation.url': 'Veuillez entrer une URL valide',
      'validation.number': 'Veuillez entrer un nombre valide',
      'validation.phone': 'Veuillez entrer un numéro de téléphone valide',
      'validation.min_length': 'Minimum {length} caractères requis',
      'validation.max_length': 'Maximum {length} caractères autorisés',
      'validation.file_type': 'Type de fichier non autorisé',
      'validation.file_size': 'Taille de fichier trop importante'
    }
  };

  /**
   * Get list of supported languages
   * @returns Array of supported language objects
   */
  static getSupportedLanguages(): ILanguageInfo[] {
    return this.DEFAULT_LANGUAGES;
  }

  /**
   * Check if a language code is supported
   * @param languageCode - Language code to check
   * @returns Boolean indicating if language is supported
   */
  static isLanguageSupported(languageCode: string): boolean {
    return this.DEFAULT_LANGUAGES.some(lang => lang.code === languageCode);
  }

  /**
   * Get language information by code
   * @param languageCode - Language code
   * @returns Language information object or null
   */
  static getLanguageInfo(languageCode: string): ILanguageInfo | null {
    return this.DEFAULT_LANGUAGES.find(lang => lang.code === languageCode) || null;
  }

  /**
   * Initialize default language settings for a form
   * @param defaultLanguage - Default language code
   * @returns Default language settings
   */
  static initializeLanguageSettings(defaultLanguage: string = 'en'): ILanguageSettings {
    if (!this.isLanguageSupported(defaultLanguage)) {
      defaultLanguage = 'en';
    }

    const supportedLanguages: ILanguage[] = [{
      code: defaultLanguage,
      name: this.getLanguageInfo(defaultLanguage)?.name || 'English',
      translations: new Map(Object.entries(this.DEFAULT_FORM_TRANSLATIONS[defaultLanguage as keyof typeof this.DEFAULT_FORM_TRANSLATIONS] || this.DEFAULT_FORM_TRANSLATIONS.en))
    }];

    return {
      default: defaultLanguage,
      supported: supportedLanguages,
      autoDetect: true,
      fallbackLanguage: 'en',
      allowUserSelection: true
    };
  }

  /**
   * Add language support to a form
   * @param currentSettings - Current language settings
   * @param languageCode - Language code to add
   * @param customTranslations - Optional custom translations
   * @returns Updated language settings
   */
  static addLanguageSupport(
    currentSettings: ILanguageSettings,
    languageCode: string,
    customTranslations?: Record<string, string>
  ): ILanguageSettings {
    if (!this.isLanguageSupported(languageCode)) {
      throw new Error(`Language code "${languageCode}" is not supported`);
    }

    // Check if language is already supported
    if (currentSettings.supported.some(lang => lang.code === languageCode)) {
      throw new Error(`Language "${languageCode}" is already supported`);
    }

    const languageInfo = this.getLanguageInfo(languageCode)!;
    const defaultTranslations = this.DEFAULT_FORM_TRANSLATIONS[languageCode as keyof typeof this.DEFAULT_FORM_TRANSLATIONS] || this.DEFAULT_FORM_TRANSLATIONS.en;
    
    const finalTranslations = {
      ...defaultTranslations,
      ...customTranslations
    };

    const newLanguage: ILanguage = {
      code: languageCode,
      name: languageInfo.name,
      translations: new Map(Object.entries(finalTranslations))
    };

    return {
      ...currentSettings,
      supported: [...currentSettings.supported, newLanguage]
    };
  }

  /**
   * Remove language support from a form
   * @param currentSettings - Current language settings
   * @param languageCode - Language code to remove
   * @returns Updated language settings
   */
  static removeLanguageSupport(
    currentSettings: ILanguageSettings,
    languageCode: string
  ): ILanguageSettings {
    if (currentSettings.default === languageCode) {
      throw new Error('Cannot remove the default language');
    }

    return {
      ...currentSettings,
      supported: currentSettings.supported.filter(lang => lang.code !== languageCode)
    };
  }

  /**
   * Update translations for a specific language
   * @param currentSettings - Current language settings
   * @param languageCode - Language code to update
   * @param translations - New translations
   * @returns Updated language settings
   */
  static updateTranslations(
    currentSettings: ILanguageSettings,
    languageCode: string,
    translations: Record<string, string>
  ): ILanguageSettings {
    const updatedSupported = currentSettings.supported.map(lang => {
      if (lang.code === languageCode) {
        return {
          ...lang,
          translations: new Map([...lang.translations.entries(), ...Object.entries(translations)])
        };
      }
      return lang;
    });

    return {
      ...currentSettings,
      supported: updatedSupported
    };
  }

  /**
   * Get translations for a specific language
   * @param languageSettings - Language settings
   * @param languageCode - Language code
   * @returns Translations object or null
   */
  static getTranslations(
    languageSettings: ILanguageSettings,
    languageCode: string
  ): Record<string, string> | null {
    const language = languageSettings.supported.find(lang => lang.code === languageCode);
    if (!language) return null;

    return Object.fromEntries(language.translations.entries());
  }

  /**
   * Translate a key for a specific language
   * @param languageSettings - Language settings
   * @param languageCode - Language code
   * @param key - Translation key
   * @param variables - Variables for interpolation
   * @returns Translated string
   */
  static translate(
    languageSettings: ILanguageSettings,
    languageCode: string,
    key: string,
    variables?: Record<string, string | number>
  ): string {
    const language = languageSettings.supported.find(lang => lang.code === languageCode);
    
    let translation: string;
    
    if (language && language.translations.has(key)) {
      translation = language.translations.get(key)!;
    } else {
      // Fallback to default language
      const fallbackLang = languageSettings.supported.find(lang => lang.code === languageSettings.fallbackLanguage);
      if (fallbackLang && fallbackLang.translations.has(key)) {
        translation = fallbackLang.translations.get(key)!;
      } else {
        // Return key as fallback
        translation = key;
      }
    }

    // Interpolate variables
    if (variables) {
      Object.entries(variables).forEach(([variable, value]) => {
        translation = translation.replace(new RegExp(`{${variable}}`, 'g'), String(value));
      });
    }

    return translation;
  }

  /**
   * Localize form content for a specific language
   * @param form - Form configuration
   * @param languageCode - Target language code
   * @returns Localized form content
   */
  static localizeForm(form: IForm, languageCode: string): ILocalizedForm {
    if (!form.languages || !form.languages.supported.find(lang => lang.code === languageCode)) {
      // Return form in default language
      return {
        ...form,
        currentLanguage: form.languages?.default || 'en',
        localizedFields: form.fields
      };
    }

    const translations = this.getTranslations(form.languages, languageCode);
    if (!translations) {
      return {
        ...form,
        currentLanguage: form.languages.default,
        localizedFields: form.fields
      };
    }

    // Localize form fields
    const localizedFields = form.fields.map(field => ({
      ...field,
      label: translations[`field.${field.id}.label`] || field.label,
      placeholder: translations[`field.${field.id}.placeholder`] || field.placeholder,
      options: field.options?.map((option, index) => 
        translations[`field.${field.id}.option.${index}`] || option
      )
    }));

    return {
      ...form,
      title: translations['form.title'] || form.title,
      description: translations['form.description'] || form.description,
      currentLanguage: languageCode,
      localizedFields
    };
  }

  /**
   * Generate translation keys for a form
   * @param form - Form configuration
   * @returns Array of translation keys
   */
  static generateTranslationKeys(form: IForm): string[] {
    const keys: string[] = [
      'form.title',
      'form.description'
    ];

    form.fields.forEach(field => {
      keys.push(`field.${field.id}.label`);
      if (field.placeholder) {
        keys.push(`field.${field.id}.placeholder`);
      }
      if (field.options) {
        field.options.forEach((_, index) => {
          keys.push(`field.${field.id}.option.${index}`);
        });
      }
    });

    return keys;
  }

  /**
   * Validate language settings
   * @param settings - Language settings to validate
   * @returns Validation result
   */
  static validateLanguageSettings(settings: ILanguageSettings): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if default language is supported
    if (!settings.supported.find(lang => lang.code === settings.default)) {
      errors.push('Default language must be included in supported languages');
    }

    // Check if fallback language is supported
    if (settings.fallbackLanguage && !settings.supported.find(lang => lang.code === settings.fallbackLanguage)) {
      warnings.push('Fallback language is not in supported languages list');
    }

    // Validate language codes
    settings.supported.forEach(lang => {
      if (!this.isLanguageSupported(lang.code)) {
        warnings.push(`Language code "${lang.code}" is not in the list of supported languages`);
      }
    });

    // Check for duplicate language codes
    const codes = settings.supported.map(lang => lang.code);
    const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate language codes found: ${duplicates.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Auto-detect user language from browser
   * @param acceptLanguageHeader - Accept-Language header from request
   * @param supportedLanguages - List of supported language codes
   * @returns Best matching language code
   */
  static detectUserLanguage(
    acceptLanguageHeader: string,
    supportedLanguages: string[]
  ): string {
    if (!acceptLanguageHeader) {
      return supportedLanguages[0] || 'en';
    }

    // Parse Accept-Language header
    const languages = acceptLanguageHeader
      .split(',')
      .map(lang => {
        const [code, quality = '1'] = lang.trim().split(';q=');
        return {
          code: code.toLowerCase().split('-')[0], // Get main language code
          quality: parseFloat(quality)
        };
      })
      .sort((a, b) => b.quality - a.quality);

    // Find first supported language
    for (const lang of languages) {
      if (supportedLanguages.includes(lang.code)) {
        return lang.code;
      }
    }

    return supportedLanguages[0] || 'en';
  }

  /**
   * Export translations to various formats
   * @param languageSettings - Language settings
   * @param format - Export format
   * @returns Exported translations
   */
  static exportTranslations(
    languageSettings: ILanguageSettings,
    format: 'json' | 'csv' | 'xlsx'
  ): string | object {
    const allTranslations: Record<string, Record<string, string>> = {};

    languageSettings.supported.forEach(language => {
      allTranslations[language.code] = Object.fromEntries(language.translations.entries());
    });

    switch (format) {
      case 'json':
        return JSON.stringify(allTranslations, null, 2);
        
      case 'csv':
        const keys = new Set<string>();
        Object.values(allTranslations).forEach(translations => {
          Object.keys(translations).forEach(key => keys.add(key));
        });

        const csvHeader = ['Key', ...languageSettings.supported.map(lang => lang.name)];
        const csvRows = Array.from(keys).map(key => [
          key,
          ...languageSettings.supported.map(lang => allTranslations[lang.code][key] || '')
        ]);

        return [csvHeader, ...csvRows]
          .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
          .join('\n');
          
      default:
        return allTranslations;
    }
  }
}

// Additional interfaces for multi-language support
export interface ILanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

export interface ILocalizedForm {
  _id?: any;
  title: string;
  description?: string;
  fields: any[];
  customization: any;
  isPublic: boolean;
  isActive: boolean;
  userId: any;
  analytics: any;
  publicUrl: string;
  embedCode?: string;
  templateId?: any;
  workspaceId?: any;
  settings: any;
  thankYouPage: any;
  payment: any;
  languages: any;
  seo: any;
  currentLanguage: string;
  localizedFields: any[];
}

export default MultiLanguageService;