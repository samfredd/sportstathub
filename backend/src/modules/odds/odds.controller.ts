export function createOddsController(oddsService: any) {
  async function getSports(_request: any, reply: any) {
    const data = await oddsService.getSports();
    return reply.send({ status: 'success', data });
  }

  async function getOdds(request: any, reply: any) {
    const { regions = 'eu', markets = 'h2h', bookmakers } = request.query;
    const data = await oddsService.getOdds(request.params.sport, regions, markets, bookmakers);
    return reply.send({ status: 'success', data });
  }

  async function getScores(request: any, reply: any) {
    const { daysFrom = 1 } = request.query;
    const data = await oddsService.getScores(request.params.sport, Number(daysFrom));
    return reply.send({ status: 'success', data });
  }

  async function getEvents(request: any, reply: any) {
    const data = await oddsService.getEvents(request.params.sport);
    return reply.send({ status: 'success', data });
  }

  return { getSports, getOdds, getScores, getEvents };
}
