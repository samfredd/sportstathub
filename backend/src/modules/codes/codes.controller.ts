export function createCodesController(codesService) {
  async function getCodes(request, reply) {
    const { limit = 20, offset = 0, bookmaker } = request.query;
    const result = await codesService.getCodes({
      limit: Number(limit),
      offset: Number(offset),
      bookmaker,
    });
    return reply.send({ status: 'success', data: result.codes, total: result.total });
  }

  async function getCodeById(request, reply) {
    const code = await codesService.getCodeById(Number(request.params.id));
    return reply.send({ status: 'success', data: code });
  }

  async function createCode(request, reply) {
    const code = await codesService.createCode(request.user.id, request.body);
    return reply.status(201).send({ status: 'success', data: code });
  }

  async function deleteCode(request, reply) {
    await codesService.deleteCode(
      Number(request.params.id),
      request.user.id,
      request.user.role
    );
    return reply.send({ status: 'success', message: 'Code removed' });
  }

  async function convertCode(request, reply) {
    const { code, fromBookmaker, toBookmaker } = request.body;
    const result = await codesService.convertCode({ code, fromBookmaker, toBookmaker });
    return reply.send({ status: 'success', data: result });
  }

  async function getConversionJob(request, reply) {
    const { jobId } = request.params;
    const result = await codesService.getConversionJob(jobId);
    return reply.send({ status: 'success', data: result });
  }

  return { getCodes, getCodeById, createCode, deleteCode, convertCode, getConversionJob };
}
