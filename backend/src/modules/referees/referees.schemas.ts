export const refereesQuerySchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name:   { type: 'string', minLength: 2 },
    league: { type: 'string' },
    season: { type: 'string' },
  },
};
