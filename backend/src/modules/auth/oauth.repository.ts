/**
 * OAuth Repository — DB queries specific to OAuth-authenticated users.
 *
 * Required schema additions (run as a migration before deploying):
 *
 *   ALTER TABLE users
 *     ADD COLUMN IF NOT EXISTS google_id   VARCHAR(255) UNIQUE,
 *     ADD COLUMN IF NOT EXISTS avatar_url  TEXT,
 *     ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(32),
 *     ALTER COLUMN password DROP NOT NULL;
 *
 * Rationale:
 *   - password becomes nullable so OAuth-only users have no hash stored
 *   - google_id UNIQUE prevents two accounts being linked to the same Google profile
 *   - oauth_provider tracks which IdP created the account for future multi-provider support
 */
export function createOAuthRepository(db) {

  /**
   * Find a user by their Google account ID.
   * Faster lookup than by email for returning OAuth users — avoids a table scan
   * on email when google_id has its own index.
   */
  async function findUserByGoogleId(googleId) {
    const { rows } = await db.query(
      `SELECT id, username, email, role, status, is_verified, created_at, avatar_url
       FROM users
       WHERE google_id = $1`,
      [googleId]
    );
    return rows[0] ?? null;
  }

  /**
   * Upsert an OAuth user.
   *
   * Three scenarios handled by a single query:
   *
   *   1. New user (no row with this email)
   *      → INSERT with is_verified = TRUE (Google already verified the email)
   *
   *   2. Existing password-based user with same email
   *      → Link their Google account: set google_id + avatar_url, mark verified
   *         COALESCE keeps an existing google_id in place to prevent overwriting
   *         if somehow two different Google profiles share the same email.
   *
   *   3. Returning OAuth user (google_id already set, same email)
   *      → UPDATE avatar_url in case their profile picture changed
   *
   * The RETURNING clause means we never need a second SELECT.
   */
  async function upsertOAuthUser({ googleId, email, username, avatarUrl }) {
    const { rows } = await db.query(
      `INSERT INTO users (google_id, email, username, avatar_url, role, is_verified, oauth_provider)
       VALUES ($1, $2, $3, $4, 'user', TRUE, 'google')
       ON CONFLICT (email) DO UPDATE SET
         google_id      = COALESCE(users.google_id, EXCLUDED.google_id),
         avatar_url     = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
         oauth_provider = COALESCE(users.oauth_provider, EXCLUDED.oauth_provider),
         is_verified    = TRUE
       RETURNING id, username, email, role, status, is_verified, created_at, avatar_url`,
      [googleId, email, username, avatarUrl]
    );
    return rows[0];
  }

  return { findUserByGoogleId, upsertOAuthUser };
}
