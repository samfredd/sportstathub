export function createRefereesService({ footballService }) {
  async function getRefereeStats({ name, leagueId, season }) {
    const fixtures = await footballService.getRefereeFixtures(name, leagueId, season);

    const stats = fixtures.reduce(
      (acc, f) => {
        acc.matches++;
        acc.totalGoals += (f.goals?.home ?? 0) + (f.goals?.away ?? 0);

        const status = f.fixture?.status?.short;
        if (status === 'FT' || status === 'AET' || status === 'PEN') {
          const home = f.goals?.home ?? 0;
          const away = f.goals?.away ?? 0;
          if (home > away) acc.homeWins++;
          else if (away > home) acc.awayWins++;
          else acc.draws++;
        }
        return acc;
      },
      { matches: 0, totalGoals: 0, homeWins: 0, awayWins: 0, draws: 0 }
    );

    stats.avgGoalsPerMatch =
      stats.matches > 0
        ? Math.round((stats.totalGoals / stats.matches) * 100) / 100
        : 0;

    const recentFixtures = fixtures.slice(0, 15).map(f => ({
      id:       f.fixture.id,
      date:     f.fixture.date,
      status:   f.fixture.status,
      league:   { id: f.league.id, name: f.league.name, logo: f.league.logo, country: f.league.country },
      homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
      awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
      score:    { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
      venue:    f.fixture.venue?.name ?? null,
    }));

    return { name, stats, recentFixtures };
  }

  return { getRefereeStats };
}
