import dotenv from "dotenv";

dotenv.config();

if (!process.env.SECRET_KEY) {
  throw new Error('SECRET_KEY environment variable is required — server cannot start without a JWT signing secret');
}
if (process.env.NODE_ENV === 'production' && !process.env.MFA_ENCRYPTION_KEY) {
  throw new Error('MFA_ENCRYPTION_KEY is required in production');
}
if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is required in production for account verification and recovery');
}
if (process.env.NODE_ENV === 'production' && !process.env.EMAIL_FROM) {
  throw new Error('EMAIL_FROM is required in production and must use a Resend-verified domain');
}

const config = {
  port: Number(process.env.PORT || 4000),
  secretKey: process.env.SECRET_KEY as string,
  databaseUrl: process.env.DATABASE_URL,
  // Access token — kept short-lived since the refresh token below is what
  // actually carries the session; a stolen/leaked access-token cookie is only
  // useful for this window.
  jwtExpiration: parseInt(process.env.JWT_EXPIRATION, 10) || 900, // 15 minutes

  // Refresh token — long-lived, single-use (rotated on every /auth/refresh
  // call), stored server-side in Redis so it can be revoked (logout, ban).
  refreshTokenExpiration: parseInt(process.env.REFRESH_TOKEN_EXPIRATION, 10) || 60 * 60 * 24 * 30, // 30 days
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  logLevel: process.env.LOG_LEVEL || "info",
  host: process.env.HOST || "0.0.0.0",

  // Google OAuth2 — GOOGLE_REDIRECT_URI must exactly match an authorized
  // redirect URI registered in the Google Cloud Console
  googleClientId:     process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri:  process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/auth/google/callback",

  apiKey: process.env.API_KEY,

  // API-Football (api-sports.io) — free tier: 100 requests/day
  // Sign up at https://dashboard.api-football.com to get a key
  footballApiKey: process.env.FOOTBALL_API_KEY || null,

  // Other sports (api-sports.io) — basketball, baseball, hockey
  // Falls back to FOOTBALL_API_KEY if you have a combined plan
  sportsApiKey: process.env.SPORTS_API_KEY || process.env.FOOTBALL_API_KEY || null,

  // The Odds API — free tier: 500 credits/month
  // Sign up at https://the-odds-api.com to get a key
  oddsApiKey: process.env.ODDS_API_KEY || null,

  redisHost:     process.env.REDIS_HOST || "localhost",
  redisPort:     Number(process.env.REDIS_PORT || 6379),
  redisPassword: process.env.REDIS_PASSWORD || null,

  // Encrypts administrator TOTP secrets at rest. Use an independent random
  // value in production; SECRET_KEY is only a development compatibility fallback.
  mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY || null,

  // NVIDIA AI (build.nvidia.com / NIM) — hosted LLM inference for AI match predictions
  // Get an API key at https://build.nvidia.com
  nvidiaApiKey:  process.env.NVIDIA_API_KEY || null,
  nvidiaBaseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  nvidiaModel:   process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-super-120b-a12b',

  // Email verification may only be bypassed in a non-production environment.
  requireOtp: process.env.NODE_ENV === 'production' || process.env.REQUIRE_OTP !== 'false',

  // Resend HTTP API — leave unset only in local/test environments.
  resendApiKey:  process.env.RESEND_API_KEY || null,
  emailFrom:     process.env.EMAIL_FROM    || 'no-reply@example.com',
  emailFromName: process.env.EMAIL_FROM_NAME || 'SportStatHub',
  contactEmail:  process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || 'no-reply@example.com',

  // Paystack — checkout is initialized and verified server-side
  paystackSecretKey:  process.env.PAYSTACK_SECRET_KEY || null,
  paystackPublicKey:  process.env.PAYSTACK_PUBLIC_KEY || null,
  paystackCallbackUrl: process.env.PAYSTACK_CALLBACK_URL
    || `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/dashboard/subscription`,
};

export default config;
