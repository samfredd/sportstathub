import fp from 'fastify-plugin';
import { createCodesRepository } from './codes.repository.js';
import { createCodesService } from './codes.service.js';
import { createCodesController } from './codes.controller.js';
import { createCodeSchema, codesQuerySchema, codeParamSchema, convertCodeSchema, jobIdParamSchema } from './codes.schemas.js';

async function codesRoutes(fastify) {
  const codesRepository = createCodesRepository(fastify.db);
  const codesService    = createCodesService(codesRepository);
  const ctrl            = createCodesController(codesService);
  const requireBookingCodeAccess = fastify.requireFeatureAccess('booking_codes_copy', 'pro');
  const requireCreatorAccess = fastify.requireFeatureAccess('creator_program', 'pro');

  fastify.get('/api/codes', {
    onRequest: [requireBookingCodeAccess],
    schema: { querystring: codesQuerySchema },
  }, ctrl.getCodes);
  fastify.get('/api/codes/:id', {
    onRequest: [requireBookingCodeAccess],
    schema: { params: codeParamSchema },
  }, ctrl.getCodeById);

  fastify.post('/api/codes', {
    onRequest: [fastify.authenticate, requireCreatorAccess],
    schema: { body: createCodeSchema },
  }, ctrl.createCode);

  fastify.delete('/api/codes/:id', {
    onRequest: [fastify.authenticate],
    schema: { params: codeParamSchema },
  }, ctrl.deleteCode);

  // OddSwitch-powered conversion: submit a job
  fastify.post('/api/codes/convert', {
    onRequest: [requireBookingCodeAccess],
    schema: { body: convertCodeSchema },
  }, ctrl.convertCode);

  // OddSwitch-powered conversion: poll job status
  fastify.get('/api/codes/convert/:jobId', {
    onRequest: [requireBookingCodeAccess],
    schema: { params: jobIdParamSchema },
  }, ctrl.getConversionJob);
}

export default fp(codesRoutes, {
  name: 'codes-routes',
  fastify: '5.x',
  dependencies: ['authenticate'],
});
