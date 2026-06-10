// Shared HTTP cache-header helpers for read routes backed by external APIs
// (API-Football, The Odds API, RSS news). Pairs with the serve-stale logic in
// the service layer: a CDN/proxy can serve a slightly old copy while it
// revalidates, which keeps the limited daily upstream quotas low.

/**
 * Route `config` fragment that records a Cache-Control directive. Public scope
 * lets a shared CDN/proxy cache responses that are identical for everyone;
 * private scope restricts caching to the user's own browser (use this for
 * auth-gated routes so a shared cache can't serve gated data to others).
 */
export function cache(ttl: number, scope: 'public' | 'private' = 'public') {
  return { config: { cacheControl: `${scope}, max-age=${ttl}, stale-while-revalidate=${ttl * 4}` } };
}

/**
 * Register an encapsulated onSend hook that applies each route's
 * `config.cacheControl` to successful GET responses. Scoped to the plugin it is
 * called in, so it never touches other modules' routes. Returning undefined
 * from the async hook leaves the payload untouched (Fastify onSendHookRunner).
 */
export function registerCacheHeaders(fastify: any) {
  fastify.addHook('onSend', async (request: any, reply: any) => {
    if (request.method !== 'GET') return;
    if (reply.statusCode >= 400) return;
    if (reply.getHeader('cache-control')) return;
    const cc = request.routeOptions?.config?.cacheControl;
    if (cc) reply.header('Cache-Control', cc);
  });
}
