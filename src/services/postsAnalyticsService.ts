import { prisma } from '../lib/prisma';

export interface AggregateAnalytics {
	totalPosts: number;
	totalPublishedPosts: number;
	totalViews: number;
	totalLikes: number;
	totalComments: number;
	totalSaves: number;
	averageViewsPerPost: number;
	averageLikesPerPost: number;
	averageCommentsPerPost: number;
	topPosts: Array<{
		postId: string;
		title: string;
		slug: string;
		views: number;
		likes: number;
		comments: number;
		saves: number;
	}>;
}

/**
 * Get aggregate analytics across all posts
 */
export async function getAggregateAnalytics(): Promise<AggregateAnalytics> {
	// Get aggregate counts
	const [
		totalPosts,
		totalPublishedPosts,
		totalLikes,
		totalComments,
		totalSaves,
		postsWithViews,
	] = await Promise.all([
		prisma.post.count(),
		prisma.post.count({
			where: { published: true },
		}),
		prisma.postLike.count(),
		prisma.comment.count({
			where: { deletedAt: null },
		}),
		prisma.savedPost.count(),
		prisma.post.aggregate({
			where: { published: true },
			_sum: {
				viewCount: true,
			},
		}),
	]);

	const totalViews = postsWithViews._sum.viewCount || 0;

	// Get top posts by views
	const topPostsData = await prisma.post.findMany({
		where: { published: true },
		select: {
			id: true,
			title: true,
			slug: true,
			viewCount: true,
		},
		orderBy: {
			viewCount: 'desc',
		},
		take: 10,
	});

	const topPosts = await Promise.all(
		topPostsData.map(async (post) => {
			const [likes, comments, saves] = await Promise.all([
				prisma.postLike.count({
					where: { postId: post.id },
				}),
				prisma.comment.count({
					where: {
						postId: post.id,
						deletedAt: null,
					},
				}),
				prisma.savedPost.count({
					where: { postId: post.id },
				}),
			]);

			return {
				postId: post.id,
				title: post.title,
				slug: post.slug,
				views: post.viewCount,
				likes,
				comments,
				saves,
			};
		})
	);

	const averageViewsPerPost =
		totalPublishedPosts > 0 ? totalViews / totalPublishedPosts : 0;
	const averageLikesPerPost =
		totalPublishedPosts > 0 ? totalLikes / totalPublishedPosts : 0;
	const averageCommentsPerPost =
		totalPublishedPosts > 0 ? totalComments / totalPublishedPosts : 0;

	return {
		totalPosts,
		totalPublishedPosts,
		totalViews,
		totalLikes,
		totalComments,
		totalSaves,
		averageViewsPerPost: Math.round(averageViewsPerPost * 100) / 100,
		averageLikesPerPost: Math.round(averageLikesPerPost * 100) / 100,
		averageCommentsPerPost: Math.round(averageCommentsPerPost * 100) / 100,
		topPosts,
	};
}

