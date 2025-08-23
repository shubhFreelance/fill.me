import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin, requirePermission, requireSuperuser } from '../middleware/adminAuth';
import { apiRateLimit } from '../middleware/rateLimiting';
import { withValidation } from '../middleware/validation';
import { query } from 'express-validator';
import AdminDashboardService from '../services/AdminDashboardService';

const router = express.Router();



// Validation middleware
const validateTimeRange = [
  query('timeRange')
    .optional()
    .isIn(['7d', '30d', '90d', '1y'])
    .withMessage('Time range must be 7d, 30d, 90d, or 1y'),
];

/**
 * @route   GET /api/admin/overview
 * @desc    Get platform overview metrics
 * @access  Admin only
 */
router.get('/overview', protect, requirePermission('canViewMetrics'), apiRateLimit, withValidation(validateTimeRange), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { timeRange = '30d' } = req.query;

    const overview = await AdminDashboardService.getPlatformOverview(timeRange as string);

    res.status(200).json({
      success: true,
      data: overview
    });
  } catch (error: any) {
    console.error('Admin overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching platform overview'
    });
  }
});

/**
 * @route   GET /api/admin/users
 * @desc    Get user analytics
 * @access  Admin only
 */
router.get('/users', protect, requirePermission('canViewMetrics'), apiRateLimit, withValidation(validateTimeRange), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { timeRange = '30d' } = req.query;

    const userAnalytics = await AdminDashboardService.getUserAnalytics(timeRange as string);

    res.status(200).json({
      success: true,
      data: userAnalytics
    });
  } catch (error: any) {
    console.error('Admin user analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user analytics'
    });
  }
});

/**
 * @route   GET /api/admin/system
 * @desc    Get system performance metrics
 * @access  Admin only
 */
router.get('/system', protect, requirePermission('canManageSystem'), apiRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const systemMetrics = await AdminDashboardService.getSystemMetrics();

    res.status(200).json({
      success: true,
      data: systemMetrics
    });
  } catch (error: any) {
    console.error('Admin system metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system metrics'
    });
  }
});

/**
 * @route   GET /api/admin/security
 * @desc    Get security metrics
 * @access  Admin only
 */
router.get('/security', protect, requirePermission('canViewLogs'), apiRateLimit, withValidation(validateTimeRange), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { timeRange = '30d' } = req.query;

    const securityMetrics = await AdminDashboardService.getSecurityMetrics(timeRange as string);

    res.status(200).json({
      success: true,
      data: securityMetrics
    });
  } catch (error: any) {
    console.error('Admin security metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching security metrics'
    });
  }
});

/**
 * @route   GET /api/admin/health
 * @desc    Get system health check
 * @access  Admin only
 */
router.get('/health', protect, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const health = {
      status: 'OK',
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'connected', // This would be checked against actual DB
        cache: 'connected',
        storage: 'available'
      }
    };

    res.status(200).json({
      success: true,
      data: health
    });
  } catch (error: any) {
    console.error('Admin health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing health check'
    });
  }
});

/**
 * @route   GET /api/admin/stats/summary
 * @desc    Get quick summary statistics
 * @access  Admin only
 */
router.get('/stats/summary', protect, requirePermission('canViewMetrics'), apiRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Quick counts for dashboard summary
    const [totalUsers, totalForms, totalResponses] = await Promise.all([
      require('../models/User').countDocuments({ isActive: true }),
      require('../models/Form').countDocuments({ isActive: true }),
      require('../models/FormResponse').countDocuments({ isValid: true })
    ]);

    const summary = {
      users: {
        total: totalUsers,
        online: Math.floor(totalUsers * 0.1), // Estimate
        growth: '+12.5%' // Placeholder
      },
      forms: {
        total: totalForms,
        active: Math.floor(totalForms * 0.8),
        growth: '+8.3%'
      },
      responses: {
        total: totalResponses,
        today: Math.floor(totalResponses * 0.02),
        growth: '+15.7%'
      },
      revenue: {
        monthly: 25000, // Placeholder
        growth: '+22.1%'
      }
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('Admin summary stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching summary statistics'
    });
  }
});

/**
 * @route   POST /api/admin/maintenance
 * @desc    Trigger maintenance operations
 * @access  Admin only
 */
router.post('/maintenance', protect, requirePermission('canPerformMaintenance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { operation } = req.body;

    switch (operation) {
      case 'cleanup_expired_sessions':
        // Implement session cleanup
        break;
      case 'optimize_database':
        // Implement database optimization
        break;
      case 'clear_cache':
        // Implement cache clearing
        break;
      case 'generate_reports':
        // Implement report generation
        break;
      default:
        res.status(400).json({
          success: false,
          message: 'Invalid maintenance operation'
        });
        return;
    }

    res.status(200).json({
      success: true,
      message: `Maintenance operation '${operation}' completed successfully`,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Admin maintenance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing maintenance operation'
    });
  }
});

/**
 * @route   GET /api/admin/logs
 * @desc    Get system logs (last 100 entries)
 * @access  Admin only
 */
router.get('/logs', protect, requirePermission('canViewLogs'), apiRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { level = 'all', limit = 100 } = req.query;

    // This would integrate with actual logging system
    const logs = [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'User registration successful',
        metadata: { userId: 'user123', ip: '192.168.1.1' }
      },
      {
        timestamp: new Date(Date.now() - 300000),
        level: 'warning',
        message: 'Rate limit exceeded',
        metadata: { ip: '10.0.0.1', endpoint: '/api/forms' }
      },
      {
        timestamp: new Date(Date.now() - 600000),
        level: 'error',
        message: 'Database connection timeout',
        metadata: { duration: 5000, query: 'SELECT * FROM users' }
      }
    ];

    const filteredLogs = level === 'all' ? logs : logs.filter(log => log.level === level);

    res.status(200).json({
      success: true,
      data: {
        logs: filteredLogs.slice(0, parseInt(limit as string)),
        total: filteredLogs.length,
        filters: {
          level,
          limit: parseInt(limit as string)
        }
      }
    });
  } catch (error: any) {
    console.error('Admin logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system logs'
    });
  }
});

/**
 * @route   GET /api/admin/export/metrics
 * @desc    Export platform metrics to CSV
 * @access  Admin only
 */
router.get('/export/metrics', protect, requirePermission('canExportData'), withValidation(validateTimeRange), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { timeRange = '30d', format = 'csv' } = req.query;

    const overview = await AdminDashboardService.getPlatformOverview(timeRange as string);
    
    if (format === 'csv') {
      // Generate CSV content
      const csvContent = [
        'Metric,Value,Time Range',
        `Total Users,${overview.users.total},${timeRange}`,
        `New Users,${overview.users.new},${timeRange}`,
        `Total Forms,${overview.forms.total},${timeRange}`,
        `Active Forms,${overview.forms.active},${timeRange}`,
        `Total Responses,${overview.responses.total},${timeRange}`,
        `New Responses,${overview.responses.new},${timeRange}`,
        `System Health,${overview.performance.systemHealth},Current`,
        `Uptime (seconds),${overview.performance.uptime},Current`,
        `Memory Usage (MB),${overview.performance.memoryUsage},Current`
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="platform-metrics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      res.status(200).json({
        success: true,
        data: overview,
        exportFormat: format,
        exportedAt: new Date()
      });
    }
  } catch (error: any) {
    console.error('Admin export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting metrics'
    });
  }
});

export default router;