/**
 * OAuth Controller — HTTP boundary for Google OAuth callbacks.
 *
 * Only responsibility: hand the access token from the OAuth plugin to the
 * service, then shape the response. No business logic lives here.
 */
import config from '../../config/env.config.js';

export function createOAuthController(oauthService) {

  /**
   * GET /auth/google/callback
   *
   * Called by Google after the user grants consent. The @fastify/oauth2 plugin
   * exchanges the authorization code for an access token transparently —
   * this handler just picks it up and delegates to the service.
   *
   * In production you would typically redirect to the frontend with the JWT
   * as a short-lived query param or set it in an httpOnly cookie. Returning
   * it in the JSON body here keeps the implementation frontend-agnostic.
   */
  async function googleCallback(request, reply) {
    try {
      // request.server.googleOAuth2 is decorated by @fastify/oauth2 at registration time.
      // getAccessTokenFromAuthorizationCodeFlow handles the PKCE + state verification
      // and token exchange in one call.
      const { token } = await request.server.googleOAuth2
        .getAccessTokenFromAuthorizationCodeFlow(request, reply);

      const { user, token: jwt } = await oauthService.handleGoogleCallback(
        token.access_token
      );

      const redirectUrl = new URL('/auth/oauth-callback', config.corsOrigin);
      redirectUrl.hash = new URLSearchParams({ token: jwt, email: user.email }).toString();
      return reply.redirect(redirectUrl.toString());

    } catch (err) {
      // Log with full error detail — the client only sees a generic message
      // so an attacker cannot fingerprint which step failed.
      request.log.error({ err }, 'Google OAuth callback error');

      const redirectUrl = new URL('/auth/oauth-callback', config.corsOrigin);
      redirectUrl.hash = new URLSearchParams({ error: 'OAuth authentication failed. Please try again.' }).toString();
      return reply.redirect(redirectUrl.toString());
    }
  }

  return { googleCallback };
}
