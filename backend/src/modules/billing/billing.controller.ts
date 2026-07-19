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

  async function listHistory(request, reply) {
    const { limit = 20, offset = 0 } = request.query || {};
    const data = await service.listPayments(request.user, { limit, offset });
    return ok(reply, data);
  }

  async function getSubscription(request, reply) {
    return ok(reply, await service.getSubscription(request.user));
  }

  async function cancelSubscription(request, reply) {
    return ok(reply, await service.cancelSubscription(request.user, request.body?.reason));
  }

  async function restoreSubscription(request, reply) {
    return ok(reply, await service.restoreSubscription(request.user));
  }

  async function getReceipt(request, reply) {
    return ok(reply, await service.getReceipt(request.user, request.params.receiptNumber));
  }

  async function repairEntitlement(request, reply) {
    return ok(reply, await service.repairEntitlement(request.user, request.body));
  }

  return {
    listPlans,
    initializePaystack,
    verifyPaystack,
    listHistory,
    getSubscription,
    cancelSubscription,
    restoreSubscription,
    getReceipt,
    repairEntitlement,
  };
}
