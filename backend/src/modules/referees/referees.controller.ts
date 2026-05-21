export function createRefereesController(refereesService) {
  async function getRefereeStats(request, reply) {
    const { name, league, season } = request.query;
    const data = await refereesService.getRefereeStats({
      name,
      leagueId: league,
      season,
    });
    return reply.send({ status: 'success', data });
  }

  return { getRefereeStats };
}
