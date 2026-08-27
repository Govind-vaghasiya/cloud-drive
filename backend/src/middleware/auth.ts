import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: string;
  storageQuotaBytes: number | string;
  storageUsedBytes: number | string;
  twoFactorEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  session?: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    const authenticatedUser = session.user as unknown as AuthenticatedUser & { banned?: boolean; banReason?: string };
    if (authenticatedUser.banned) {
      res.status(403).json({
        error: 'Account Suspended',
        message: authenticatedUser.banReason
          ? `Your account has been suspended: ${authenticatedUser.banReason}`
          : 'Your account has been suspended by an administrator.',
      });
      return;
    }

    req.user = authenticatedUser;
    req.session = session.session;
    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Error validating session:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session token',
    });
  }
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin privileges required',
      });
      return;
    }
    next();
  });
}
