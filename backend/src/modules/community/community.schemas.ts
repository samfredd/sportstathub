const anyObject = { type: 'object', additionalProperties: true };

export const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: '^\\d+$' },
  },
};

export const predictionsQuerySchema = {
  type: 'object',
  properties: {
    sport:     { type: 'string' },
    status:    { type: 'string' },
    market:    { type: 'string' },
    league:    { type: 'string' },
    date:      { type: 'string', format: 'date' },
    creatorId:   { type: 'string', pattern: '^\\d+$' },
    creatorRole: { type: 'string' },
    limit:       { type: 'integer', minimum: 1, maximum: 100, default: 50 },
  },
};

export const createPredictionSchema = {
  type: 'object',
  required: ['sport', 'league', 'match', 'prediction'],
  properties: {
    sport:       { type: 'string', minLength: 2, maxLength: 50 },
    league:      anyObject,
    match:       anyObject,
    prediction:  anyObject,
    bookingCode: { ...anyObject, nullable: true },
    status:      { type: 'string', enum: ['open', 'won', 'lost', 'void'], default: 'open' },
    stats:       anyObject,
    tags:        { type: 'array', items: { type: 'string', maxLength: 40 }, default: [] },
    isTrending:  { type: 'boolean', default: false },
    isPremium:   { type: 'boolean', default: false },
    fixtureId:   { type: 'integer', nullable: true },
  },
  additionalProperties: false,
};

export const threadsQuerySchema = {
  type: 'object',
  properties: {
    category: { type: 'string' },
    search:   { type: 'string', maxLength: 120 },
    sort:     { type: 'string', enum: ['latest', 'hot', 'top'], default: 'latest' },
    limit:    { type: 'integer', minimum: 1, maximum: 100, default: 50 },
  },
};

export const createThreadSchema = {
  type: 'object',
  required: ['category', 'title', 'content'],
  properties: {
    category: { type: 'string', minLength: 2, maxLength: 100 },
    title:    { type: 'string', minLength: 5, maxLength: 160 },
    content:  { type: 'string', minLength: 10, maxLength: 5000 },
    tags:     { type: 'array', items: { type: 'string', maxLength: 40 }, default: [] },
  },
  additionalProperties: false,
};

export const commentsQuerySchema = {
  type: 'object',
  required: ['targetType', 'targetId'],
  properties: {
    targetType: { type: 'string', enum: ['prediction', 'thread'] },
    targetId:   { type: 'string', minLength: 1, maxLength: 64 },
  },
};

export const createCommentSchema = {
  type: 'object',
  required: ['targetType', 'targetId', 'content'],
  properties: {
    targetType: { type: 'string', enum: ['prediction', 'thread'] },
    targetId:   { type: 'string', minLength: 1, maxLength: 64 },
    parentId:   { type: 'string', pattern: '^\\d+$', nullable: true },
    content:    { type: 'string', minLength: 1, maxLength: 500 },
  },
  additionalProperties: false,
};

export const trackingSchema = {
  type: 'object',
  required: ['eventName'],
  properties: {
    eventName:    { type: 'string', minLength: 2, maxLength: 80 },
    trackingId:   { type: 'string', maxLength: 120 },
    bookmaker:    { type: 'string', maxLength: 100 },
    code:         { type: 'string', maxLength: 100 },
    affiliateUrl: { type: 'string', maxLength: 2000 },
    predictionId: { type: 'string', maxLength: 64 },
    creatorId:    { type: 'string', maxLength: 64 },
    ts:           { type: 'number' },
  },
  additionalProperties: true,
};

export const interactionParamSchema = idParamSchema;

export const updateProfileSchema = {
  type: 'object',
  properties: {
    display_name: { type: 'string', maxLength: 100, nullable: true },
    bio:          { type: 'string', maxLength: 500,  nullable: true },
    avatar_url:   { type: 'string', maxLength: 500,  nullable: true },
  },
  additionalProperties: false,
};
