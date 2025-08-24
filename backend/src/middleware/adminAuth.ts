import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

/**
 * Admin Authorization Middleware
 * Provides consistent admin access control across the application
 */

// Admin role levels
export enum AdminRole {
  SUPERUSER = 'superuser',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

// Admin permissions
export interface AdminPermissions {
  canViewMetrics: boolean;
  canManageUsers: boolean;
  canManageForms: boolean;
  canViewLogs: boolean;
  canPerformMaintenance: boolean;
  canExportData: boolean;
  canManageSystem: boolean;
}

/**
 * Check if user has admin role
 * @param req - Authenticated request
 * @returns Boolean indicating admin status
 */
export const isAdmin = (req: AuthenticatedRequest): boolean => {
  const user = req.user;
  if (!user) return false;

  // Check for admin roles
  const adminRoles = ['superuser', 'admin', 'moderator', 'super_admin'];
  if (adminRoles.includes(user.role)) {
    return true;
  }

  // Check for admin email (environment variable)
  if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
    return true;
  }

  // Check for superuser email list
  const superuserEmails = process.env.SUPERUSER_EMAILS?.split(',') || [];
  if (superuserEmails.includes(user.email)) {
    return true;
  }

  return false;
};

/**
 * Get user's admin permissions based on role
 * @param req - Authenticated request
 * @returns Admin permissions object
 */
export const getAdminPermissions = (req: AuthenticatedRequest): AdminPermissions => {
  const user = req.user;
  if (!user || !isAdmin(req)) {
    return {
      canViewMetrics: false,
      canManageUsers: false,
      canManageForms: false,
      canViewLogs: false,
      canPerformMaintenance: false,
      canExportData: false,
      canManageSystem: false
    };
  }

  const role = user.role;

  switch (role) {
    case 'super_admin':
      return {
        canViewMetrics: true,
        canManageUsers: true,
        canManageForms: true,
        canViewLogs: true,
        canPerformMaintenance: true,
        canExportData: true,
        canManageSystem: true
      };

    case 'admin':
      return {
        canViewMetrics: true,
        canManageUsers: true,
        canManageForms: true,
        canViewLogs: true,
        canPerformMaintenance: false,
        canExportData: true,
        canManageSystem: false
      };

    default:
      // Check if user is in superuser email list
      const superuserEmails = process.env.SUPERUSER_EMAILS?.split(',') || [];
      if (superuserEmails.includes(user.email)) {
        return {
          canViewMetrics: true,
          canManageUsers: true,
          canManageForms: true,
          canViewLogs: true,
          canPerformMaintenance: true,
          canExportData: true,
          canManageSystem: true
        };
      }

      return {
        canViewMetrics: false,
        canManageUsers: false,
        canManageForms: false,
        canViewLogs: false,
        canPerformMaintenance: false,
        canExportData: false,
        canManageSystem: false
      };
  }
};

/**
 * Basic admin authentication middleware
 * Checks if user has any admin privileges
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    if (!isAdmin(req)) {
      res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED'
      });
      return;
    }

    // Attach permissions to request for use in routes
    (req as any).adminPermissions = getAdminPermissions(req);

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Create permission-specific middleware
 * @param permission - Required permission
 * @returns Middleware function
 */
export const requirePermission = (
  permission: keyof AdminPermissions
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      const permissions = getAdminPermissions(req);
      
      if (!permissions[permission]) {
        res.status(403).json({
          success: false,
          message: `Permission '${permission}' required`,
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredPermission: permission
        });
        return;
      }

      // Attach permissions to request
      (req as any).adminPermissions = permissions;

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check error',
        code: 'PERMISSION_ERROR'
      });
    }
  };
};

/**
 * Superuser only middleware
 * Restricts access to superuser level only
 */
export const requireSuperuser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const user = req.user;
    const isSuperuser = user.role === 'super_admin' ||
                       user.email === process.env.ADMIN_EMAIL ||
                       (process.env.SUPERUSER_EMAILS?.split(',') || []).includes(user.email);

    if (!isSuperuser) {
      res.status(403).json({
        success: false,
        message: 'Superuser access required',
        code: 'SUPERUSER_ACCESS_REQUIRED'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Superuser middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Superuser check error',
      code: 'SUPERUSER_ERROR'
    });
  }
};

/**
 * Get admin info for authenticated user
 * @param req - Authenticated request
 * @returns Admin info object
 */
export const getAdminInfo = (req: AuthenticatedRequest) => {
  const user = req.user;
  if (!user) return null;

  return {
    isAdmin: isAdmin(req),
    role: user.role,
    permissions: getAdminPermissions(req),
    canAccess: {
      dashboard: isAdmin(req),
      userManagement: getAdminPermissions(req).canManageUsers,
      systemLogs: getAdminPermissions(req).canViewLogs,
      maintenance: getAdminPermissions(req).canPerformMaintenance
    }
  };
};

export default {
  isAdmin,
  getAdminPermissions,
  requireAdmin,
  requirePermission,
  requireSuperuser,
  getAdminInfo,
  AdminRole
};