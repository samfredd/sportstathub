export function createBillingController(service) {
  function ok(reply, data) {
    return reply.send({ status: 'success', data });
  }

  async function listPlans(_request, reply) {
    const data = await service.listPlans();
    return ok(reply, data);
  }

  async function initializePaystack(request, reply) {
    const data = await service.initializeCheckout(request.user, request.body);
    return reply.status(201).send({ status: 'success', data });
  }

  async function verifyPaystack(request, reply) {
    const data = await service.verifyPayment(request.user, request.body.reference);
    return ok(reply, data);
  }

  return {
    listPlans,
    initializePaystack,
    verifyPaystack,
  };
}
