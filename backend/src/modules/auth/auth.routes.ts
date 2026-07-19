import fp from 'fastify-plugin';
import { forgotPassword, login, logout, refresh, register, resetPassword, verifyOTP } from '../../features/auth/controllers/auth.controller.js';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyOTPSchema } from './auth.schemas.js';
import { registerAdmin } from '../../features/auth/controllers/auth.controller.js';

const adminRegisterSchema = {
  body: {
    type: 'object',
    required: ['username', 'email', 'password', 'inviteKey'],
    properties: {
      username:  { type: 'string', minLength: 3, maxLength: 32, pattern: '^[a-zA-Z0-9_]+$' },
      email:     { type: 'string', format: 'email', maxLength: 254 },
      password:  { type: 'string', minLength: 12, maxLength: 128 },
      inviteKey: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
};

const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
const strictRateLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };

async function authRoutes(fastify) {
  fastify.post('/auth/register',      { schema: registerSchema,       ...authRateLimit   }, register);
  fastify.post('/auth/verify-otp',    { schema: verifyOTPSchema,      ...authRateLimit   }, verifyOTP);
  fastify.post('/auth/login',         { schema: loginSchema,          ...authRateLimit   }, login);
  fastify.post('/auth/forgot-password', { schema: forgotPasswordSchema, ...strictRateLimit }, forgotPassword);
  fastify.post('/auth/reset-password',  { schema: resetPasswordSchema,  ...authRateLimit   }, resetPassword);
  fastify.post('/auth/admin/register',  { schema: adminRegisterSchema,  ...strictRateLimit }, registerAdmin);
  fastify.post('/auth/refresh',         { ...authRateLimit }, refresh);
  fastify.post('/auth/logout', logout);
}

export default fp(authRoutes, { name: 'auth-routes', fastify: '5.x' });
