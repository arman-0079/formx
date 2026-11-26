import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import rateLimit from 'express-rate-limit';
import { db, DATA_DIR } from './db.ts';
import { ensureDemoSeed, createStarterFormForUser } from './seed.ts';
import type { User } from '../src/types/form.ts';

function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
    return process.env.JWT_SECRET.trim();
  }
  const secretPath = path.join(DATA_DIR, '.jwt_secret');
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretPath, generated, { mode: 0o600 });
  return generated;
}

const JWT_SECRET = resolveJwtSecret();

export interface AuthenticatedRequest extends Request {
  user?: User;
}

function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    avatarColor: String(row.avatar_color ?? '#4F46E5'),
    createdAt: String(row.created_at),
  };
}

function issueToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(401).json({ error: 'Session invalid or user no longer exists.' });
      return;
    }
    req.user = mapUserRow(row);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again shortly.' },
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, (req: Request, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (name.length < 2 || name.length > 80) {
    res.status(400).json({ error: 'Full name must be between 2 and 80 characters.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const id = `usr_${nanoid(10)}`;
  const hash = bcrypt.hashSync(password, 10);
  const colors = ['#4F46E5', '#059669', '#D97706', '#E11D48', '#2563EB'];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, avatar_color, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, email, hash, avatarColor, now);

  createStarterFormForUser(db, id);

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
  const token = issueToken(id);
  res.status(201).json({ token, user: mapUserRow(row) });
});

authRouter.post('/login', authLimiter, (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  if (!row || !bcrypt.compareSync(password, String(row.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = issueToken(String(row.id));
  res.json({ token, user: mapUserRow(row) });
});

authRouter.post('/demo', authLimiter, (_req: Request, res: Response) => {
  const demoUserId = ensureDemoSeed(db);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(demoUserId) as Record<string, unknown>;
  const token = issueToken(demoUserId);
  res.json({ token, user: mapUserRow(row) });
});

authRouter.post('/forgot-password', authLimiter, (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Please enter your account email.' });
    return;
  }
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'No account found with that email address.' });
    return;
  }

  const resetToken = `FX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  db.prepare('UPDATE users SET reset_token = ?, reset_expires_at = ? WHERE id = ?').run(resetToken, expiresAt, row.id);

  res.json({
    message: 'Password reset token generated. Enter this token to set a new password.',
    resetToken,
  });
});

authRouter.post('/reset-password', authLimiter, (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const token = String(req.body?.token ?? '').trim();
  const newPassword = String(req.body?.newPassword ?? '');

  if (!email || !token || newPassword.length < 6) {
    res.status(400).json({ error: 'Valid email, reset token, and new password (6+ chars) are required.' });
    return;
  }

  const row = db.prepare('SELECT id, reset_token, reset_expires_at FROM users WHERE email = ?').get(email) as
    | { id: string; reset_token: string | null; reset_expires_at: string | null }
    | undefined;

  if (!row || !row.reset_token || row.reset_token !== token) {
    res.status(400).json({ error: 'Invalid or unrecognized reset token.' });
    return;
  }

  if (!row.reset_expires_at || new Date(row.reset_expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    return;
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?').run(hash, row.id);
  res.json({ message: 'Your password has been updated. You can now sign in.' });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

authRouter.patch('/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const name = String(req.body?.name ?? req.user!.name).trim();
  const avatarColor = String(req.body?.avatarColor ?? req.user!.avatarColor).trim();
  const currentPassword = req.body?.currentPassword ? String(req.body.currentPassword) : null;
  const newPassword = req.body?.newPassword ? String(req.body.newPassword) : null;

  if (name.length < 2 || name.length > 80) {
    res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    return;
  }

  if (newPassword !== null) {
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string };
    if (!currentPassword || !bcrypt.compareSync(currentPassword, row.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET name = ?, avatar_color = ?, password_hash = ? WHERE id = ?').run(name, avatarColor, hash, userId);
  } else {
    db.prepare('UPDATE users SET name = ?, avatar_color = ? WHERE id = ?').run(name, avatarColor, userId);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
  res.json({ user: mapUserRow(updated) });
});
