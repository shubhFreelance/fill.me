import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { IUser } from '../types';
import User from '../models/User';

// Extend Express Request to include user
export interface AuthenticatedRequest extends Request {
  user?: IUser;
  query: any;
  params: any;
  body: any;
}

// JWT payload interface
interface JwtPayload {
  id?: string;
  userId?: string;
  iat: number;
  exp: number;
}

// Protect routes - require authentication
export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  let token: string | undefined;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      // Get user from token
      const userId = decoded.id || decoded.userId;
      const user = await User.findById(userId).select('-password');

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      if (!user.isActive) {
        res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
        return;
      }

      req.user = user as IUser;
      next();
    } catch (error: any) {
      console.error('Auth middleware error:', error);
      
      let message = 'Not authorized to access this route';
      
      if (error.name === 'JsonWebTokenError') {
        message = 'Invalid token';
      } else if (error.name === 'TokenExpiredError') {
        message = 'Token expired';
      }

      res.status(401).json({
        success: false,
        message
      });
      return;
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'No token provided'
    });
    return;
  }
};

// Optional authentication - don't require token but decode if present
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      const userId = decoded.id || decoded.userId;
      const user = await User.findById(userId).select('-password');
      req.user = user as IUser;
    } catch (error) {
      // Continue without user if token is invalid
      req.user = undefined;
    }
  }

  next();
};

// Generate JWT token
export const generateToken = (id: string): string => {
  return jwt.sign({ id, userId: id }, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  });
};

// Cookie options interface
interface CookieOptions {
  expires: Date;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'none' | 'lax' | 'strict';
}

// Send token response
export const sendTokenResponse = (
  user: IUser,
  statusCode: number,
  res: Response,
  message: string = 'Success'
): void => {
  // Create token
  const token = generateToken(user._id.toString());

  // Create secure cookie with token
  const cookieOptions: CookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      message,
      token,
      user: (user as any).getPublicProfile()
    });
};

export default {
  protect,
  optionalAuth,
  generateToken,
  sendTokenResponse
};