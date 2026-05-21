export const matchesQuerySchema = {
  type: 'object',
  properties: {
    date:   { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    league: { type: 'string' },
    season: { type: 'string' },
    sport:  { type: 'string' },
  },
};

export const matchParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
};

export const leagueParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
};

export const h2hQuerySchema = {
  type: 'object',
  required: ['team1', 'team2'],
  properties: {
    team1: { type: 'string' },
    team2: { type: 'string' },
    last:  { type: 'integer', minimum: 1, maximum: 50, default: 10 },
    sport: { type: 'string' },
  },
};

export const leaguesQuerySchema = {
  type: 'object',
  properties: {
    season:  { type: 'string' },
    country: { type: 'string' },
    current: { type: 'string', enum: ['true', 'false'] },
    popular: { type: 'string', enum: ['true', 'false'] },
    sport:   { type: 'string' },
  },
};

export const standingsQuerySchema = {
  type: 'object',
  properties: {
    season: { type: 'string' },
    sport:  { type: 'string' },
  },
};

export const teamsSearchSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    sport: { type: 'string' },
  },
};

export const teamParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
};

export const teamStatsQuerySchema = {
  type: 'object',
  required: ['league', 'season'],
  properties: {
    league: { type: 'string' },
    season: { type: 'string' },
  },
};

export const teamFixturesQuerySchema = {
  type: 'object',
  properties: {
    last: { type: 'integer', minimum: 1, maximum: 20, default: 6 },
  },
};
