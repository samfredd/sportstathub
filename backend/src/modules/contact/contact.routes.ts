import fp from 'fastify-plugin';
import config from '../../config/env.config.js';
import { createMailerService } from '../mailer/mailer.service.js';

const bodySchema = {
  type: 'object',
  required: ['name', 'email', 'message'],
  properties: {
    name:    { type: 'string', minLength: 1, maxLength: 100 },
    email:   { type: 'string', format: 'email' },
    message: { type: 'string', minLength: 10, maxLength: 2000 },
  },
  additionalProperties: false,
};

async function contactRoutes(fastify) {
  fastify.post('/api/contact', { schema: { body: bodySchema } }, async (request, reply) => {
    const { name, email, message } = request.body;

    if (config.smtpHost) {
      const mailer = createMailerService(config);
      await mailer.sendContactEmail({ name, email, message });
    } else {
      request.log.info({ name, email }, 'Contact form submission (SMTP not configured)');
    }

    return reply.status(200).send({ status: 'success', message: 'Message received' });
  });
}

export default fp(contactRoutes, { name: 'contact-routes', fastify: '5.x' });
