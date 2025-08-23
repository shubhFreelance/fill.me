import express, { Response } from 'express';
import rateLimit from 'express-rate-limit';
import User from '../models/User';
import { protect, sendTokenResponse, AuthenticatedRequest } from '../middleware/auth';
import { validateSignup, validateLogin, withValidation } from '../middleware/validation';
import { IUser } from '../types';

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth routes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', authLimiter, validateSignup, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName }: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName
    }) as IUser;

    // Update last login
    await (user as any).updateLastLogin();

    sendTokenResponse(user, 201, res, 'User registered successfully');
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user account'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authLimiter, validateLogin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password }: { email: string; password: string } = req.body;

    // Find user and include password for comparison
    const user = await User.findByEmail(email).select('+password') as IUser & { matchPassword: (password: string) => Promise<boolean>; updateLastLogin: () => Promise<void> };
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
      return;
    }

    // Check password
    const isValidPassword = await user.matchPassword(password);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Update last login
    await user.updateLastLogin();

    sendTokenResponse(user, 200, res, 'Login successful');
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in user'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id).populate('formCount') as IUser & { getPublicProfile: () => any };
    
    res.status(200).json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName }: { firstName?: string; lastName?: string } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user!._id,
      {
        firstName: firstName?.trim(),
        lastName: lastName?.trim()
      },
      {
        new: true,
        runValidators: true
      }
    ) as IUser & { getPublicProfile: () => any };

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser.getPublicProfile()
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (clear cookie)
 * @access  Private
 */
router.post('/logout', protect, (req: AuthenticatedRequest, res: Response): void => {
  res.cookie('token', '', {
    expires: new Date(0),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword }: { currentPassword: string; newPassword: string } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
      return;
    }

    // Get user with password
    const user = await User.findById(req.user!._id).select('+password') as IUser & { 
      matchPassword: (password: string) => Promise<boolean>;
      save: () => Promise<IUser>;
      password: string;
    };
    
    // Check current password
    const isValidPassword = await user.matchPassword(currentPassword);
    if (!isValidPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
      return;
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
});

/**
 * @route   DELETE /api/auth/account
 * @desc    Deactivate user account
 * @access  Private
 */
router.delete('/account', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(
      req.user!._id,
      { isActive: false },
      { new: true }
    );

    res.cookie('token', '', {
      expires: new Date(0),
      httpOnly: true
    });

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error: any) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating account'
    });
  }
});

export default router;