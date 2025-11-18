import { prisma } from './setup';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('User Followers Routes', () => {
  const baseUrl = `http://localhost:${process.env.PORT}/api`;
  let authToken: string;
  let userId: string;
  let otherUserToken: string;
  let otherUserId: string;
  let thirdUserId: string;

  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash('Password123', 12);
    
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword,
      },
    });
    userId = user.id;
    authToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

    const otherUser = await prisma.user.create({
      data: {
        email: 'other@example.com',
        username: 'otheruser',
        password: hashedPassword,
      },
    });
    otherUserId = otherUser.id;
    otherUserToken = jwt.sign({ userId: otherUser.id }, process.env.JWT_SECRET!);

    const thirdUser = await prisma.user.create({
      data: {
        email: 'third@example.com',
        username: 'thirduser',
        password: hashedPassword,
      },
    });
    thirdUserId = thirdUser.id;
  });

  describe('POST /api/users/:userId/follow', () => {
    it('should allow user to follow another user', async () => {
      const response = await fetch(`${baseUrl}/users/${otherUserId}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data: any = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe('Successfully followed user');
      expect(data.followingId).toBe(otherUserId);

      // Verify follow relationship was created
      const follow = await prisma.follow.findFirst({
        where: {
          followerId: userId,
          followingId: otherUserId,
        },
      });
      expect(follow).toBeTruthy();
    });

    it('should prevent following yourself', async () => {
      const response = await fetch(`${baseUrl}/users/${userId}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data: any = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot follow yourself');
    });

    it('should prevent duplicate follows', async () => {
      // First follow
      await prisma.follow.create({
        data: {
          followerId: userId,
          followingId: otherUserId,
        },
      });

      // Try to follow again
      const response = await fetch(`${baseUrl}/users/${otherUserId}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data: any = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Already following this user');
    });

    it('should require authentication to follow', async () => {
      const response = await fetch(`${baseUrl}/users/${otherUserId}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/users/:userId/follow', () => {
    it('should allow user to unfollow another user', async () => {
      // Create follow relationship first
      await prisma.follow.create({
        data: {
          followerId: userId,
          followingId: otherUserId,
        },
      });

      const response = await fetch(`${baseUrl}/users/${otherUserId}/follow`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Successfully unfollowed user');
      expect(data.followingId).toBe(otherUserId);

      // Verify follow relationship was deleted
      const follow = await prisma.follow.findFirst({
        where: {
          followerId: userId,
          followingId: otherUserId,
        },
      });
      expect(follow).toBeFalsy();
    });

    it('should require authentication to unfollow', async () => {
      const response = await fetch(`${baseUrl}/users/${otherUserId}/follow`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/users/:userId/followers', () => {
    it('should return list of followers', async () => {
      // Create multiple followers
      const user1 = await prisma.user.create({
        data: {
          email: 'follower1@example.com',
          username: 'follower1',
          password: await bcrypt.hash('Password123', 12),
        },
      });

      const user2 = await prisma.user.create({
        data: {
          email: 'follower2@example.com',
          username: 'follower2',
          password: await bcrypt.hash('Password123', 12),
        },
      });

      // Create follow relationships
      await prisma.follow.create({
        data: {
          followerId: user1.id,
          followingId: userId,
        },
      });

      await prisma.follow.create({
        data: {
          followerId: user2.id,
          followingId: userId,
        },
      });

      const response = await fetch(`${baseUrl}/users/${userId}/followers`);

      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('followers');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('limit');
      expect(data.followers).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.followers[0]).toHaveProperty('id');
      expect(data.followers[0]).toHaveProperty('username');
      expect(data.followers[0]).toHaveProperty('createdAt');
    });

    it('should return empty list when user has no followers', async () => {
      const response = await fetch(`${baseUrl}/users/${userId}/followers`);

      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data.followers).toHaveLength(0);
      expect(data.total).toBe(0);
    });
  });

  describe('GET /api/users/:userId/following', () => {
    it('should return list of users being followed', async () => {
      // Create follow relationships
      await prisma.follow.create({
        data: {
          followerId: userId,
          followingId: otherUserId,
        },
      });

      await prisma.follow.create({
        data: {
          followerId: userId,
          followingId: thirdUserId,
        },
      });

      const response = await fetch(`${baseUrl}/users/${userId}/following`);

      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('following');
      expect(data).toHaveProperty('total');
      expect(data.following).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.following[0]).toHaveProperty('id');
      expect(data.following[0]).toHaveProperty('username');
      expect(data.following[0]).toHaveProperty('createdAt');
    });

    it('should return empty list when user is not following anyone', async () => {
      const response = await fetch(`${baseUrl}/users/${userId}/following`);

      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data.following).toHaveLength(0);
      expect(data.total).toBe(0);
    });
  });

  
});

