import crypto from 'crypto';
import { config } from '../lib/config.js';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours in ms
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
    const [headerB64, payloadB64, signature] = token.split('.');

    const expectedSig = crypto
      .createHmac('sha256', config.jwt.secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signature !== expectedSig) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    if (payload.exp && Date.now() > payload.exp * 1000) {
      return res.status(401).json({ error: 'Token expired' });
    }

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24h
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', config.jwt.secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
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
