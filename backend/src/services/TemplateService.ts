import Template from '../models/Template';
import { predefinedTemplates, templateCategories, popularTags } from '../data/formTemplates';
import { ITemplate } from '../types';

/**
 * Template Service
 * Manages template operations and seeding
 */
export class TemplateService {

  /**
   * Seed predefined templates into database
   * @returns Number of templates seeded
   */
  static async seedPredefinedTemplates(): Promise<number> {
    try {
      // Check if templates already exist
      const existingCount = await Template.countDocuments({ isTemplate: true, createdBy: null });
      if (existingCount > 0) {
        console.log(`${existingCount} predefined templates already exist, skipping seed`);
        return 0;
      }

      // Create all predefined templates
      const seededTemplates = await Template.insertMany(predefinedTemplates);
      console.log(`Successfully seeded ${seededTemplates.length} predefined templates`);
      
      return seededTemplates.length;
    } catch (error) {
      console.error('Error seeding predefined templates:', error);
      throw error;
    }
  }

  /**
   * Get all available template categories
   * @returns Array of template categories
   */
  static getTemplateCategories(): string[] {
    return templateCategories;
  }

  /**
   * Get popular template tags
   * @returns Array of popular tags
   */
  static getPopularTags(): string[] {
    return popularTags;
  }

  /**
   * Create template from existing form
   * @param formData - Form data to convert to template
   * @param userId - User ID creating the template
   * @param templateInfo - Additional template information
   * @returns Created template
   */
  static async createTemplateFromForm(
    formData: any,
    userId: string,
    templateInfo: {
      name: string;
      description: string;
      category: string;
      tags: string[];
      isPublic: boolean;
      isPremium: boolean;
    }
  ): Promise<any> {
    try {
      const template = await Template.create({
        ...templateInfo,
        fields: formData.fields,
        customization: formData.customization,
        settings: formData.settings,
        isTemplate: true,
        createdBy: userId,
        analytics: {
          views: 0,
          submissions: 0,
          ratings: [],
          averageRating: 0,
          totalRatings: 0
        }
      });

      return template;
    } catch (error) {
      console.error('Error creating template from form:', error);
      throw error;
    }
  }

  /**
   * Update template analytics
   * @param templateId - Template ID
   * @param analytics - Analytics data to update
   */
  static async updateTemplateAnalytics(
    templateId: string,
    analytics: {
      incrementViews?: boolean;
      incrementSubmissions?: boolean;
      addRating?: number;
    }
  ): Promise<void> {
    try {
      const updateData: any = {};

      if (analytics.incrementViews) {
        updateData.$inc = { ...updateData.$inc, 'analytics.views': 1 };
      }

      if (analytics.incrementSubmissions) {
        updateData.$inc = { ...updateData.$inc, 'analytics.submissions': 1 };
      }

      if (analytics.addRating !== undefined) {
        updateData.$push = { 'analytics.ratings': analytics.addRating };
      }

      if (Object.keys(updateData).length > 0) {
        await Template.findByIdAndUpdate(templateId, updateData);

        // Recalculate average rating if new rating was added
        if (analytics.addRating !== undefined) {
          await this.recalculateTemplateRating(templateId);
        }
      }
    } catch (error) {
      console.error('Error updating template analytics:', error);
      throw error;
    }
  }

  /**
   * Recalculate template average rating
   * @param templateId - Template ID
   */
  static async recalculateTemplateRating(templateId: string): Promise<void> {
    try {
      const template = await Template.findById(templateId);
      if (!template || !template.analytics.ratings.length) return;

      const totalRating = template.analytics.ratings.reduce((sum, rating) => sum + rating, 0);
      const averageRating = totalRating / template.analytics.ratings.length;

      await Template.findByIdAndUpdate(templateId, {
        'analytics.averageRating': Math.round(averageRating * 100) / 100,
        'analytics.totalRatings': template.analytics.ratings.length
      });
    } catch (error) {
      console.error('Error recalculating template rating:', error);
      throw error;
    }
  }

  /**
   * Get template statistics
   * @returns Template statistics
   */
  static async getTemplateStatistics(): Promise<{
    totalTemplates: number;
    publicTemplates: number;
    premiumTemplates: number;
    categoryCounts: Record<string, number>;
    averageRating: number;
    totalViews: number;
    totalSubmissions: number;
  }> {
    try {
      const [
        totalTemplates,
        publicTemplates,
        premiumTemplates,
        categoryStats,
        ratingStats,
        viewStats
      ] = await Promise.all([
        Template.countDocuments({ isTemplate: true }),
        Template.countDocuments({ isTemplate: true, isPublic: true }),
        Template.countDocuments({ isTemplate: true, isPremium: true }),
        Template.aggregate([
          { $match: { isTemplate: true } },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]),
        Template.aggregate([
          { $match: { isTemplate: true } },
          { $group: { 
            _id: null, 
            avgRating: { $avg: '$analytics.averageRating' },
            totalViews: { $sum: '$analytics.views' },
            totalSubmissions: { $sum: '$analytics.submissions' }
          }}
        ])
      ]);

      const categoryCounts: Record<string, number> = {};
      categoryStats.forEach((stat: any) => {
        categoryCounts[stat._id] = stat.count;
      });

      const stats = ratingStats[0] || { avgRating: 0, totalViews: 0, totalSubmissions: 0 };

      return {
        totalTemplates,
        publicTemplates,
        premiumTemplates,
        categoryCounts,
        averageRating: Math.round((stats.avgRating || 0) * 100) / 100,
        totalViews: stats.totalViews || 0,
        totalSubmissions: stats.totalSubmissions || 0
      };
    } catch (error) {
      console.error('Error getting template statistics:', error);
      throw error;
    }
  }

  /**
   * Search templates with advanced filters
   * @param filters - Search filters
   * @returns Search results
   */
  static async searchTemplates(filters: {
    query?: string;
    category?: string;
    tags?: string[];
    isPremium?: boolean;
    minRating?: number;
    sortBy?: 'popular' | 'newest' | 'rating' | 'name';
    page?: number;
    limit?: number;
  }): Promise<{
    templates: any[];
    pagination: {
      page: number;
      pages: number;
      total: number;
      limit: number;
    };
  }> {
    try {
      const {
        query,
        category,
        tags,
        isPremium,
        minRating,
        sortBy = 'popular',
        page = 1,
        limit = 12
      } = filters;

      // Build search query
      const searchQuery: any = { isTemplate: true, isPublic: true };

      if (query) {
        searchQuery.$or = [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ];
      }

      if (category) {
        searchQuery.category = category;
      }

      if (tags && tags.length > 0) {
        searchQuery.tags = { $in: tags };
      }

      if (isPremium !== undefined) {
        searchQuery.isPremium = isPremium;
      }

      if (minRating) {
        searchQuery['analytics.averageRating'] = { $gte: minRating };
      }

      // Build sort options
      const sortOptions: any = {};
      switch (sortBy) {
        case 'popular':
          sortOptions['analytics.views'] = -1;
          break;
        case 'newest':
          sortOptions.createdAt = -1;
          break;
        case 'rating':
          sortOptions['analytics.averageRating'] = -1;
          break;
        case 'name':
          sortOptions.name = 1;
          break;
        default:
          sortOptions['analytics.views'] = -1;
      }

      // Execute search with pagination
      const options = {
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        sort: sortOptions,
        select: 'name description category tags thumbnail isPublic isPremium analytics createdAt'
      };

      const result = await (Template as any).paginate(searchQuery, options);

      return {
        templates: result.docs,
        pagination: {
          page: result.page,
          pages: result.totalPages,
          total: result.totalDocs,
          limit: result.limit
        }
      };
    } catch (error) {
      console.error('Error searching templates:', error);
      throw error;
    }
  }

  /**
   * Get recommended templates based on user activity
   * @param userId - User ID
   * @param limit - Number of recommendations
   * @returns Recommended templates
   */
  static async getRecommendedTemplates(userId?: string, limit: number = 6): Promise<any[]> {
    try {
      // For now, return most popular templates
      // In the future, this could be enhanced with ML-based recommendations
      const templates = await Template.find({
        isTemplate: true,
        isPublic: true
      })
      .select('name description category tags thumbnail analytics')
      .sort({ 'analytics.views': -1, 'analytics.averageRating': -1 })
      .limit(limit);

      return templates;
    } catch (error) {
      console.error('Error getting recommended templates:', error);
      throw error;
    }
  }
}

export default TemplateService;