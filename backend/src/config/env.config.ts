import dotenv from "dotenv";

dotenv.config();

if (!process.env.SECRET_KEY) {
  throw new Error('SECRET_KEY environment variable is required — server cannot start without a JWT signing secret');
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

  // Admin invite key — required to create new admin accounts via /auth/admin/register
  // Set a strong random string; leave unset to disable admin self-registration
  adminInviteKey: process.env.ADMIN_INVITE_KEY || null,

  // NVIDIA AI (build.nvidia.com / NIM) — hosted LLM inference for AI match predictions
  // Get an API key at https://build.nvidia.com
  nvidiaApiKey:  process.env.NVIDIA_API_KEY || null,
  nvidiaBaseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  nvidiaModel:   process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-super-120b-a12b',

  // OTP verification — set REQUIRE_OTP=false to skip email verification on register
  // and return a JWT directly (useful during development or soft-launch)
  requireOtp: process.env.REQUIRE_OTP !== 'false',

  // SMTP / Nodemailer — leave smtpHost unset to disable email sending
  smtpHost:      process.env.SMTP_HOST     || null,
  smtpPort:      parseInt(process.env.SMTP_PORT || '587', 10),
  smtpSecure:    process.env.SMTP_SECURE   === 'true', // true = port 465 (SSL), false = 587 (STARTTLS)
  smtpUser:      process.env.SMTP_USER     || null,
  smtpPass:      process.env.SMTP_PASS     || null,
  emailFrom:     process.env.EMAIL_FROM    || 'no-reply@example.com',
  emailFromName: process.env.EMAIL_FROM_NAME || 'My App',

  // Paystack — checkout is initialized and verified server-side
  paystackSecretKey:  process.env.PAYSTACK_SECRET_KEY || null,
  paystackPublicKey:  process.env.PAYSTACK_PUBLIC_KEY || null,
  paystackCallbackUrl: process.env.PAYSTACK_CALLBACK_URL
    || `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/dashboard/subscription`,
};

export default config;
