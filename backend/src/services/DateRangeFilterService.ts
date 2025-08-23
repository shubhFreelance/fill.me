/**
 * Date Range Filter Service
 * Handles flexible date range filtering for analytics, charts, and data queries
 */
export class DateRangeFilterService {

  /**
   * Parse and validate date range parameters
   * @param startDate - Start date string or Date object
   * @param endDate - End date string or Date object
   * @param preset - Preset range identifier
   * @returns Validated date range object
   */
  static parseDateRange(
    startDate?: string | Date,
    endDate?: string | Date,
    preset?: IDateRangePreset
  ): IDateRange {
    // If preset is provided, use it
    if (preset) {
      return this.getPresetDateRange(preset);
    }

    let start: Date;
    let end: Date;

    try {
      // Parse start date
      if (startDate) {
        start = typeof startDate === 'string' ? new Date(startDate) : startDate;
        if (isNaN(start.getTime())) {
          throw new Error('Invalid start date');
        }
      } else {
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
      }

      // Parse end date
      if (endDate) {
        end = typeof endDate === 'string' ? new Date(endDate) : endDate;
        if (isNaN(end.getTime())) {
          throw new Error('Invalid end date');
        }
      } else {
        end = new Date(); // Default: now
      }

      // Validate range
      if (start >= end) {
        throw new Error('Start date must be before end date');
      }

      // Ensure end date is not in the future
      const now = new Date();
      if (end > now) {
        end = now;
      }

      return { start, end };
    } catch (error) {
      // Return default range on error
      return {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
    }
  }

  /**
   * Get predefined date range based on preset
   * @param preset - Preset identifier
   * @returns Date range object
   */
  static getPresetDateRange(preset: IDateRangePreset): IDateRange {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case 'today':
        return {
          start: startOfToday,
          end: now
        };

      case 'yesterday':
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        return {
          start: yesterday,
          end: endOfYesterday
        };

      case 'last_7_days':
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now
        };

      case 'last_30_days':
        return {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now
        };

      case 'last_90_days':
        return {
          start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          end: now
        };

      case 'this_week':
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
        return {
          start: startOfWeek,
          end: now
        };

      case 'last_week':
        const lastWeekEnd = new Date(startOfToday);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay() - 1); // Last Saturday
        lastWeekEnd.setHours(23, 59, 59, 999);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 6);
        lastWeekStart.setHours(0, 0, 0, 0);
        return {
          start: lastWeekStart,
          end: lastWeekEnd
        };

      case 'this_month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          start: startOfMonth,
          end: now
        };

      case 'last_month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return {
          start: lastMonthStart,
          end: lastMonthEnd
        };

      case 'this_quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
        return {
          start: quarterStart,
          end: now
        };

      case 'last_quarter':
        const lastQuarter = Math.floor((now.getMonth() - 3) / 3);
        const lastQuarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const adjustedLastQuarter = lastQuarter < 0 ? 3 : lastQuarter;
        const lastQuarterStart = new Date(lastQuarterYear, adjustedLastQuarter * 3, 1);
        const lastQuarterEnd = new Date(lastQuarterYear, adjustedLastQuarter * 3 + 3, 0, 23, 59, 59, 999);
        return {
          start: lastQuarterStart,
          end: lastQuarterEnd
        };

      case 'this_year':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return {
          start: startOfYear,
          end: now
        };

      case 'last_year':
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        return {
          start: lastYearStart,
          end: lastYearEnd
        };

      case 'all_time':
        return {
          start: new Date('2020-01-01'), // Reasonable start date for the service
          end: now
        };

      default:
        return {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now
        };
    }
  }

  /**
   * Get available date range presets with metadata
   * @returns Array of preset configurations
   */
  static getAvailablePresets(): IDateRangePresetConfig[] {
    return [
      {
        id: 'today',
        label: 'Today',
        description: 'Data from today',
        category: 'recent'
      },
      {
        id: 'yesterday',
        label: 'Yesterday',
        description: 'Data from yesterday',
        category: 'recent'
      },
      {
        id: 'last_7_days',
        label: 'Last 7 days',
        description: 'Data from the past week',
        category: 'recent'
      },
      {
        id: 'last_30_days',
        label: 'Last 30 days',
        description: 'Data from the past month',
        category: 'recent'
      },
      {
        id: 'last_90_days',
        label: 'Last 90 days',
        description: 'Data from the past quarter',
        category: 'recent'
      },
      {
        id: 'this_week',
        label: 'This week',
        description: 'Data from this week (Sunday to now)',
        category: 'calendar'
      },
      {
        id: 'last_week',
        label: 'Last week',
        description: 'Data from last week (Sunday to Saturday)',
        category: 'calendar'
      },
      {
        id: 'this_month',
        label: 'This month',
        description: 'Data from this month',
        category: 'calendar'
      },
      {
        id: 'last_month',
        label: 'Last month',
        description: 'Data from last month',
        category: 'calendar'
      },
      {
        id: 'this_quarter',
        label: 'This quarter',
        description: 'Data from this quarter',
        category: 'calendar'
      },
      {
        id: 'last_quarter',
        label: 'Last quarter',
        description: 'Data from last quarter',
        category: 'calendar'
      },
      {
        id: 'this_year',
        label: 'This year',
        description: 'Data from this year',
        category: 'calendar'
      },
      {
        id: 'last_year',
        label: 'Last year',
        description: 'Data from last year',
        category: 'calendar'
      },
      {
        id: 'all_time',
        label: 'All time',
        description: 'All available data',
        category: 'extended'
      }
    ];
  }

  /**
   * Calculate date range duration in days
   * @param dateRange - Date range object
   * @returns Duration in days
   */
  static calculateDuration(dateRange: IDateRange): number {
    const diffTime = Math.abs(dateRange.end.getTime() - dateRange.start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Determine optimal time grouping based on date range
   * @param dateRange - Date range object
   * @returns Recommended time grouping
   */
  static getOptimalTimeGrouping(dateRange: IDateRange): ITimeGrouping {
    const duration = this.calculateDuration(dateRange);

    if (duration <= 1) {
      return 'hour';
    } else if (duration <= 31) {
      return 'day';
    } else if (duration <= 365) {
      return 'week';
    } else {
      return 'month';
    }
  }

  /**
   * Generate MongoDB date filter query
   * @param dateRange - Date range object
   * @param fieldName - Name of the date field
   * @returns MongoDB query object
   */
  static generateMongoDateFilter(dateRange: IDateRange, fieldName: string = 'createdAt'): Record<string, any> {
    return {
      [fieldName]: {
        $gte: dateRange.start,
        $lte: dateRange.end
      }
    };
  }

  /**
   * Validate and sanitize date range for security
   * @param dateRange - Date range to validate
   * @returns Validated and sanitized date range
   */
  static validateDateRange(dateRange: IDateRange): IValidatedDateRange {
    const now = new Date();
    const maxHistoricalDate = new Date('2020-01-01'); // Service inception date
    const maxFutureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day in future

    const errors: string[] = [];
    const warnings: string[] = [];

    let { start, end } = dateRange;

    // Validate start date
    if (start < maxHistoricalDate) {
      start = maxHistoricalDate;
      warnings.push('Start date adjusted to service inception date');
    }

    if (start > now) {
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      warnings.push('Start date cannot be in the future, adjusted to yesterday');
    }

    // Validate end date
    if (end > maxFutureDate) {
      end = now;
      warnings.push('End date adjusted to current time');
    }

    if (end < maxHistoricalDate) {
      end = now;
      errors.push('End date cannot be before service inception');
    }

    // Validate range duration
    const duration = this.calculateDuration({ start, end });
    const maxDurationDays = 1095; // 3 years

    if (duration > maxDurationDays) {
      start = new Date(end.getTime() - maxDurationDays * 24 * 60 * 60 * 1000);
      warnings.push(`Date range limited to ${maxDurationDays} days`);
    }

    if (duration < 0) {
      // Swap dates
      [start, end] = [end, start];
      warnings.push('Date range was reversed (start > end)');
    }

    return {
      dateRange: { start, end },
      isValid: errors.length === 0,
      errors,
      warnings,
      duration: this.calculateDuration({ start, end }),
      optimalGrouping: this.getOptimalTimeGrouping({ start, end })
    };
  }

  /**
   * Format date range for display
   * @param dateRange - Date range object
   * @param format - Display format
   * @returns Formatted date range string
   */
  static formatDateRange(
    dateRange: IDateRange,
    format: IDateRangeFormat = 'short'
  ): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: format === 'short' ? 'short' : 'long',
      day: 'numeric'
    };

    const startFormatted = dateRange.start.toLocaleDateString('en-US', options);
    const endFormatted = dateRange.end.toLocaleDateString('en-US', options);

    // Check if same day
    if (dateRange.start.toDateString() === dateRange.end.toDateString()) {
      return startFormatted;
    }

    // Check if same year
    if (dateRange.start.getFullYear() === dateRange.end.getFullYear()) {
      const startOptions = { ...options };
      delete startOptions.year;
      const startWithoutYear = dateRange.start.toLocaleDateString('en-US', startOptions);
      return `${startWithoutYear} - ${endFormatted}`;
    }

    return `${startFormatted} - ${endFormatted}`;
  }

  /**
   * Get comparison date range (previous period)
   * @param dateRange - Current date range
   * @returns Previous period date range
   */
  static getComparisonDateRange(dateRange: IDateRange): IDateRange {
    const duration = dateRange.end.getTime() - dateRange.start.getTime();
    
    return {
      start: new Date(dateRange.start.getTime() - duration),
      end: new Date(dateRange.start.getTime())
    };
  }

  /**
   * Split date range into smaller intervals
   * @param dateRange - Date range to split
   * @param intervalType - Type of interval
   * @returns Array of date intervals
   */
  static splitDateRange(
    dateRange: IDateRange,
    intervalType: ITimeGrouping
  ): IDateRange[] {
    const intervals: IDateRange[] = [];
    const current = new Date(dateRange.start);

    while (current < dateRange.end) {
      const intervalStart = new Date(current);
      let intervalEnd: Date;

      switch (intervalType) {
        case 'hour':
          intervalEnd = new Date(current.getTime() + 60 * 60 * 1000);
          current.setHours(current.getHours() + 1);
          break;
        case 'day':
          intervalEnd = new Date(current);
          intervalEnd.setDate(intervalEnd.getDate() + 1);
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          intervalEnd = new Date(current);
          intervalEnd.setDate(intervalEnd.getDate() + 7);
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          intervalEnd = new Date(current);
          intervalEnd.setMonth(intervalEnd.getMonth() + 1);
          current.setMonth(current.getMonth() + 1);
          break;
        default:
          intervalEnd = new Date(current);
          intervalEnd.setDate(intervalEnd.getDate() + 1);
          current.setDate(current.getDate() + 1);
      }

      // Don't exceed the original end date
      if (intervalEnd > dateRange.end) {
        intervalEnd = new Date(dateRange.end);
      }

      intervals.push({ start: intervalStart, end: intervalEnd });

      // Prevent infinite loop
      if (intervalEnd >= dateRange.end) {
        break;
      }
    }

    return intervals;
  }
}

// Type definitions
export type IDateRangePreset = 
  | 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'last_90_days'
  | 'this_week' | 'last_week' | 'this_month' | 'last_month'
  | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'all_time';

export type ITimeGrouping = 'hour' | 'day' | 'week' | 'month';
export type IDateRangeFormat = 'short' | 'long';

export interface IDateRange {
  start: Date;
  end: Date;
}

export interface IDateRangePresetConfig {
  id: IDateRangePreset;
  label: string;
  description: string;
  category: 'recent' | 'calendar' | 'extended';
}

export interface IValidatedDateRange {
  dateRange: IDateRange;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
  optimalGrouping: ITimeGrouping;
}

export default DateRangeFilterService;