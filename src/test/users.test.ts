import request from 'supertest';
import jwt from 'jsonwebtoken';
import { setupPrismaMock } from './utils/mockPrisma';
import { invalidateCache } from '../middleware/cache';
// Import prisma and app AFTER mocks are set up
import { prisma } from '../lib/prisma';
import app from '../index';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('User Followers Routes', () => {
  // Validate that mocking is properly set up
  it('should have mocking properly configured', () => {
    expect(prismaMock.isMocked).toBe(true);
  });
  let authToken: string;
  let userId: string;
  let otherUserToken: string;
  let otherUserId: string;
  let thirdUserId: string;

  beforeEach(() => {
    // Set up mock user IDs
    userId = 'user-1';
    otherUserId = 'user-2';
    thirdUserId = 'user-3';

    // Generate real JWT tokens (fast, no need to mock)
    authToken = jwt.sign({ userId }, process.env.JWT_SECRET!);
    otherUserToken = jwt.sign({ userId: otherUserId }, process.env.JWT_SECRET!);
  });

  // Helper function to mock auth user lookup
  const mockAuthUser = (userIdToMock: string) => {
    const userMap: Record<string, any> = {
      [userId]: {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        deletedAt: null,
      },
      [otherUserId]: {
        id: otherUserId,
        email: 'other@example.com',
        username: 'otheruser',
        deletedAt: null,
      },
      [thirdUserId]: {
        id: thirdUserId,
        email: 'third@example.com',
        username: 'thirduser',
        deletedAt: null,
      },
    };

    (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
      const id = args?.where?.id;
      return Promise.resolve(userMap[id] || null);
    });
  };

  describe('POST /api/users/:userId/follow', () => {
    it('should allow user to follow another user', async () => {
      // Mock auth user lookup (will handle both auth and business logic calls)
      mockAuthUser(userId);

      // Override for the specific user lookup in business logic if needed
      // The mockAuthUser already handles both userId and otherUserId

      // Mock: Check if already following (should return null)
      (prismaMock.follow.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock: Create follow relationship
      (prismaMock.follow.create as jest.Mock).mockResolvedValue({
        id: 'follow-1',
        followerId: userId,
        followingId: otherUserId,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/users/${otherUserId}/follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.message).toBe('Successfully followed user');
      expect(response.body.followingId).toBe(otherUserId);

      // Verify Prisma was called correctly
      // First call: auth middleware (userId), Second call: check user to follow (otherUserId)
      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2);
      expect(prismaMock.follow.findFirst).toHaveBeenCalledWith({
        where: {
          followerId: userId,
          followingId: otherUserId,
        },
      });
      expect(prismaMock.follow.create).toHaveBeenCalledWith({
        data: {
          followerId: userId,
          followingId: otherUserId,
        },
      });
    });

    it('should prevent following yourself', async () => {
      // Mock auth user lookup
      mockAuthUser(userId);

      const response = await request(app)
        .post(`/api/users/${userId}/follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Cannot follow yourself');

      // Verify only auth call was made, not the business logic call
      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.follow.findFirst).not.toHaveBeenCalled();
    });

    it('should prevent duplicate follows', async () => {
      // Mock auth user lookup (handles both auth and business logic)
      mockAuthUser(userId);

      // Mock: Already following (return existing follow)
      (prismaMock.follow.findFirst as jest.Mock).mockResolvedValue({
        id: 'follow-existing',
        followerId: userId,
        followingId: otherUserId,
      });

      const response = await request(app)
        .post(`/api/users/${otherUserId}/follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Already following this user');

      // Verify create was NOT called
      expect(prismaMock.follow.create).not.toHaveBeenCalled();
    });

    it('should require authentication to follow', async () => {
      const response = await request(app)
        .post(`/api/users/${otherUserId}/follow`)
        .expect(401);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/users/:userId/follow', () => {
    it('should allow user to unfollow another user', async () => {
      // Mock auth user lookup
      mockAuthUser(userId);
      
      // Mock: Find existing follow relationship
      (prismaMock.follow.findFirst as jest.Mock).mockResolvedValue({
        id: 'follow-1',
        followerId: userId,
        followingId: otherUserId,
      });

      // Mock: Delete follow relationship
      (prismaMock.follow.delete as jest.Mock).mockResolvedValue({
        id: 'follow-1',
        followerId: userId,
        followingId: otherUserId,
      });

      const response = await request(app)
        .delete(`/api/users/${otherUserId}/follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Successfully unfollowed user');
      expect(response.body.followingId).toBe(otherUserId);

      // Verify Prisma was called correctly
      expect(prismaMock.follow.findFirst).toHaveBeenCalledWith({
        where: {
          followerId: userId,
          followingId: otherUserId,
        },
      });
      expect(prismaMock.follow.delete).toHaveBeenCalledWith({
        where: {
          id: 'follow-1',
        },
      });
    });

    it('should require authentication to unfollow', async () => {
      const response = await request(app)
        .delete(`/api/users/${otherUserId}/follow`)
        .expect(401);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/users/:userId/followers', () => {
    it('should return list of followers', async () => {
      const follower1 = {
        id: 'follower-1',
        username: 'follower1',
        createdAt: new Date('2024-01-01'),
      };
      const follower2 = {
        id: 'follower-2',
        username: 'follower2',
        createdAt: new Date('2024-01-02'),
      };

      // Mock: Get followers
      (prismaMock.follow.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'follow-1',
          createdAt: new Date('2024-01-01'),
          follower: follower1,
        },
        {
          id: 'follow-2',
          createdAt: new Date('2024-01-02'),
          follower: follower2,
        },
      ]);

      // Mock: Count followers
      (prismaMock.follow.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get(`/api/users/${userId}/followers`)
        .expect(200);

      expect(response.body).toHaveProperty('followers');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.followers).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.followers[0]).toHaveProperty('id');
      expect(response.body.followers[0]).toHaveProperty('username');
      expect(response.body.followers[0]).toHaveProperty('createdAt');
    });

    it('should return empty list when user has no followers', async () => {
      // Mock: No followers
      (prismaMock.follow.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.follow.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/users/${userId}/followers`)
        .expect(200);

      expect(response.body.followers).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('GET /api/users/:userId/following', () => {
    it('should return list of users being followed', async () => {
      const following1 = {
        id: otherUserId,
        username: 'otheruser',
        createdAt: new Date('2024-01-01'),
      };
      const following2 = {
        id: thirdUserId,
        username: 'thirduser',
        createdAt: new Date('2024-01-02'),
      };

      // Mock: Get following
      (prismaMock.follow.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'follow-1',
          createdAt: new Date('2024-01-01'),
          following: following1,
        },
        {
          id: 'follow-2',
          createdAt: new Date('2024-01-02'),
          following: following2,
        },
      ]);

      // Mock: Count following
      (prismaMock.follow.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get(`/api/users/${userId}/following`)
        .expect(200);

      expect(response.body).toHaveProperty('following');
      expect(response.body).toHaveProperty('total');
      expect(response.body.following).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.following[0]).toHaveProperty('id');
      expect(response.body.following[0]).toHaveProperty('username');
      expect(response.body.following[0]).toHaveProperty('createdAt');
    });

    it('should return empty list when user is not following anyone', async () => {
      // Mock: Not following anyone
      (prismaMock.follow.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.follow.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/users/${userId}/following`)
        .expect(200);

      expect(response.body.following).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('GET /api/users/:userId/profile', () => {
    beforeEach(() => {
      // Clear cache before each test to avoid interference
      invalidateCache.invalidateAll();
    });

    it('should return user public profile with all fields', async () => {
      const testUserId = 'profile-user-1';
      const createdAt = new Date('2024-01-15T10:00:00.000Z');
      const mockUser = {
        id: testUserId,
        username: 'testuser',
        profilePicture: 'https://example.com/avatar.jpg',
        about: 'Software developer and blogger',
        createdAt,
        deletedAt: null,
      };

      // Mock: Get user
      (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args?.where?.id === testUserId) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      });

      // Mock: Count published posts
      (prismaMock.post.count as jest.Mock).mockImplementation(() => Promise.resolve(42));

      // Mock: Count followers and following
      (prismaMock.follow.count as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve(150))
        .mockImplementationOnce(() => Promise.resolve(75));

      const response = await request(app)
        .get(`/api/users/${testUserId}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testUserId);
      expect(response.body).toHaveProperty('username', 'testuser');
      expect(response.body).toHaveProperty('profilePicture', 'https://example.com/avatar.jpg');
      expect(response.body).toHaveProperty('about', 'Software developer and blogger');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('postsCount', 42);
      expect(response.body).toHaveProperty('followerCount', 150);
      expect(response.body).toHaveProperty('followingCount', 75);

      // Verify Prisma was called correctly
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: testUserId },
        select: {
          id: true,
          username: true,
          profilePicture: true,
          about: true,
          createdAt: true,
          deletedAt: true,
        },
      });

      expect(prismaMock.post.count).toHaveBeenCalledWith({
        where: {
          authorId: testUserId,
          published: true,
        },
      });

      expect(prismaMock.follow.count).toHaveBeenCalledWith({
        where: { followingId: testUserId },
      });

      expect(prismaMock.follow.count).toHaveBeenCalledWith({
        where: { followerId: testUserId },
      });
    });

    it('should return profile with null optional fields', async () => {
      const testUserId = 'profile-user-2';
      const createdAt = new Date('2024-01-15T10:00:00.000Z');
      const mockUser = {
        id: testUserId,
        username: 'testuser',
        profilePicture: null,
        about: null,
        createdAt,
        deletedAt: null,
      };

      // Mock: Get user
      (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args?.where?.id === testUserId) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      });

      // Mock: Counts
      (prismaMock.post.count as jest.Mock).mockImplementation(() => Promise.resolve(0));
      (prismaMock.follow.count as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve(0))
        .mockImplementationOnce(() => Promise.resolve(0));

      const response = await request(app)
        .get(`/api/users/${testUserId}/profile`)
        .expect(200);

      expect(response.body.profilePicture).toBeNull();
      expect(response.body.about).toBeNull();
      expect(response.body.postsCount).toBe(0);
      expect(response.body.followerCount).toBe(0);
      expect(response.body.followingCount).toBe(0);
    });

    it('should return 404 when user does not exist', async () => {
      const nonExistentUserId = 'non-existent-user';

      // Mock: User not found
      (prismaMock.user.findUnique as jest.Mock).mockImplementation(() => Promise.resolve(null));

      const response = await request(app)
        .get(`/api/users/${nonExistentUserId}/profile`)
        .expect(404);

      expect(response.body.error).toBe('User not found');
      expect(response.body.message).toBe('This user account does not exist or has been deactivated.');

      // Verify counts were not called
      expect(prismaMock.post.count).not.toHaveBeenCalled();
      expect(prismaMock.follow.count).not.toHaveBeenCalled();
    });

    it('should return 404 when user is deleted', async () => {
      const testUserId = 'profile-user-3';
      const createdAt = new Date('2024-01-15T10:00:00.000Z');
      const deletedAt = new Date('2024-01-20T10:00:00.000Z');
      const mockUser = {
        id: testUserId,
        username: 'deleteduser',
        profilePicture: null,
        about: null,
        createdAt,
        deletedAt,
      };

      // Mock: Get deleted user
      (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args?.where?.id === testUserId) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      });

      // Ensure counts are not called by not mocking them
      (prismaMock.post.count as jest.Mock).mockImplementation(() => Promise.resolve(0));
      (prismaMock.follow.count as jest.Mock).mockImplementation(() => Promise.resolve(0));

      const response = await request(app)
        .get(`/api/users/${testUserId}/profile`)
        .expect(404);

      expect(response.body.error).toBe('User not found');
      expect(response.body.message).toBe('This user account does not exist or has been deactivated.');

      // Verify counts were not called (service should return early when user is deleted)
      expect(prismaMock.post.count).not.toHaveBeenCalled();
      expect(prismaMock.follow.count).not.toHaveBeenCalled();
    });

    it('should only count published posts', async () => {
      const testUserId = 'profile-user-4';
      const createdAt = new Date('2024-01-15T10:00:00.000Z');
      const mockUser = {
        id: testUserId,
        username: 'testuser',
        profilePicture: null,
        about: null,
        createdAt,
        deletedAt: null,
      };

      // Mock: Get user
      (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args?.where?.id === testUserId) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      });

      // Mock: Count published posts (should only count published: true)
      (prismaMock.post.count as jest.Mock).mockImplementation(() => Promise.resolve(10));

      // Mock: Counts
      (prismaMock.follow.count as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve(5))
        .mockImplementationOnce(() => Promise.resolve(3));

      const response = await request(app)
        .get(`/api/users/${testUserId}/profile`)
        .expect(200);

      expect(response.body.postsCount).toBe(10);

      // Verify post count was called with published: true
      expect(prismaMock.post.count).toHaveBeenCalledWith({
        where: {
          authorId: testUserId,
          published: true,
        },
      });
    });

    it('should be accessible without authentication', async () => {
      const testUserId = 'profile-user-5';
      const createdAt = new Date('2024-01-15T10:00:00.000Z');
      const mockUser = {
        id: testUserId,
        username: 'publicuser',
        profilePicture: null,
        about: null,
        createdAt,
        deletedAt: null,
      };

      // Mock: Get user
      (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args?.where?.id === testUserId) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      });

      // Mock: Counts
      (prismaMock.post.count as jest.Mock).mockImplementation(() => Promise.resolve(0));
      (prismaMock.follow.count as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve(0))
        .mockImplementationOnce(() => Promise.resolve(0));

      // Request without authentication token
      const response = await request(app)
        .get(`/api/users/${testUserId}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username');
      // Should not include sensitive fields
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('password');
    });
  });

  
});
