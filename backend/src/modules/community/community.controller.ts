export function createCommunityController(service) {
  function ok(reply, data) {
    return reply.send({ status: 'success', data });
  }

  async function listPredictions(request, reply) {
    const data = await service.listPredictions(request.query, request.user ?? null);
    return ok(reply, data);
  }

  async function getPrediction(request, reply) {
    const data = await service.getPrediction(request.params.id, request.user ?? null);
    return ok(reply, data);
  }

  async function createPrediction(request, reply) {
    const data = await service.createPrediction(request.user, request.body);
    return reply.status(201).send({ status: 'success', data });
  }

  async function listCreators(request, reply) {
    const data = await service.listCreators();
    return ok(reply, data);
  }

  async function getCreator(request, reply) {
    const data = await service.getCreator(request.params.id);
    return ok(reply, data);
  }

  async function listThreads(request, reply) {
    const data = await service.listThreads(request.query);
    return ok(reply, data);
  }

  async function getThread(request, reply) {
    const data = await service.getThread(request.params.id);
    return ok(reply, data);
  }

  async function createThread(request, reply) {
    const data = await service.createThread(request.user, request.body);
    return reply.status(201).send({ status: 'success', data });
  }

  async function listComments(request, reply) {
    const data = await service.listComments(request.query, request.user ?? null);
    return ok(reply, data);
  }

  async function createComment(request, reply) {
    const data = await service.createComment(request.user, request.body);
    return reply.status(201).send({ status: 'success', data });
  }

  async function track(request, reply) {
    await service.track(request.body);
    return reply.status(202).send({ status: 'success' });
  }

  async function getPlatformStats(request, reply) {
    const data = await service.getPlatformStats();
    return ok(reply, data);
  }

  async function getLeaderboard(request, reply) {
    const data = await service.getLeaderboard();
    return ok(reply, data);
  }

  async function getCreatorDashboard(request, reply) {
    const data = await service.getCreatorDashboard(request.user);
    return ok(reply, data);
  }

  async function getUserDashboard(request, reply) {
    const data = await service.getUserDashboard(request.user);
    return ok(reply, data);
  }

  async function getMe(request, reply) {
    const data = await service.getMe(request.user.id);
    return ok(reply, data);
  }

  async function updateProfile(request, reply) {
    const data = await service.updateProfile(request.user.id, request.body);
    return ok(reply, data);
  }

  async function becomeCreator(request, reply) {
    const data = await service.becomeCreator(request.user.id);
    return ok(reply, data);
  }

  async function changePassword(request, reply) {
    await service.changePassword(request.user.id, request.body as any);
    return ok(reply, { message: 'Password updated successfully' });
  }

  async function likePrediction(request, reply) {
    const data = await service.likePrediction(request.params.id);
    return ok(reply, data);
  }

  async function likeThread(request, reply) {
    const data = await service.likeThread(request.params.id);
    return ok(reply, data);
  }

  async function likeComment(request, reply) {
    const data = await service.likeComment(request.params.id);
    return ok(reply, data);
  }

  async function toggleFollow(request, reply) {
    const data = await service.toggleFollow(request.user.id, Number(request.params.id));
    return ok(reply, data);
  }

  return {
    listPredictions,
    getPrediction,
    createPrediction,
    listCreators,
    getCreator,
    listThreads,
    getThread,
    createThread,
    listComments,
    createComment,
    track,
    getPlatformStats,
    getLeaderboard,
    getCreatorDashboard,
    getUserDashboard,
    getMe,
    updateProfile,
    becomeCreator,
    changePassword,
    likePrediction,
    likeThread,
    likeComment,
    toggleFollow,
  };
}
