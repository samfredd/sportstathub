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
    pagination:  { type: 'string', enum: ['legacy','cursor'], default: 'legacy' },
    cursor:      { type: 'string', maxLength: 500 },
  },
};

export const createPredictionSchema = {
  type: 'object',
  required: ['sport', 'league', 'match', 'prediction'],
  properties: {
    sport:       { type: 'string', minLength: 2, maxLength: 50 },
    schemaVersion: { type: 'integer', const: 1, default: 1 },
    league: { type: 'object', required: ['name'], properties: {
      id: { anyOf: [{ type: 'integer' }, { type: 'string', maxLength: 80 }, { type: 'null' }] },
      name: { type: 'string', minLength: 2, maxLength: 120 }, country: { type: 'string', maxLength: 80 },
    }, additionalProperties: false },
    match: { type: 'object', required: ['homeTeam','awayTeam','date'], properties: {
      id: { anyOf: [{ type: 'integer' }, { type: 'string', maxLength: 80 }] },
      fixtureId: { type: 'integer' }, date: { type: 'string', format: 'date-time' }, venue: { type: 'string', maxLength: 160 },
      homeTeam: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2, maxLength: 120 }, shortName: { type: 'string', maxLength: 20 }, form: { type: 'array', items: { type: 'string', maxLength: 12 }, maxItems: 10 } }, additionalProperties: false },
      awayTeam: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2, maxLength: 120 }, shortName: { type: 'string', maxLength: 20 }, form: { type: 'array', items: { type: 'string', maxLength: 12 }, maxItems: 10 } }, additionalProperties: false },
    }, additionalProperties: false },
    prediction: { type: 'object', required: ['type','odds','confidence','analysis'], properties: {
      type: { type: 'string', minLength: 2, maxLength: 100 }, shorthand: { type: 'string', maxLength: 100 },
      odds: { type: 'number', minimum: 1.01, maximum: 1000 }, confidence: { type: 'number', minimum: 0, maximum: 100 },
      analysis: { type: 'string', minLength: 20, maxLength: 3000 }, selection: { type: 'string', maxLength: 160 },
    }, additionalProperties: false },
    bookingCode: { anyOf: [{ type: 'null' }, { type: 'object', required: ['bookmaker','code'], properties: {
      id: { type: 'string', maxLength: 80 }, bookmaker: { type: 'string', maxLength: 100 }, code: { type: 'string', maxLength: 100 },
      clicks: { type: 'integer', minimum: 0 }, successRate: { type: 'number', minimum: 0, maximum: 100 }, trackingId: { type: 'string', maxLength: 120 },
      affiliateUrl: { type: 'string', maxLength: 2000 }, conversionStatus: { type: ['string','null'], maxLength: 40 },
    }, additionalProperties: false }] },
    status:      { type: 'string', const: 'open', default: 'open' },
    stats:       { type: 'object', properties: { likes: { const: 0 }, comments: { const: 0 }, views: { const: 0 }, shares: { const: 0 } }, additionalProperties: false },
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
    pagination:{type:'string',enum:['legacy','cursor'],default:'legacy'},cursor:{type:'string',maxLength:500},
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
    limit:{type:'integer',minimum:1,maximum:100,default:100},pagination:{type:'string',enum:['legacy','cursor'],default:'legacy'},cursor:{type:'string',maxLength:500},
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
    eventName:    { type: 'string', enum: ['code_copy', 'bookmaker_open', 'prediction_view', 'creator_profile_view'] },
    trackingId:   { type: 'string', maxLength: 120 },
    bookmaker:    { type: 'string', maxLength: 100 },
    code:         { type: 'string', maxLength: 24 },
    affiliateUrl: { type: 'string', maxLength: 2000 },
    predictionId: { type: 'string', maxLength: 64 },
    creatorId:    { type: 'string', maxLength: 64 },
    ts:           { type: 'number' },
  },
  additionalProperties: false,
};

export const interactionParamSchema = idParamSchema;

export const updateProfileSchema = {
  type: 'object',
  properties: {
    display_name: { type: 'string', maxLength: 100, nullable: true },
    bio:          { type: 'string', maxLength: 500,  nullable: true },
    avatar_url:   { type: 'string', format: 'uri', pattern: '^https://', maxLength: 500, nullable: true },
  },
  additionalProperties: false,
};
