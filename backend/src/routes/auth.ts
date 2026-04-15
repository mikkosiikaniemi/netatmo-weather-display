import express = require('express');
import { buildAuthorizationUrl, exchangeCodeForToken, getNetatmoConfig, refreshSessionToken, tokenNeedsRefresh } from '../services/netatmoAuth';
import { destroySession, ensureSession, getSession, getSessionId, saveSession } from '../services/sessionStore';
import { AuthStatusResponse } from '../types/auth';

const router = express.Router();

router.get('/status', (req, res) => {
  const config = getNetatmoConfig();
  const session = getSession(req);

  const payload: AuthStatusResponse = {
    configured: config.configured,
    authenticated: Boolean(session && session.accessToken),
    user: session && session.accessToken
      ? {
          scope: session.scope || null,
          expiresAt: session.expiresAt || null,
        }
      : null,
  };

  res.json(payload);
});

router.get('/login', (req, res) => {
  const config = getNetatmoConfig();

  if (!config.configured) {
    res.status(500).json({ error: 'Netatmo OAuth is not configured on the backend.' });
    return;
  }

  const { sessionId, session } = ensureSession(req, res);
  const oauthState = Math.random().toString(36).slice(2) + Date.now().toString(36);

  session.oauthState = oauthState;
  saveSession(sessionId, session);

  res.redirect(buildAuthorizationUrl(oauthState));
});

router.get('/callback', async (req, res, next) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : null;
    const state = typeof req.query.state === 'string' ? req.query.state : null;
    const sessionId = getSessionId(req);
    const session = getSession(req);

    if (!code || !state || !sessionId || !session || session.oauthState !== state) {
      res.status(400).send('Invalid OAuth callback state.');
      return;
    }

    const tokenSession = await exchangeCodeForToken(code);
    saveSession(sessionId, tokenSession);

    res.redirect(process.env.FRONTEND_ORIGIN || 'http://localhost:5173');
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const session = getSession(req);

    if (!sessionId || !session || !session.refreshToken) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!tokenNeedsRefresh(session)) {
      res.json({ refreshed: false, expiresAt: session.expiresAt || null });
      return;
    }

    const refreshedSession = await refreshSessionToken(session);
    saveSession(sessionId, refreshedSession);

    res.json({ refreshed: true, expiresAt: refreshedSession.expiresAt || null });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ success: true });
});

export = router;
