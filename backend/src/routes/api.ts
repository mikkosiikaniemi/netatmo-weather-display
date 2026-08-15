import express = require('express');
import { refreshSessionToken, tokenNeedsRefresh } from '../services/netatmoAuth';
import { getSession, getSessionId, saveSession, touchSession } from '../services/sessionStore';
import { NetatmoService } from '../services/netatmoService';

const router = express.Router();
const netatmoService = new NetatmoService();

router.get('/weather', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const session = getSession(req);

    if (!sessionId || !session || !session.accessToken) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const activeSession = await ensureFreshSession(sessionId, session, req, res);
    const payload = await netatmoService.getWeatherOverview(activeSession);

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get('/weather/:stationId/history', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const session = getSession(req);

    if (!sessionId || !session || !session.accessToken) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const activeSession = await ensureFreshSession(sessionId, session, req, res);
    const payload = await netatmoService.getStationHistory(activeSession, req.params.stationId);

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get('/forecast', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const session = getSession(req);

    if (!sessionId || !session || !session.accessToken) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const activeSession = await ensureFreshSession(sessionId, session, req, res);
    const payload = await netatmoService.getForecast(activeSession);

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

async function ensureFreshSession(sessionId: string, session: any, req: express.Request, res: express.Response) {
  if (!tokenNeedsRefresh(session)) {
    touchSession(req, res);
    return session;
  }

  const refreshed = await refreshSessionToken(session);
  saveSession(sessionId, refreshed);
  touchSession(req, res);

  return refreshed;
}

export = router;
