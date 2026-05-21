/**
 * OAuth Service — pure business logic for Google OAuth flow.
 *
 * Responsibilities:
 *   1. Fetch the user's profile from Google's userinfo endpoint
 *   2. Normalize profile data
 *   3. Upsert the user via the repository
 *   4. Issue a JWT
 *
 * Does NOT touch Fastify, `reply`, or `request`. The access token is
 * passed in as a plain string so this function is independently testable.
 */

const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export function createOAuthService({ oauthRepository, helpers, jwt }) {

  /**
   * Complete the Google OAuth login flow given a valid access token.
   *
   * Returns { user, token } on success.
   * Throws a plain Error on Google API failure or unexpected DB errors
   * (the controller treats all non-ServiceError throws as 500s).
   */
  async function handleGoogleCallback(accessToken) {
    const profile: any = await fetchGoogleProfile(accessToken);

    // Google always provides a verified email — but guard anyway
    if (!profile.email || !profile.verified_email) {
      throw new Error('Google profile is missing a verified email address');
    }

    const email    = helpers.normalizeEmail(profile.email);
    // Derive a username from their full name; fall back to the local part of email.
    // Replace spaces with underscores so username is a valid single token.
    const username = profile.name
      ? helpers.normalizeUsername(profile.name).replace(/\s+/g, '_')
      : email.split('@')[0];

    const user = await oauthRepository.upsertOAuthUser({
      googleId:  profile.id,
      email,
      username,
      avatarUrl: profile.picture ?? null,
    });

    if (user.status && user.status !== 'active') {
      throw Object.assign(new Error(`Account is ${user.status}`), { statusCode: 403 });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role });

    return { user: sanitizeUser(user), token };
  }

  return { handleGoogleCallback };
}

// ── Private ───────────────────────────────────────────────────────────────────

/**
 * Call Google's userinfo endpoint with the access token.
 * Using the built-in fetch (Node 18+) — no extra dependency needed.
 *
 * Expected profile shape:
 *   { id, email, verified_email, name, picture }
 */
async function fetchGoogleProfile(accessToken): Promise<any> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    // Include status so the upstream error log is actionable
    throw new Error(`Google userinfo request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Strip the password hash before any user object leaves the service layer.
 * OAuth users have NULL passwords but the destructure is harmless either way.
 */
function sanitizeUser({ password, ...safe }) {
  return safe;
}
