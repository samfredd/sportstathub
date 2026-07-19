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
    const data = await service.listCreators(request.query);
    return ok(reply, data);
  }

  async function getCreator(request, reply) {
    const data = await service.getCreator(request.params.id);
    return ok(reply, data);
  }

  async function listThreads(request, reply) {
    const data = await service.listThreads(request.query, request.user ?? null);
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
  async function globalSearch(request,reply){return ok(reply,await service.globalSearch(request.query.q));}

  async function getLeaderboard(request, reply) {
    const data = await service.getLeaderboard();
    return ok(reply, data);
  }

  async function getCreatorDashboard(request, reply) {
    const data = await service.getCreatorDashboard(request.user);
    return ok(reply, data);
  }
  async function getCreatorPerformance(request, reply) { return ok(reply,await service.getCreatorPerformance(Number(request.params.id))); }

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
    const data = await service.becomeCreator(request.user.id, request.body);
    return ok(reply, data);
  }

  async function changePassword(request, reply) {
    await service.changePassword(request.user.id, request.body as any);
    return ok(reply, { message: 'Password updated successfully' });
  }

  async function likePrediction(request, reply) {
    const data = await service.likePrediction(request.params.id, request.user.id);
    return ok(reply, data);
  }

  async function likeThread(request, reply) {
    const data = await service.likeThread(request.params.id, request.user.id);
    return ok(reply, data);
  }

  async function likeComment(request, reply) {
    const data = await service.likeComment(request.params.id, request.user.id);
    return ok(reply, data);
  }

  async function toggleFollow(request, reply) {
    const data = await service.toggleFollow(request.user.id, Number(request.params.id));
    return ok(reply, data);
  }

  async function updateThread(request, reply) { return ok(reply, await service.updateContent(request.user,'thread',Number(request.params.id),request.body)); }
  async function deleteThread(request, reply) { return ok(reply, await service.deleteContent(request.user,'thread',Number(request.params.id))); }
  async function updateComment(request, reply) { return ok(reply, await service.updateContent(request.user,'comment',Number(request.params.id),request.body)); }
  async function deleteComment(request, reply) { return ok(reply, await service.deleteContent(request.user,'comment',Number(request.params.id))); }
  async function reportContent(request, reply) { return reply.status(201).send({ status:'success',data:await service.reportContent(request.user,request.body) }); }
  async function setRelationship(request, reply) { return ok(reply,await service.setRelationship(request.user,Number(request.params.id),request.body)); }
  async function moderationQueue(request, reply) { return ok(reply,await service.listModerationQueue(request.query.status,request.query.limit)); }
  async function moderateContent(request, reply) { return ok(reply,await service.moderateContent(request.user,request.body)); }
  async function appealModeration(request, reply) { return reply.status(201).send({status:'success',data:await service.appealModeration(request.user,request.body)}); }
  async function resolveAppeal(request,reply){return ok(reply,await service.resolveAppeal(request.user,request.body));}
  async function listNotifications(request, reply) { return ok(reply,await service.listNotifications(request.user,request.query.limit)); }
  async function markNotificationsRead(request, reply) { return ok(reply,await service.markNotificationsRead(request.user,request.body?.ids)); }
  async function getNotificationPreferences(request, reply) { return ok(reply,await service.getNotificationPreferences(request.user)); }
  async function updateNotificationPreferences(request, reply) { return ok(reply,await service.updateNotificationPreferences(request.user,request.body)); }
  async function saveMatch(request,reply){return ok(reply,await service.saveMatch(request.user,{...request.body,fixtureId:request.params.fixtureId}));}
  async function listSavedMatches(request,reply){return ok(reply,await service.listSavedMatches(request.user));}
  async function deleteSavedMatch(request,reply){return ok(reply,await service.deleteSavedMatch(request.user,request.params.fixtureId,request.query.sport));}

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
    globalSearch,
    getLeaderboard,
    getCreatorDashboard,
    getCreatorPerformance,
    getUserDashboard,
    getMe,
    updateProfile,
    becomeCreator,
    changePassword,
    likePrediction,
    likeThread,
    likeComment,
    toggleFollow,
    updateThread,deleteThread,updateComment,deleteComment,reportContent,setRelationship,
    moderationQueue,moderateContent,appealModeration,resolveAppeal,listNotifications,markNotificationsRead,
    getNotificationPreferences,updateNotificationPreferences,
    saveMatch,listSavedMatches,deleteSavedMatch,
  };
}
