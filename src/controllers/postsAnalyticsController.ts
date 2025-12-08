import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import * as analyticsService from '../services/postsAnalyticsService';

/**
 * Get aggregate analytics across all posts
 */
export async function getAggregateAnalytics(req: AuthRequest, res: Response): Promise<Response> {
	try {
		const analytics = await analyticsService.getAggregateAnalytics();
		return res.json({ analytics });
	} catch (error) {
		throw error;
	}
}

