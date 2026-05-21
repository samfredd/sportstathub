/**
 * PM2 ecosystem — manages the Next.js frontend and Fastify backend.
 * Usage:
 *   pm2 start  ecosystem.config.cjs        # first boot
 *   pm2 reload ecosystem.config.cjs --update-env  # zero-downtime reload
 *   pm2 save                                # persist across reboots
 */
module.exports = {
  apps: [
    // ── Fastify backend ──────────────────────────────────────────────────────
    {
      name:        "backend",
      cwd:         "/var/www/project/backend",
      script:      "dist/server.js",
      interpreter: "node",
      instances:   1,
      exec_mode:   "fork",
      autorestart: true,
      watch:       false,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT:     "4000",
      },
      error_file: "/var/log/pm2/backend-error.log",
      out_file:   "/var/log/pm2/backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },

    // ── Next.js frontend ─────────────────────────────────────────────────────
    {
      name:        "frontend",
      cwd:         "/var/www/project/frontend",
      script:      "node_modules/.bin/next",
      args:        "start -p 3000",
      instances:   1,
      exec_mode:   "fork",
      autorestart: true,
      watch:       false,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT:     "3000",
      },
      error_file: "/var/log/pm2/frontend-error.log",
      out_file:   "/var/log/pm2/frontend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
