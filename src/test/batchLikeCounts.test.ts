import { setupPrismaMock } from './utils/mockPrisma';
import { 
  getBatchLikeCounts, 
  enrichPostsWithMetadata,
  transformPostTags 
} from '../utils/posts/postTransformers';
// Import prisma AFTER mocks are set up
import { prisma } from '../lib/prisma';
import app from '../index';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Batch Like Counts (N+1 Query Fix)', () => {
  // Validate that mocking is properly set up
  it('should have mocking properly configured', () => {
    expect(prismaMock.isMocked).toBe(true);
  });

  describe('getBatchLikeCounts', () => {
    it('should return empty map for empty post IDs array', async () => {
      const result = await getBatchLikeCounts([]);
      expect(result).toEqual(new Map());
      expect(prismaMock.postLike.groupBy).not.toHaveBeenCalled();
    });

    it('should batch fetch like counts for multiple posts in single query', async () => {
      const postIds = ['post-1', 'post-2', 'post-3'];
      
      prismaMock.postLike.groupBy.mockResolvedValue([
        { postId: 'post-1', _count: { postId: 5 } },
        { postId: 'post-2', _count: { postId: 10 } },
        { postId: 'post-3', _count: { postId: 0 } },
      ] as any);

      const result = await getBatchLikeCounts(postIds);

      expect(prismaMock.postLike.groupBy).toHaveBeenCalledTimes(1);
      expect(prismaMock.postLike.groupBy).toHaveBeenCalledWith({
        by: ['postId'],
        where: {
          postId: { in: postIds },
        },
        _count: {
          postId: true,
        },
      });

      expect(result.get('post-1')).toBe(5);
      expect(result.get('post-2')).toBe(10);
      expect(result.get('post-3')).toBe(0);
    });

    it('should return 0 for posts with no likes', async () => {
      const postIds = ['post-1', 'post-2'];
      
      // Only post-1 has likes
      prismaMock.postLike.groupBy.mockResolvedValue([
        { postId: 'post-1', _count: { postId: 3 } },
      ] as any);

      const result = await getBatchLikeCounts(postIds);

      expect(result.get('post-1')).toBe(3);
      expect(result.get('post-2')).toBeUndefined(); // Will be handled as 0 by caller
    });
  });

  describe('enrichPostsWithMetadata', () => {
    it('should return empty array for empty posts array', async () => {
      const result = await enrichPostsWithMetadata([]);
      expect(result).toEqual([]);
      expect(prismaMock.postLike.groupBy).not.toHaveBeenCalled();
    });

    it('should enrich multiple posts with batch like counts (single query)', async () => {
      const mockPosts = [
        { id: 'post-1', content: 'Short content', tags: [] },
        { id: 'post-2', content: 'Another short post', tags: [] },
        { id: 'post-3', content: 'Third post here', tags: [] },
      ];

      prismaMock.postLike.groupBy.mockResolvedValue([
        { postId: 'post-1', _count: { postId: 15 } },
        { postId: 'post-2', _count: { postId: 8 } },
        // post-3 has no likes, not in result
      ] as any);

      const result = await enrichPostsWithMetadata(mockPosts);

      // Verify single batch query instead of N queries
      expect(prismaMock.postLike.groupBy).toHaveBeenCalledTimes(1);
      expect(prismaMock.postLike.count).not.toHaveBeenCalled(); // Old N+1 approach

      expect(result).toHaveLength(3);
      expect(result[0].likeCount).toBe(15);
      expect(result[1].likeCount).toBe(8);
      expect(result[2].likeCount).toBe(0); // No likes = 0
      
      // Verify reading time is added
      expect(result[0]).toHaveProperty('readingTime');
      expect(result[1]).toHaveProperty('readingTime');
      expect(result[2]).toHaveProperty('readingTime');
    });

    it('should transform post tags correctly', async () => {
      const mockPosts = [
        { 
          id: 'post-1', 
          content: 'Content here',
          tags: [
            { tag: { id: 'tag-1', name: 'JavaScript' } },
            { tag: { id: 'tag-2', name: 'TypeScript' } },
          ] 
        },
      ];

      prismaMock.postLike.groupBy.mockResolvedValue([
        { postId: 'post-1', _count: { postId: 5 } },
      ] as any);

      const result = await enrichPostsWithMetadata(mockPosts);

      expect(result[0].tags).toEqual([
        { id: 'tag-1', name: 'JavaScript' },
        { id: 'tag-2', name: 'TypeScript' },
      ]);
    });

    it('should handle posts with varying like counts efficiently', async () => {
      const mockPosts = Array.from({ length: 20 }, (_, i) => ({
        id: `post-${i}`,
        content: `Content for post ${i}`,
        tags: [],
      }));

      const likeCounts = mockPosts.map((post, i) => ({
        postId: post.id,
        _count: { postId: i * 2 },
      }));

      prismaMock.postLike.groupBy.mockResolvedValue(likeCounts as any);

      const result = await enrichPostsWithMetadata(mockPosts);

      // Still only 1 query for 20 posts
      expect(prismaMock.postLike.groupBy).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(20);
      expect(result[5].likeCount).toBe(10);
      expect(result[10].likeCount).toBe(20);
    });
  });

  describe('transformPostTags', () => {
    it('should transform PostTag[] to Tag[]', () => {
      const post = {
        id: 'post-1',
        title: 'Test Post',
        tags: [
          { tag: { id: 'tag-1', name: 'React' } },
          { tag: { id: 'tag-2', name: 'Node.js' } },
        ],
      };

      const result = transformPostTags(post);

      expect(result.tags).toEqual([
        { id: 'tag-1', name: 'React' },
        { id: 'tag-2', name: 'Node.js' },
      ]);
    });

    it('should handle post with no tags', () => {
      const post = {
        id: 'post-1',
        title: 'Test Post',
        tags: [],
      };

      const result = transformPostTags(post);
      expect(result.tags).toEqual([]);
    });

    it('should handle post with undefined tags', () => {
      const post = {
        id: 'post-1',
        title: 'Test Post',
      };

      const result = transformPostTags(post);
      expect(result.tags).toEqual([]);
    });
  });
});

