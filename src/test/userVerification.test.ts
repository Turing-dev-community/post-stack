import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('User Verification API', () => {
    const adminId = 'admin-1';
    const userId = 'user-1';
    const targetUserId = 'user-2';

    const adminToken = (() => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
        return generateToken(adminId);
    })();

    const userToken = (() => {
        return generateToken(userId);
    })();

    const mockAdmin = {
        id: adminId,
        email: 'admin@example.com',
        username: 'admin',
        deletedAt: null,
    };

    const mockUser = {
        id: userId,
        email: 'user@example.com',
        username: 'testuser',
        deletedAt: null,
    };

    const mockTargetUser = {
        id: targetUserId,
        email: 'target@example.com',
        username: 'targetuser',
        deletedAt: null,
        isVerified: false,
    };

    beforeEach(() => {
        // Set admin email for admin tests
        process.env.ADMIN_EMAILS = 'admin@example.com';
    });

    afterEach(() => {
        delete process.env.ADMIN_EMAILS;
    });

    describe('PATCH /:userId/verify', () => {
        it('should verify a user successfully when admin', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === adminId) return Promise.resolve(mockAdmin);
                if (where.id === targetUserId) return Promise.resolve(mockTargetUser);
                return Promise.resolve(null);
            });
            (prismaMock.user.update as jest.Mock).mockResolvedValue({
                ...mockTargetUser,
                isVerified: true,
            });

            const res = await request(app)
                .patch(`/api/users/${targetUserId}/verify`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('message', 'User verified successfully');
            expect(res.body).toHaveProperty('isVerified', true);
        });

        it('should return 403 when non-admin tries to verify', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === userId) return Promise.resolve(mockUser);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .patch(`/api/users/${targetUserId}/verify`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);

            expect(res.body).toHaveProperty('error', 'Admin access required');
        });

        it('should return 404 when user does not exist', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === adminId) return Promise.resolve(mockAdmin);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .patch('/api/users/non-existent/verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);

            expect(res.body).toHaveProperty('error', 'NotFoundError');
            expect(res.body).toHaveProperty('message', 'User not found');
        });

        it('should return 401 when not authenticated', async () => {
            const res = await request(app)
                .patch(`/api/users/${targetUserId}/verify`)
                .expect(401);

            expect(res.body).toHaveProperty('error', 'Access token required');
        });
    });

    describe('DELETE /:userId/verify', () => {
        it('should unverify a user successfully when admin', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === adminId) return Promise.resolve(mockAdmin);
                if (where.id === targetUserId) return Promise.resolve({ ...mockTargetUser, isVerified: true });
                return Promise.resolve(null);
            });
            (prismaMock.user.update as jest.Mock).mockResolvedValue({
                ...mockTargetUser,
                isVerified: false,
            });

            const res = await request(app)
                .delete(`/api/users/${targetUserId}/verify`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('message', 'User unverified successfully');
            expect(res.body).toHaveProperty('isVerified', false);
        });

        it('should return 403 when non-admin tries to unverify', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === userId) return Promise.resolve(mockUser);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .delete(`/api/users/${targetUserId}/verify`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);

            expect(res.body).toHaveProperty('error', 'Admin access required');
        });

        it('should return 404 when user does not exist', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === adminId) return Promise.resolve(mockAdmin);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .delete('/api/users/non-existent/verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);

            expect(res.body).toHaveProperty('error', 'NotFoundError');
            expect(res.body).toHaveProperty('message', 'User not found');
        });
    });
});
