import fp from 'fastify-plugin';
import { forgotPassword, login, register, resetPassword, verifyOTP } from '../../features/auth/controllers/auth.controller.js';
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

async function authRoutes(fastify) {
  fastify.post('/auth/register', { schema: registerSchema }, register);
  fastify.post('/auth/verify-otp', { schema: verifyOTPSchema }, verifyOTP);
  fastify.post('/auth/login', { schema: loginSchema }, login);
  fastify.post('/auth/forgot-password', { schema: forgotPasswordSchema }, forgotPassword);
  fastify.post('/auth/reset-password', { schema: resetPasswordSchema }, resetPassword);
  fastify.post('/auth/admin/register', { schema: adminRegisterSchema }, registerAdmin);
}

export default fp(authRoutes, { name: 'auth-routes', fastify: '5.x' });
