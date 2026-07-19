// ─── Shared ─────────────────────────────────────────────────
const paginationQuery = {
  type: 'object',
  properties: {
    page:    { type: 'integer', minimum: 1, default: 1 },
    limit:   { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    search:  { type: 'string', default: '' },
  },
};

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer' } },
};

// ─── Users ───────────────────────────────────────────────────
export const usersQuerySchema    = paginationQuery;
export const userParamSchema     = idParam;

export const updateUserSchema = {
  type: 'object',
  properties: {
    role:        { type: 'string', enum: ['user', 'creator_pending', 'creator', 'creator_suspended', 'creator_rejected', 'moderator', 'admin'] },
    is_verified: { type: 'boolean' },
    status:      { type: 'string', enum: ['active', 'suspended', 'banned'] },
  },
  additionalProperties: false,
};

// ─── Booking Codes ────────────────────────────────────────────
export const adminCodesQuerySchema = {
  ...paginationQuery,
  properties: {
    ...paginationQuery.properties,
    includeInactive: { type: 'boolean', default: true },
  },
};

export const adminCreateCodeSchema = {
  type: 'object',
  required: ['code', 'bookmaker'],
  properties: {
    code:        { type: 'string', minLength: 1, maxLength: 100 },
    bookmaker:   { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string' },
    totalOdds:   { type: 'number' },
    stakeType:   { type: 'string', maxLength: 50 },
    category:    { type: 'string', maxLength: 50 },
    expiresAt:   { type: 'string', format: 'date-time', nullable: true },
    userId:      { type: 'integer', nullable: true },
  },
  additionalProperties: false,
};

export const adminUpdateCodeSchema = {
  type: 'object',
  properties: {
    code:        { type: 'string', minLength: 1, maxLength: 100 },
    bookmaker:   { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string' },
    totalOdds:   { type: 'number' },
    stakeType:   { type: 'string', maxLength: 50 },
    category:    { type: 'string', maxLength: 50 },
    isActive:    { type: 'boolean' },
    expiresAt:   { type: 'string', format: 'date-time', nullable: true },
  },
  additionalProperties: false,
};

// ─── Admin Profile ────────────────────────────────────────────
export const changePasswordSchema = {
  type: 'object',
  required: ['currentPassword', 'newPassword'],
  properties: {
    currentPassword: { type: 'string', minLength: 1 },
    newPassword:     { type: 'string', minLength: 8 },
  },
  additionalProperties: false,
};

// ─── Subscription Plans ───────────────────────────────────────
export const createPlanSchema = {
  type: 'object',
  required: ['slug', 'displayName'],
  properties: {
    slug:          { type: 'string', minLength: 1, maxLength: 50 },
    displayName:   { type: 'string', minLength: 1, maxLength: 100 },
    description:   { type: 'string', nullable: true },
    priceMonthly:  { type: 'number', minimum: 0 },
    priceYearly:   { type: 'number', minimum: 0 },
    currency:      { type: 'string', enum: ['USD'], default: 'USD' },
    features:      { type: 'array', items: { type: 'string' } },
    limits:        { type: 'object' },
    isActive:      { type: 'boolean' },
    isPopular:     { type: 'boolean' },
    sortOrder:     { type: 'integer' },
    gracePeriodDays:{type:'integer',minimum:0,maximum:30},
  },
  additionalProperties: false,
};

export const updatePlanSchema = {
  type: 'object',
  properties: {
    displayName:   { type: 'string', minLength: 1, maxLength: 100 },
    description:   { type: 'string', nullable: true },
    priceMonthly:  { type: 'number', minimum: 0 },
    priceYearly:   { type: 'number', minimum: 0 },
    currency:      { type: 'string', enum: ['USD'] },
    features:      { type: 'array', items: { type: 'string' } },
    limits:        { type: 'object' },
    isActive:      { type: 'boolean' },
    isPopular:     { type: 'boolean' },
    sortOrder:     { type: 'integer' },
    gracePeriodDays:{type:'integer',minimum:0,maximum:30},
  },
  additionalProperties: false,
};

// ─── Subscriptions ────────────────────────────────────────────
export const subscriptionsQuerySchema = paginationQuery;
export const subscriptionParamSchema  = idParam;

export const createSubscriptionSchema = {
  type: 'object',
  required: ['userId', 'plan'],
  properties: {
    userId:    { type: 'integer' },
    plan:      { type: 'string', enum: ['free', 'pro', 'enterprise'] },
    status:    { type: 'string', enum: ['active', 'grace', 'cancelled', 'expired', 'pending', 'failed'], default: 'active' },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    notes:     { type: 'string', nullable: true },
  },
  additionalProperties: false,
};

export const updateSubscriptionSchema = {
  type: 'object',
  properties: {
    plan:      { type: 'string', enum: ['free', 'pro', 'enterprise'] },
    status:    { type: 'string', enum: ['active', 'grace', 'cancelled', 'expired', 'pending', 'failed'] },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    notes:     { type: 'string', nullable: true },
  },
  additionalProperties: false,
};

// ─── Bulk User Actions ──────────────────────────────────────────
// Discriminated per-action payload: `delete` takes no payload, `suspend`/
// `unsuspend` take only an optional reason, `change_role` requires an
// explicit role from the enum. Deliberately not `payload: {type:'object'}`,
// which would accept an arbitrary, unvalidated object regardless of action.
export const bulkUserSchema = {
  type: 'object',
  required: ['ids', 'action'],
  properties: {
    ids:     { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 100 },
    action:  { type: 'string', enum: ['delete', 'suspend', 'unsuspend', 'change_role'] },
    reason:  { type: 'string', maxLength: 500 },
    payload: { type: 'object' },
  },
  additionalProperties: false,
  allOf: [
    {
      if: { properties: { action: { const: 'delete' } } },
      then: { properties: { payload: { type: 'object', additionalProperties: false, maxProperties: 0 } } },
    },
    {
      if: { properties: { action: { enum: ['suspend', 'unsuspend'] } } },
      then: { properties: { payload: { type: 'object', additionalProperties: false, maxProperties: 0 } } },
    },
    {
      if: { properties: { action: { const: 'change_role' } } },
      then: {
        // `required` must be repeated here, not only inside `payload` —
        // `properties` validation only applies to keys that are present, so
        // without this an instance that omits `payload` entirely would skip
        // the nested `required: ['role']` check and pass validation.
        required: ['payload'],
        properties: {
          payload: {
            type: 'object',
            required: ['role'],
            properties: {
              role: { type: 'string', enum: ['user', 'creator_pending', 'creator', 'creator_suspended', 'creator_rejected', 'moderator', 'admin'] },
            },
            additionalProperties: false,
          },
        },
      },
    },
  ],
};
