import jwt from 'jsonwebtoken';
import { config } from '../lib/config.js';

/** Session duration in hours — configurable via SESSION_DURATION_HOURS env var. */
const SESSION_DURATION_HOURS = parseInt(process.env.SESSION_DURATION_HOURS, 10) || 24;
export const SESSION_COOKIE_MAX_AGE = SESSION_DURATION_HOURS * 60 * 60 * 1000;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_COOKIE_MAX_AGE,
};

export const COOKIE_NAME = 'hialice_token';

export function authMiddleware(req, res, next) {
  // Try cookie first (preferred — httpOnly, secure)
  let token = req.cookies?.[COOKIE_NAME];

  // Fall back to Authorization header for backwards compatibility and API clients
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function generateToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: '24h' });
}

/**
 * Verify a token and return the decoded payload.
 * Throws if the token is invalid or expired.
 */
export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

/**
 * Require admin or super_admin role.
 * Must be used after authMiddleware so req.user is already populated.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Require parent, admin, or super_admin role.
 * Must be used after authMiddleware so req.user is already populated.
 */
export function requireParent(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!['parent', 'admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Parent access required' });
  }
  next();
}
