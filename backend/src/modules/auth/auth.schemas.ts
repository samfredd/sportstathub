export const registerSchema = {
  body: {
    type: "object",
    required: ["username", "email", "password"],
    properties: {
      username: {
        type: "string",
        minLength: 3,
        maxLength: 32,
        pattern: "^[a-zA-Z0-9_]+$",
      },
      email: { type: "string", format: "email", maxLength: 254 },
      password: { type: "string", minLength: 12, maxLength: 128 },
    },
    additionalProperties: false,
  },
};

export const verifyOTPSchema = {
  body: {
    type: "object",
    required: ["email", "otp"],
    properties: {
      email: { type: "string", format: "email" },
      otp: { type: "string", minLength: 6, maxLength: 6 }
    }
  }
};

export const loginSchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email", maxLength: 254 },
      password: { type: "string", minLength: 1, maxLength: 128 },
    },
    additionalProperties: false,
  },
};

export const forgotPasswordSchema = {
  body: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", format: "email", maxLength: 254 },
    },
    additionalProperties: false,
  },
};

export const resetPasswordSchema = {
  body: {
    type: "object",
    required: ["email", "otp", "password"],
    properties: {
      email: { type: "string", format: "email", maxLength: 254 },
      otp: { type: "string", minLength: 6, maxLength: 6, pattern: "^\\d{6}$" },
      password: { type: "string", minLength: 12, maxLength: 128 },
    },
    additionalProperties: false,
  },
};
