export interface SessionData {
  oauthState?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  configured: boolean;
  user: null | {
    scope: string | null;
    expiresAt: number | null;
  };
}
