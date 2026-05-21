import fp from 'fastify-plugin';

async function requireAdminPlugin(fastify) {
  if (fastify.hasDecorator('requireAdmin')) return;
  fastify.decorate('requireAdmin', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ status: 'error', error: 'Unauthorized' });
    }
    if (request.user?.role !== 'admin') {
      return reply.status(403).send({ status: 'error', error: 'Forbidden' });
    }
  });
}

export default fp(requireAdminPlugin, { name: 'require-admin', fastify: '5.x' });
