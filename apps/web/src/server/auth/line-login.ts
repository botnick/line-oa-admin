import { getSettings, getLineCallbackUrl } from '@line-oa/config/settings';

/**
 * LINE Login OAuth 2.1 helpers.
 *
 * Flow: Login button → LINE authorize → callback → token exchange → verify ID token
 */

const LINE_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

interface LineTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  id_token: string;
}

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

/**
 * Generate LINE Login OAuth URL.
 */
export function getLoginUrl(
  state: string,
  nonce: string,
  req?: { headers: { get(name: string): string | null } }
): string {
  const settings = getSettings();
  const callbackUrl = getLineCallbackUrl(req);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: settings.lineLogin.channelId,
    redirect_uri: callbackUrl,
    state,
    scope: 'profile openid',
    nonce,
    bot_prompt: 'normal',
  });

  return `${LINE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCode(
  code: string,
  req?: { headers: { get(name: string): string | null } }
): Promise<LineTokenResponse> {
  const settings = getSettings();
  const callbackUrl = getLineCallbackUrl(req);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
    client_id: settings.lineLogin.channelId,
    client_secret: settings.lineLogin.channelSecret,
  });

  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`LINE token exchange failed: ${error}`);
  }

  return res.json();
}

/**
 * Verify LINE ID token and extract user info.
 */
export async function verifyIdToken(
  idToken: string,
  nonce: string
): Promise<LineProfile> {
  const settings = getSettings();

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: settings.lineLogin.channelId,
    nonce,
  });

  const res = await fetch(LINE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`LINE ID token verification failed: ${error}`);
  }

  const data = await res.json();

  return {
    userId: data.sub,
    displayName: data.name,
    pictureUrl: data.picture,
    statusMessage: undefined,
  };
}

/**
 * Get LINE user profile using access token.
 */
export async function getLineProfile(accessToken: string): Promise<LineProfile> {
  const res = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error('Failed to get LINE profile');
  }

  return res.json();
}
