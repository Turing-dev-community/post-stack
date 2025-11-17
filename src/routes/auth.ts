import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateToken, hashPassword, comparePassword, authenticateToken } from '../utils/auth';
import { validateSignup, validateLogin, validateProfileUpdate } from '../middleware/validators';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { AuthRequest } from '../utils/auth';

const router = Router();
const prisma = new PrismaClient();

// Signup endpoint
router.post('/signup', validateSignup, handleValidationErrors, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, username, password } = req.body;

  // Check if user already exists (including deactivated accounts - emails/usernames cannot be reused)
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username }
      ]
      // Note: We check all users (including deactivated) to prevent email/username reuse
    }
  });

  if (existingUser) {
    return res.status(400).json({
      error: 'User already exists',
      message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
    });
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      username: true,
      createdAt: true,
    },
  });

  const token = generateToken(user.id);

  return res.status(201).json({
    message: 'User created successfully',
    user,
    token,
  });
}));

router.post('/login', validateLogin, handleValidationErrors, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({
      error: 'Invalid credentials',
    });
  }

  // Check if account is deactivated
  if (user.deletedAt) {
    return res.status(403).json({
      error: 'Account has been deactivated',
      message: 'This account has been deactivated. Please contact support if you believe this is an error.',
    });
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      error: 'Invalid credentials',
    });
  }

  const token = generateToken(user.id);

  return res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    token,
  });
}));


router.get('/profile', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      profilePicture: true,
      about: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
        },
      },
    },
  });

  const followerCount = await prisma.follow.count({
    where: { followingId: req.user.id },
  });

  const followingCount = await prisma.follow.count({
    where: { followerId: req.user.id },
  });

  return res.json({
    user: {
      ...user,
      followerCount,
      followingCount,
    },
  });
}));

router.put('/profile', authenticateToken, validateProfileUpdate, handleValidationErrors, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { profilePicture, about } = req.body;

  const updateData: { profilePicture?: string | null; about?: string | null } = {};

  if (profilePicture !== undefined) {
    updateData.profilePicture = profilePicture || null;
  }

  if (about !== undefined) {
    updateData.about = about || null;
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: updateData,
    select: {
      id: true,
      email: true,
      username: true,
      profilePicture: true,
      about: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
        },
      },
    },
  });

  const followerCount = await prisma.follow.count({
    where: { followingId: req.user.id },
  });

  const followingCount = await prisma.follow.count({
    where: { followerId: req.user.id },
  });

  return res.json({
    message: 'Profile updated successfully',
    user: {
      ...user,
      followerCount,
      followingCount,
    },
  });
}));

// Deactivate account (soft delete)
router.delete('/account', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  // Check if account is already deactivated
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, deletedAt: true },
  });

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
    });
  }

  if (user.deletedAt) {
    return res.status(400).json({
      error: 'Account already deactivated',
      message: 'This account has already been deactivated.',
    });
  }

  // Soft delete: set deletedAt timestamp
  await prisma.user.update({
    where: { id: req.user.id },
    data: { deletedAt: new Date() },
  });

  return res.json({
    message: 'Account deactivated successfully',
    note: 'Your account has been deactivated. You will not be able to log in or access your account.',
  });
}));

export default router;
