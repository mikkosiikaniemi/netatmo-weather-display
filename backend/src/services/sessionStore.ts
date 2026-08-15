import crypto = require('crypto');
import express = require('express');
import { SessionData } from '../types/auth';

const SESSION_COOKIE_NAME = 'netatmo.sid';
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const store = new Map<string, SessionData>();

function generateSessionId(): string {
  return crypto.randomBytes(24).toString('hex');
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction(),
    signed: true,
    maxAge: SESSION_TTL_MS,
  };
}

export function getSessionId(req: express.Request): string | undefined {
  const signedCookies = (req as any).signedCookies || {};
  return signedCookies[SESSION_COOKIE_NAME];
}

export function getSession(req: express.Request): SessionData | null {
  const sessionId = getSessionId(req);

  if (!sessionId) {
    return null;
  }

  return store.get(sessionId) || null;
}

export function touchSession(req: express.Request, res: express.Response): void {
  const sessionId = getSessionId(req);

  if (sessionId) {
    res.cookie(SESSION_COOKIE_NAME, sessionId, getCookieOptions());
  }
}

export function ensureSession(req: express.Request, res: express.Response): { sessionId: string; session: SessionData } {
  const existingSessionId = getSessionId(req);

  if (existingSessionId) {
    const existingSession = store.get(existingSessionId);

    if (existingSession) {
      touchSession(req, res);
      return { sessionId: existingSessionId, session: existingSession };
    }
  }

  const sessionId = generateSessionId();
  const session: SessionData = {};

  store.set(sessionId, session);
  res.cookie(SESSION_COOKIE_NAME, sessionId, getCookieOptions());

  return { sessionId, session };
}

export function saveSession(sessionId: string, session: SessionData): void {
  store.set(sessionId, session);
}

export function destroySession(req: express.Request, res: express.Response): void {
  const sessionId = getSessionId(req);

  if (sessionId) {
    store.delete(sessionId);
  }

  res.clearCookie(SESSION_COOKIE_NAME, getCookieOptions());
}
