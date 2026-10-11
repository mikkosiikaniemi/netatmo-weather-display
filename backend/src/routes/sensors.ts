import express = require('express');
import crypto = require('crypto');
import { getSession, getSessionId } from '../services/sessionStore';
import { addReading, getLatestReading, getReadings, getRetentionHours } from '../services/sensorStore';
import { SensorLatestResponse, SensorReadingsResponse } from '../types/sensors';

const router = express.Router();

// Apple Shortcuts can post JSON, form-encoded, or plain-text bodies.
router.use(express.urlencoded({ extended: true }));
router.use(express.text({ type: ['text/plain', 'text/*'] }));

function getConfiguredToken(): string | null {
  const token = process.env.SENSOR_INGEST_TOKEN;
  return token && token.trim() ? token.trim() : null;
}

function extractToken(req: express.Request): string | null {
  const header = req.get('x-api-token');
  if (header && header.trim()) {
    return header.trim();
  }

  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }

  return null;
}

function tokensMatch(provided: string, configured: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function hasValidToken(req: express.Request): boolean {
  const configured = getConfiguredToken();
  const provided = extractToken(req);

  if (!configured || !provided) {
    return false;
  }

  return tokensMatch(provided, configured);
}

function hasSession(req: express.Request): boolean {
  const sessionId = getSessionId(req);
  const session = getSession(req);
  return Boolean(sessionId && session && session.accessToken);
}

router.post('/ingest', (req, res, next) => {
  try {
    const configured = getConfiguredToken();

    if (!configured) {
      res.status(503).json({ error: 'Sensor ingest is not configured. Set SENSOR_INGEST_TOKEN in backend/.env.' });
      return;
    }

    if (!hasValidToken(req)) {
      res.status(401).json({ error: 'Invalid or missing sensor token' });
      return;
    }

    let body = req.body;

    // Shortcuts may send JSON with a text/plain content type; parse it here.
    if (typeof body === 'string') {
      const trimmed = body.trim();
      if (!trimmed) {
        res.status(400).json({ error: 'Request body is empty' });
        return;
      }

      try {
        body = JSON.parse(trimmed);
      } catch (error) {
        res.status(400).json({ error: 'Request body must be valid JSON' });
        return;
      }
    }

    console.log('[sensors] ingest', {
      contentType: req.get('content-type'),
      bodyLength: typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body || {}).length,
      keys: body && typeof body === 'object' ? Object.keys(body) : typeof body,
    });

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }

    // Fallback: if the body has no usable fields, fall back to query parameters
    // (e.g. ?temperature=21.5&humidity=43&token=...).
    if (Object.keys(body).length === 0) {
      const query: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (key !== 'token' && typeof value === 'string') {
          query[key] = value;
        }
      }
      if (Object.keys(query).length > 0) {
        body = query;
      }
    }

    const reading = addReading(body as Record<string, unknown>);
    res.status(201).json({ ok: true, reading });
  } catch (error) {
    next(error);
  }
});

router.get('/readings', (req, res, next) => {
  try {
    if (!hasValidToken(req) && !hasSession(req)) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const deviceId = typeof req.query.deviceId === 'string' && req.query.deviceId.trim()
      ? req.query.deviceId.trim()
      : undefined;

    const readings = getReadings(deviceId);
    const payload: SensorReadingsResponse = {
      fetchedAt: new Date().toISOString(),
      deviceId: deviceId || null,
      hours: getRetentionHours(),
      count: readings.length,
      readings,
    };

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get('/latest', (req, res, next) => {
  try {
    if (!hasValidToken(req) && !hasSession(req)) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const deviceId = typeof req.query.deviceId === 'string' && req.query.deviceId.trim()
      ? req.query.deviceId.trim()
      : undefined;

    const latest = getLatestReading(deviceId);
    const payload: SensorLatestResponse = {
      fetchedAt: new Date().toISOString(),
      readings: latest ? [latest] : [],
    };

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

export = router;
