/**
 * Creates or promotes a user to admin role.
 *
 * Usage:
 *   npm run seed-admin -- <email> <password> <username>
 *
 * This is the only supported first-administrator bootstrap. Credentials are
 * required explicitly and are never defaulted or printed.
 */

import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const email    = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
const username = process.argv[4]?.trim().toLowerCase();

if (!email || !password || !username || password.length < 12) {
  console.error('Usage: npm run seed-admin -- <email> <password-of-at-least-12-characters> <username>');
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (username, email, password, role, is_verified, mfa_required)
     VALUES ($1, $2, $3, 'admin', TRUE, TRUE)
     ON CONFLICT DO NOTHING
     RETURNING id, username, email, role`,
    [username, email, hash]
  );

  if (!rows[0]) throw new Error('An account with that email or username already exists; bootstrap will not promote it implicitly');
  console.log('\nAdmin user created; MFA enrollment is required at first login:');
  console.log(`  ID:       ${rows[0].id}`);
  console.log(`  Username: ${rows[0].username}`);
  console.log(`  Email:    ${rows[0].email}`);
  console.log(`  Role:     ${rows[0].role}`);
  console.log('\nLogin at /admin/login to enroll MFA.\n');
} finally {
  await pool.end();
}
