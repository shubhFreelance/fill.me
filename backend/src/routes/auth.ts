import express, { Response } from 'express';
import User from '../models/User';
import { protect, sendTokenResponse, AuthenticatedRequest } from '../middleware/auth';
import { validateSignup, validateLogin, handleValidationErrors } from '../middleware/validation';
import { authRateLimit, passwordResetRateLimit } from '../middleware/rateLimiting';
import { IUser } from '../types';

const router = express.Router();



/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authRateLimit, ...validateSignup, handleValidationErrors, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
 * @route   POST /api/auth/signup
 * @desc    Register a new user (alias for /register)
 * @access  Public
 */
router.post('/signup', authRateLimit, ...validateSignup, handleValidationErrors, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
router.post('/login', authRateLimit, ...validateLogin, handleValidationErrors, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password }: { email: string; password: string } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password') as any;
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
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
        message: 'Invalid credentials'
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
    const user = await User.findById(req.user!._id).populate('formCount') as any;
    
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
 * @route   GET /api/auth/profile
 * @desc    Get current user profile (alias for /me)
 * @access  Private
 */
router.get('/profile', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id).populate('formCount') as any;
    
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
    const { firstName, lastName, email, profile, preferences }: {
      firstName?: string;
      lastName?: string;
      email?: string;
      profile?: any;
      preferences?: any;
    } = req.body;
    
    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          message: 'Please provide a valid email'
        });
        return;
      }
      
      // Check if email is already taken
      const existingUser = await User.findOne({ email, _id: { $ne: req.user!._id } });
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
        return;
      }
    }
    
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName?.trim();
    if (lastName !== undefined) updateData.lastName = lastName?.trim();
    if (email !== undefined) updateData.email = email;
    if (profile !== undefined) {
      updateData.profile = {
        ...updateData.profile,
        ...profile
      };
    }
    if (preferences !== undefined) {
      updateData.preferences = {
        ...updateData.preferences,
        ...preferences
      };
    }
    
    // Ignore password updates - should use change-password endpoint
    if (req.body.password) {
      delete req.body.password;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user!._id,
      updateData,
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
 * @route   POST /api/auth/forgot-password
 * @desc    Forgot password - send reset email
 * @access  Public
 */
router.post('/forgot-password', passwordResetRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email }: { email: string } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email'
      });
      return;
    }

    const user = await User.findOne({ email }) as any;
    
    if (user) {
      // Generate reset token
      const resetToken = require('crypto').randomBytes(20).toString('hex');
      
      // Hash token and set to resetPasswordToken field
      const crypto = require('crypto');
      user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // Set expire
      user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await user.save();
      
      // In a real application, you would send an email here
      // For testing purposes, we just return success
    }

    // Always return success for security (don't reveal if email exists)
    res.status(200).json({
      success: true,
      message: 'Password reset email sent'
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', passwordResetRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, password }: { token: string; password: string } = req.body;

    if (!token || !password) {
      res.status(400).json({
        success: false,
        message: 'Token and password are required'
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
      return;
    }

    // Get hashed token
    const crypto = require('crypto');
    const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    }) as any;

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
      return;
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
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