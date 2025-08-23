import { body, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Validation error interface
interface ValidationError {
  field: string;
  message: string;
  value: any;
}

// Handle validation errors
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages: ValidationError[] = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: (error as any).value
    }));

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
    return;
  }
  
  next();
};

// User registration validation
export const validateSignup: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
];

// User login validation
export const validateLogin: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Form creation/update validation
export const validateForm: ValidationChain[] = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Form title is required')
    .isLength({ max: 200 })
    .withMessage('Form title cannot exceed 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Form description cannot exceed 1000 characters'),
  
  body('fields')
    .isArray({ min: 1 })
    .withMessage('Form must have at least one field'),
  
  body('fields.*.type')
    .isIn(['text', 'textarea', 'email', 'dropdown', 'radio', 'checkbox', 'date', 'file'])
    .withMessage('Invalid field type'),
  
  body('fields.*.label')
    .trim()
    .notEmpty()
    .withMessage('Field label is required')
    .isLength({ max: 200 })
    .withMessage('Field label cannot exceed 200 characters'),
  
  body('fields.*.required')
    .isBoolean()
    .withMessage('Field required property must be a boolean'),
  
  body('customization.primaryColor')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Primary color must be a valid hex color'),
  
  body('customization.fontFamily')
    .optional()
    .isIn(['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins'])
    .withMessage('Invalid font family'),
];

// Form response validation
export const validateFormResponse: ValidationChain[] = [
  body('responses')
    .isObject()
    .withMessage('Responses must be an object')
    .custom((value) => {
      if (Object.keys(value).length === 0) {
        throw new Error('Responses cannot be empty');
      }
      return true;
    }),
];

// File upload validation
export const validateFileUpload = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
    return;
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    res.status(400).json({
      success: false,
      message: 'Only image files (JPEG, PNG, GIF) are allowed'
    });
    return;
  }

  // Check file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (req.file.size > maxSize) {
    res.status(400).json({
      success: false,
      message: 'File size cannot exceed 5MB'
    });
    return;
  }

  next();
};

// Email validation helper
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

// Validation middleware with error handling
export const withValidation = (validations: ValidationChain[]) => {
  return [...validations, handleValidationErrors];
};

export default {
  validateSignup: withValidation(validateSignup),
  validateLogin: withValidation(validateLogin),
  validateForm: withValidation(validateForm),
  validateFormResponse: withValidation(validateFormResponse),
  validateFileUpload,
  handleValidationErrors,
  isValidEmail,
  withValidation
};