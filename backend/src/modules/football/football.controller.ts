export function createFootballController(footballService) {
  // Seasons are identified by start year; before August the active season is last year's
  const currentYear = () => {
    const now = new Date();
    return String(now.getMonth() < 7 ? now.getFullYear() - 1 : now.getFullYear());
  };
  const today = () => new Date().toISOString().split('T')[0];

  async function getSports(request: any, reply: any) {
    const data = await footballService.getSports();
    return reply.send({ status: 'success', data });
  }

  async function getLiveMatches(request, reply) {
    const { sport } = request.query || {};
    const data = await footballService.getLiveMatches(sport);
    return reply.send({ status: 'success', data });
  }

  async function getMatches(request, reply) {
    const { date = today(), league, season, sport } = request.query;
    const data = await footballService.getMatchesByDate(date, league, season, sport);
    return reply.send({ status: 'success', data });
  }

  async function getMatchById(request, reply) {
    const { sport } = request.query || {};
    const match = await footballService.getMatchById(request.params.id, sport);
    if (!match) {
      return reply.status(404).send({ status: 'error', error: 'Match not found' });
    }
    return reply.send({ status: 'success', data: match });
  }

  async function getMatchStats(request, reply) {
    const { sport } = request.query || {};
    const data = await footballService.getMatchStats(request.params.id, sport);
    return reply.send({ status: 'success', data });
  }

  async function getMatchLineups(request, reply) {
    const { sport } = request.query || {};
    const data = await footballService.getMatchLineups(request.params.id, sport);
    return reply.send({ status: 'success', data });
  }

  async function getMatchEvents(request, reply) {
    const { sport } = request.query || {};
    const data = await footballService.getMatchEvents(request.params.id, sport);
    return reply.send({ status: 'success', data });
  }

  async function getMatchPlayerStats(request, reply) {
    const { sport } = request.query || {};
    const data = await footballService.getMatchPlayerStats(request.params.id, sport || 'basketball');
    return reply.send({ status: 'success', data });
  }

  async function getLeagues(request, reply) {
    const { season, country, current = 'true', popular, sport } = request.query;
    const data = await footballService.getLeagues({ season, country, current, popular, sport });
    return reply.send({ status: 'success', data });
  }

  async function getStandings(request, reply) {
    const season = request.query.season || currentYear();
    const { sport } = request.query;
    const data = await footballService.getStandings(request.params.id, season, sport);
    return reply.send({ status: 'success', data });
  }

  async function getTopScorers(request, reply) {
    const season = request.query.season || currentYear();
    const { sport } = request.query;
    const data = await footballService.getTopScorers(request.params.id, season, sport);
    return reply.send({ status: 'success', data });
  }

  async function getH2H(request, reply) {
    const { team1, team2, last = 10, sport } = request.query;
    const data = await footballService.getH2H(team1, team2, last, sport);
    return reply.send({ status: 'success', data });
  }

  async function getTopAssists(request, reply) {
    const season = request.query.season || currentYear();
    const { sport } = request.query;
    const data = await footballService.getTopAssists(request.params.id, season, sport);
    return reply.send({ status: 'success', data });
  }

  async function getTopYellowCards(request, reply) {
    const season = request.query.season || currentYear();
    const { sport } = request.query;
    const data = await footballService.getTopYellowCards(request.params.id, season, sport);
    return reply.send({ status: 'success', data });
  }

  async function getTopRedCards(request, reply) {
    const season = request.query.season || currentYear();
    const { sport } = request.query;
    const data = await footballService.getTopRedCards(request.params.id, season, sport);
    return reply.send({ status: 'success', data });
  }

  async function getMatchPredictions(request, reply) {
    const data = await footballService.getPredictions(Number(request.params.id));
    return reply.send({ status: 'success', data });
  }

  async function getMatchInjuries(request, reply) {
    const data = await footballService.getInjuries(Number(request.params.id));
    return reply.send({ status: 'success', data });
  }

  async function getTeamStatistics(request, reply) {
    const { league, season } = request.query;
    if (!league || !season) {
      return reply.status(400).send({ status: 'error', error: 'league and season are required' });
    }
    const data = await footballService.getTeamStatistics(
      Number(request.params.id),
      Number(league),
      Number(season),
    );
    return reply.send({ status: 'success', data });
  }

  async function getTeamFixtures(request, reply) {
    const { last = 6, league, season, sport } = request.query;
    const data = await footballService.getTeamLastFixtures(
      Number(request.params.id),
      Number(last),
      league ? Number(league) : undefined,
      season ? Number(season) : undefined,
      sport,
    );
    return reply.send({ status: 'success', data });
  }

  async function searchTeams(request, reply) {
    const { name, sport } = request.query;
    const raw = await footballService.searchTeams(name, sport);
    const data = raw.map(t => ({
      id: t.team.id,
      name: t.team.name,
      logo: t.team.logo,
      country: t.team.country,
    }));
    return reply.send({ status: 'success', data });
  }

  return {
    getSports,
    getLiveMatches,
    getMatches,
    getMatchById,
    getMatchStats,
    getMatchPlayerStats,
    getMatchLineups,
    getMatchEvents,
    getLeagues,
    getStandings,
    getTopScorers,
    getTopAssists,
    getTopYellowCards,
    getTopRedCards,
    getMatchPredictions,
    getMatchInjuries,
    getTeamStatistics,
    getTeamFixtures,
    getH2H,
    searchTeams,
  };
}
