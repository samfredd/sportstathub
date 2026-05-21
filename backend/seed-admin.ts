/**
 * Creates or promotes a user to admin role.
 *
 * Usage:
 *   node seed-admin.js [email] [password] [username]
 *
 * Defaults:
 *   email:    admin@admin.com
 *   password: Admin123!
 *   username: admin
 *
 * If a user with that email already exists their role is promoted to 'admin'
 * and the account is marked as verified. The password is only updated if the
 * account is newly created.
 */

import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const email    = process.argv[2] || 'admin@admin.com';
const password = process.argv[3] || 'Admin123!';
const username = process.argv[4] || 'admin';

try {
  const hash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (username, email, password, role, is_verified)
     VALUES ($1, $2, $3, 'admin', TRUE)
     ON CONFLICT (email)
       DO UPDATE SET role = 'admin', is_verified = TRUE
     RETURNING id, username, email, role`,
    [username, email, hash]
  );

  console.log('\nAdmin user ready:');
  console.log(`  ID:       ${rows[0].id}`);
  console.log(`  Username: ${rows[0].username}`);
  console.log(`  Email:    ${rows[0].email}`);
  console.log(`  Role:     ${rows[0].role}`);
  console.log('\nLogin at /admin/login with the email and password above.\n');
} finally {
  await pool.end();
}
