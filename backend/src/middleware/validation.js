const { body, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

// User registration validation
const validateSignup = [
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
  
  handleValidationErrors
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Form creation/update validation
const validateForm = [
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
  
  handleValidationErrors
];

// Form response validation
const validateFormResponse = [
  body('responses')
    .isObject()
    .withMessage('Responses must be an object')
    .custom((value) => {
      if (Object.keys(value).length === 0) {
        throw new Error('Responses cannot be empty');
      }
      return true;
    }),
  
  handleValidationErrors
];

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Only image files (JPEG, PNG, GIF) are allowed'
    });
  }

  // Check file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'File size cannot exceed 5MB'
    });
  }

  next();
};

// Email validation helper
const isValidEmail = (email) => {
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

module.exports = {
  validateSignup,
  validateLogin,
  validateForm,
  validateFormResponse,
  validateFileUpload,
  handleValidationErrors,
  isValidEmail
};