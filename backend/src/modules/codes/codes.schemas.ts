export const createCodeSchema = {
  type: 'object',
  required: ['code', 'bookmaker'],
  properties: {
    code:        { type: 'string', minLength: 2, maxLength: 100 },
    bookmaker:   { type: 'string', minLength: 2, maxLength: 100 },
    description: { type: 'string', maxLength: 500 },
    totalOdds:   { type: 'number', minimum: 1 },
    stakeType:   { type: 'string', enum: ['single', 'accumulator', 'system', 'other'] },
    category:    { type: 'string', maxLength: 50 },
    expiresAt:   { type: 'string', format: 'date-time' },
  },
  additionalProperties: false,
};

export const codesQuerySchema = {
  type: 'object',
  properties: {
    limit:     { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    offset:    { type: 'integer', minimum: 0, default: 0 },
    bookmaker: { type: 'string' },
  },
};

export const codeParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer' } },
};

export const convertCodeSchema = {
  type: 'object',
  required: ['code', 'fromBookmaker', 'toBookmaker'],
  properties: {
    code:         { type: 'string', minLength: 1, maxLength: 100 },
    fromBookmaker:{ type: 'string', minLength: 1, maxLength: 100 },
    toBookmaker:  { type: 'string', minLength: 1, maxLength: 100 },
  },
  additionalProperties: false,
};

export const jobIdParamSchema = {
  type: 'object',
  required: ['jobId'],
  properties: { jobId: { type: 'string', minLength: 1, maxLength: 200 } },
};
