import fp         from 'fastify-plugin';
import oauthPlugin from '@fastify/oauth2';

import config              from '../../config/env.config.js';
import * as helpers        from '../../helpers/auth.helpers.js';
import { createOAuthRepository }  from './oauth.repository.js';
import { createOAuthService }     from './oauth.service.js';
import { createOAuthController }  from './oauth.controller.js';

/**
 * OAuth routes plugin — registers the Google OAuth2 flow and wires the DI chain.
 *
 * Plugin registration order matters:
 *   1. @fastify/cookie  — @fastify/oauth2 v7.2+ uses cookies for PKCE state
 *   2. @fastify/oauth2  — decorates `fastify.googleOAuth2` and adds the start-redirect route
 *   3. Callback route   — manually registered so we control the response shape
 *
 * Wrapped in fastify-plugin so server.db / server.redis / server.jwt from the
 * parent scope are visible inside this plugin.
 */
async function oauthRoutes(fastify: any) {

  // Cookie support (required by @fastify/oauth2 for PKCE code-verifier storage)
  // is registered globally in server.ts before this plugin loads.

  // Register the Google OAuth2 plugin.
  // startRedirectPath adds a GET /auth/google route automatically — no handler needed.
  await fastify.register(oauthPlugin, {
    name:        'googleOAuth2',
    credentials: {
      client: {
        id:     config.googleClientId,
        secret: config.googleClientSecret,
      },
      auth: (oauthPlugin as any).GOOGLE_CONFIGURATION,
    },
    // The route that kicks off the consent screen redirect
    startRedirectPath: '/auth/google',
    // Must exactly match one of the authorized redirect URIs in the Google Cloud Console
    callbackUri: config.googleRedirectUri,
    // 'profile' gives us name + picture; 'email' gives us the verified email address
    scope: ['profile', 'email'],
    // PKCE (Proof Key for Code Exchange) prevents authorization code interception.
    // S256 is the recommended method — the verifier is stored in an httpOnly cookie.
    pkce: 'S256',
  });

  // ── DI chain ────────────────────────────────────────────────────────────────

  const oauthRepository = createOAuthRepository(fastify.db);
  const oauthService    = createOAuthService({
    oauthRepository,
    helpers,
    jwt: fastify.jwt,
  });
  const controller = createOAuthController(oauthService);

  // ── Callback route ───────────────────────────────────────────────────────────

  // Google redirects here after the user grants consent.
  // The path must match callbackUri above (without the origin).
  fastify.get('/auth/google/callback', controller.googleCallback);
}

export default fp(oauthRoutes, {
  name:    'oauth-routes',
  fastify: '5.x',
});
