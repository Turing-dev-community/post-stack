import { Request, Response } from 'express';
import { AuthRequest } from '../utils/auth';
import {
  AuthChecker,
  checkAuth,
  checkAdmin,
  checkAuthor,
  checkOwnership,
} from '../utils/authDecorator';

describe('Authorization Decorators', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {};
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('AuthChecker.requireAuth', () => {
    it('should return authorized true when user is authenticated', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = AuthChecker.requireAuth(
        mockReq as AuthRequest,
        mockRes as Response
      );

      expect(result.authorized).toBe(true);
      expect(result.response).toBeUndefined();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return authorized false when user is not authenticated', () => {
      mockReq.user = undefined;

      const result = AuthChecker.requireAuth(
        mockReq as AuthRequest,
        mockRes as Response
      );

      expect(result.authorized).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
    });
  });

  describe('AuthChecker.requireRole', () => {
    it('should allow user with exact required role', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = AuthChecker.requireRole(
        mockReq as AuthRequest,
        mockRes as Response,
        'AUTHOR'
      );

      expect(result.authorized).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to access AUTHOR role routes', () => {
      mockReq.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'ADMIN',
      };

      const result = AuthChecker.requireRole(
        mockReq as AuthRequest,
        mockRes as Response,
        'AUTHOR'
      );

      expect(result.authorized).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny AUTHOR access to ADMIN role routes', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = AuthChecker.requireRole(
        mockReq as AuthRequest,
        mockRes as Response,
        'ADMIN'
      );

      expect(result.authorized).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Admin access required',
      });
    });

    it('should return unauthorized if user is not authenticated', () => {
      mockReq.user = undefined;

      const result = AuthChecker.requireRole(
        mockReq as AuthRequest,
        mockRes as Response,
        'AUTHOR'
      );

      expect(result.authorized).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
    });
  });

  describe('AuthChecker.requireAdmin', () => {
    it('should allow ADMIN user', () => {
      mockReq.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'ADMIN',
      };

      const result = AuthChecker.requireAdmin(
        mockReq as AuthRequest,
        mockRes as Response
      );

      expect(result.authorized).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny non-ADMIN user', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = AuthChecker.requireAdmin(
        mockReq as AuthRequest,
        mockRes as Response
      );

      expect(result.authorized).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Admin access required',
      });
    });
  });

  describe('AuthChecker.requireAuthor', () => {
    it('should allow AUTHOR user', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = AuthChecker.requireAuthor(
        mockReq as AuthRequest,
        mockRes as Response
      );

      expect(result.authorized).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow ADMIN user (role hierarchy)', () => {
      mockReq.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'ADMIN',
      };

      const result = AuthChecker.requireAuthor(
        mockReq as AuthRequest,
        mockRes as Response
      );

      expect(result.authorized).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('AuthChecker.requireOwnershipOrAdmin', () => {
    it('should allow resource owner', () => {
      const userId = 'user-123';
      mockReq.user = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = AuthChecker.requireOwnershipOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        userId
      );

      expect(result.authorized).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow ADMIN even if not the owner', () => {
      mockReq.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'ADMIN',
      };

      const result = AuthChecker.requireOwnershipOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        'different-user-id'
      );

      expect(result.authorized).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny non-owner non-admin', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = AuthChecker.requireOwnershipOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        'different-user-id'
      );

      expect(result.authorized).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Not authorized to access this resource',
      });
    });

    it('should return unauthorized if user is not authenticated', () => {
      mockReq.user = undefined;

      const result = AuthChecker.requireOwnershipOrAdmin(
        mockReq as AuthRequest,
        mockRes as Response,
        'some-user-id'
      );

      expect(result.authorized).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('checkAuth helper', () => {
    it('should return true when user is authenticated', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = checkAuth(mockReq as AuthRequest, mockRes as Response);

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return false when user is not authenticated', () => {
      mockReq.user = undefined;

      const result = checkAuth(mockReq as AuthRequest, mockRes as Response);

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should be a type guard that narrows req.user type', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const req = mockReq as AuthRequest;
      if (checkAuth(req, mockRes as Response)) {
        expect(req.user.id).toBe('user-123');
      }
    });
  });

  describe('checkAdmin helper', () => {
    it('should return true for ADMIN user', () => {
      mockReq.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'ADMIN',
      };

      const result = checkAdmin(mockReq as AuthRequest, mockRes as Response);

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return false for non-ADMIN user', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = checkAdmin(mockReq as AuthRequest, mockRes as Response);

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });

  describe('checkAuthor helper', () => {
    it('should return true for AUTHOR user', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = checkAuthor(mockReq as AuthRequest, mockRes as Response);

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return true for ADMIN user', () => {
      mockReq.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'ADMIN',
      };

      const result = checkAuthor(mockReq as AuthRequest, mockRes as Response);

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('checkOwnership helper', () => {
    it('should return true when user owns the resource', () => {
      const userId = 'user-123';
      mockReq.user = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = checkOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        userId
      );

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return true when user is ADMIN', () => {
      mockReq.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'ADMIN',
      };

      const result = checkOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        'different-user-id'
      );

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return false when user is neither owner nor admin', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      const result = checkOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        'different-user-id'
      );

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle controller pattern with early return', () => {
      mockReq.user = undefined;

      const controllerAction = () => {
        if (!checkAuth(mockReq as AuthRequest, mockRes as Response)) return;
        throw new Error('Should not reach here');
      };

      expect(() => controllerAction()).not.toThrow();
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should allow chained authorization checks', () => {
      const userId = 'user-123';
      mockReq.user = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      let canProceed = checkAuth(mockReq as AuthRequest, mockRes as Response);
      expect(canProceed).toBe(true);

      canProceed = checkOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        userId
      );
      expect(canProceed).toBe(true);
    });

    it('should short-circuit on first failed check', () => {
      mockReq.user = undefined;

      const controllerAction = () => {
        if (!checkAuth(mockReq as AuthRequest, mockRes as Response)) return;
        checkAdmin(mockReq as AuthRequest, mockRes as Response);
      };

      controllerAction();

      expect(statusMock).toHaveBeenCalledTimes(1);
      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('Error message formatting', () => {
    it('should use "Admin" for ADMIN role error message', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR',
      };

      AuthChecker.requireRole(
        mockReq as AuthRequest,
        mockRes as Response,
        'ADMIN'
      );

      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Admin access required',
      });
    });

    it('should use role name as-is for AUTHOR role error message', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'AUTHOR' as any,
      };

      (mockReq.user as any).role = 'INVALID_ROLE';

      AuthChecker.requireRole(
        mockReq as AuthRequest,
        mockRes as Response,
        'AUTHOR'
      );

      expect(jsonMock).toHaveBeenCalledWith({
        error: 'AUTHOR access required',
      });
    });
  });
});
