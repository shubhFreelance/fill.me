import { Request, Response, NextFunction } from 'express';

// Custom error interface
interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  errors?: { [key: string]: { message: string } };
}

// Error response interface
interface ErrorResponse {
  success: boolean;
  message: string | string[];
  stack?: string;
}

const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error: CustomError = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { name: 'CastError', message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { name: 'DuplicateError', message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {}).map(val => val.message);
    error = { name: 'ValidationError', message: message.join(', '), statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { name: 'JsonWebTokenError', message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { name: 'TokenExpiredError', message, statusCode: 401 };
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size too large';
    error = { name: 'MulterError', message, statusCode: 400 };
  }

  const response: ErrorResponse = {
    success: false,
    message: error.message || 'Server Error',
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(error.statusCode || 500).json(response);
};

export default errorHandler;