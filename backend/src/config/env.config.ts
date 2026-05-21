import dotenv from "dotenv";

dotenv.config();

const config = {
  port: Number(process.env.PORT || 4000),
  secretKey: process.env.SECRET_KEY,
  databaseUrl: process.env.DATABASE_URL,
  jwtExpiration: parseInt(process.env.JWT_EXPIRATION, 10) || 3600,
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

  // Ollama — containerised LLM inference for AI match predictions
  // Production: docker compose up ollama && docker exec ollama ollama pull qwen2.5:1.5b
  ollamaUrl:   process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://ollama:11434',
  ollamaModel: process.env.OLLAMA_MODEL    || 'qwen2.5:0.5b',

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
