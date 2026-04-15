const axios = require('axios');
import { SessionData } from '../types/auth';

const NETATMO_AUTHORIZE_URL = 'https://api.netatmo.com/oauth2/authorize';
const NETATMO_TOKEN_URL = 'https://api.netatmo.com/oauth2/token';

function getRequiredEnv(name: string): string | null {
  return process.env[name] || null;
}

export function getNetatmoConfig() {
  const clientId = getRequiredEnv('NETATMO_CLIENT_ID') || getRequiredEnv('CLIENT_ID');
  const clientSecret = getRequiredEnv('NETATMO_CLIENT_SECRET') || getRequiredEnv('CLIENT_SECRET');
  const redirectUri = getRequiredEnv('NETATMO_REDIRECT_URI') || 'http://localhost:3001/auth/callback';

  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret),
  };
}

export function buildAuthorizationUrl(state: string): string {
  const config = getNetatmoConfig();
  const params = new URLSearchParams({
    client_id: config.clientId || '',
    redirect_uri: config.redirectUri,
    scope: 'read_station',
    response_type: 'code',
    state,
  });

  return NETATMO_AUTHORIZE_URL + '?' + params.toString();
}

export async function exchangeCodeForToken(code: string): Promise<SessionData> {
  const config = getNetatmoConfig();

  if (!config.configured || !config.clientId || !config.clientSecret) {
    throw new Error('Netatmo OAuth is not configured');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    scope: 'read_station',
  });

  const response = await axios.post(NETATMO_TOKEN_URL, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  });

  return normalizeTokenPayload(response.data);
}

export async function refreshSessionToken(session: SessionData): Promise<SessionData> {
  const config = getNetatmoConfig();

  if (!config.configured || !config.clientId || !config.clientSecret || !session.refreshToken) {
    throw new Error('Cannot refresh token without configured credentials and refresh token');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: session.refreshToken,
  });

  const response = await axios.post(NETATMO_TOKEN_URL, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  });

  const refreshed = normalizeTokenPayload(response.data);

  return {
    oauthState: session.oauthState,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken || session.refreshToken,
    expiresAt: refreshed.expiresAt,
    tokenType: refreshed.tokenType,
    scope: refreshed.scope,
  };
}

export function tokenNeedsRefresh(session: SessionData): boolean {
  if (!session.expiresAt) {
    return true;
  }

  return session.expiresAt <= Date.now() + 60 * 1000;
}

function normalizeTokenPayload(payload: any): SessionData {
  const expiresInSeconds = Number(payload.expires_in || 0);

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type || 'Bearer',
    scope: payload.scope || null,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
}
