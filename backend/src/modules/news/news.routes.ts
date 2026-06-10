import fp from 'fastify-plugin';
import { cache, registerCacheHeaders } from '../../helpers/http-cache.helpers.js';
import { createNewsService } from './news.service.js';

async function newsRoutes(fastify: any) {
  const newsService = createNewsService({ redis: fastify.redis });

  registerCacheHeaders(fastify);

  // News is public and refreshed on a 15-min feed cache — match that TTL.
  fastify.get('/api/news', { ...cache(900) }, async (request: any, reply: any) => {
    const { limit = '30', page = '1' } = request.query as Record<string, string>;
    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const all      = await newsService.getAllNews();
    const start    = (pageNum - 1) * limitNum;
    return reply.send({
      status: 'success',
      data: { items: all.slice(start, start + limitNum), total: all.length, page: pageNum, limit: limitNum },
    });
  });

  fastify.get('/api/news/:id', { ...cache(900) }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const all = await newsService.getAllNews();
    const article = all.find(item => item.id === id);
    if (!article) return reply.status(404).send({ status: 'error', error: 'Article not found' });
    const related = all
      .filter(item => item.id !== id && item.source === article.source)
      .slice(0, 6);
    return reply.send({ status: 'success', data: { article, related } });
  });

  fastify.get('/api/news/team', { ...cache(900) }, async (request: any, reply: any) => {
    const { team1, team2, limit = '10' } = request.query as Record<string, string>;
    if (!team1) return reply.status(400).send({ status: 'error', error: 'team1 is required' });
    const items = await newsService.getTeamNews(team1, team2);
    return reply.send({
      status: 'success',
      data: { items: items.slice(0, Number(limit)) },
    });
  });
}

export default fp(newsRoutes, { name: 'news-routes', fastify: '5.x', dependencies: ['infrastructure'] });
