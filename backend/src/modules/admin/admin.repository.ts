export function createAdminRepository(db) {

  // ─── STATS ────────────────────────────────────────────────
  async function getDashboardStats() {
    const [users, predictions, subs, recentUsers, recentPredictions] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE is_verified) AS verified,
                       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_this_week
                FROM users`),
      db.query(`SELECT COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE status = 'open') AS open,
                       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS this_week
                FROM predictions`),
      db.query(`SELECT COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE status = 'active') AS active,
                       COUNT(*) FILTER (WHERE plan = 'pro') AS pro,
                       COUNT(*) FILTER (WHERE plan = 'enterprise') AS enterprise
                FROM subscriptions`),
      db.query(`SELECT id, username, email, role, is_verified, avatar_url, created_at
                FROM users ORDER BY created_at DESC LIMIT 5`),
      db.query(`SELECT p.id, p.sport, p.match_data, p.prediction, p.status, p.is_premium, p.created_at,
                       u.username AS creator_name
                FROM predictions p
                LEFT JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC LIMIT 5`),
    ]);

    return {
      users: users.rows[0],
      predictions: predictions.rows[0],
      subscriptions: subs.rows[0],
      recentUsers: recentUsers.rows,
      recentPredictions: recentPredictions.rows,
    };
  }

  // ─── USERS ────────────────────────────────────────────────
  async function findAllUsers({ limit = 20, offset = 0, search = '', status = '' } = {}) {
    const searchPattern = `%${search}%`;
    const params: any[] = [search, searchPattern, limit, offset];
    let statusFilter = '';
    if (status) {
      params.push(status);
      statusFilter = `AND u.status = $${params.length}`;
    }
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.is_verified, u.avatar_url,
              u.oauth_provider, u.created_at, u.updated_at,
              s.plan AS subscription_plan, s.status AS subscription_status
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       WHERE ($1 = '' OR u.username ILIKE $2 OR u.email ILIKE $2)
       ${statusFilter}
       ORDER BY u.created_at DESC
       LIMIT $3 OFFSET $4`,
      params
    );
    return rows;
  }

  async function countUsers(search = '', status = '') {
    const searchPattern = `%${search}%`;
    const params: any[] = [search, searchPattern];
    let statusFilter = '';
    if (status) {
      params.push(status);
      statusFilter = `AND status = $${params.length}`;
    }
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM users
       WHERE ($1 = '' OR username ILIKE $2 OR email ILIKE $2)
       ${statusFilter}`,
      params
    );
    return parseInt(rows[0].count, 10);
  }

  async function findUserById(id) {
    const { rows } = await db.query(
      `SELECT u.*, s.plan AS subscription_plan, s.status AS subscription_status
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       WHERE u.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async function updateUser(id, { role, is_verified, status }: { role?: string; is_verified?: boolean; status?: string }) {
    const fields = [];
    const values = [];
    let i = 1;
    if (role !== undefined)        { fields.push(`role = $${i++}`);        values.push(role); }
    if (is_verified !== undefined) { fields.push(`is_verified = $${i++}`); values.push(is_verified); }
    if (status !== undefined)      { fields.push(`status = $${i++}`);      values.push(status); }
    if (!fields.length) return null;
    values.push(id);
    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, username, email, role, is_verified, status`,
      values
    );
    return rows[0] ?? null;
  }

  async function deleteUser(id) {
    const { rows } = await db.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] ?? null;
  }

  // ─── BOOKING CODES ────────────────────────────────────────
  async function findAllCodes({ limit = 20, offset = 0, search = '', includeInactive = true } = {}) {
    const searchPattern = `%${search}%`;
    const activeFilter = includeInactive ? '' : 'AND bc.is_active = TRUE';
    const { rows } = await db.query(
      `SELECT bc.*, u.username AS submitter_name
       FROM booking_codes bc
       LEFT JOIN users u ON bc.user_id = u.id
       WHERE ($1 = '' OR bc.code ILIKE $2 OR bc.bookmaker ILIKE $2 OR bc.description ILIKE $2)
       ${activeFilter}
       ORDER BY bc.created_at DESC
       LIMIT $3 OFFSET $4`,
      [search, searchPattern, limit, offset]
    );
    return rows;
  }

  async function countCodes(search = '', includeInactive = true) {
    const searchPattern = `%${search}%`;
    const activeFilter = includeInactive ? '' : 'AND is_active = TRUE';
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM booking_codes
       WHERE ($1 = '' OR code ILIKE $2 OR bookmaker ILIKE $2 OR description ILIKE $2)
       ${activeFilter}`,
      [search, searchPattern]
    );
    return parseInt(rows[0].count, 10);
  }

  async function adminCreateCode({ userId, code, bookmaker, description, totalOdds, stakeType, category, expiresAt }) {
    const { rows } = await db.query(
      `INSERT INTO booking_codes
         (user_id, code, bookmaker, description, total_odds, stake_type, category, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [userId ?? null, code, bookmaker, description ?? null, totalOdds ?? null, stakeType ?? null, category ?? null, expiresAt ?? null]
    );
    return rows[0];
  }

  async function adminUpdateCode(id, { code, bookmaker, description, totalOdds, stakeType, category, isActive, expiresAt }) {
    const fields = [];
    const values = [];
    let i = 1;
    if (code !== undefined)        { fields.push(`code = $${i++}`);        values.push(code); }
    if (bookmaker !== undefined)   { fields.push(`bookmaker = $${i++}`);   values.push(bookmaker); }
    if (description !== undefined) { fields.push(`description = $${i++}`); values.push(description); }
    if (totalOdds !== undefined)   { fields.push(`total_odds = $${i++}`);  values.push(totalOdds); }
    if (stakeType !== undefined)   { fields.push(`stake_type = $${i++}`);  values.push(stakeType); }
    if (category !== undefined)    { fields.push(`category = $${i++}`);    values.push(category); }
    if (isActive !== undefined)    { fields.push(`is_active = $${i++}`);   values.push(isActive); }
    if (expiresAt !== undefined)   { fields.push(`expires_at = $${i++}`);  values.push(expiresAt); }
    if (!fields.length) return null;
    values.push(id);
    const { rows } = await db.query(
      `UPDATE booking_codes SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return rows[0] ?? null;
  }

  async function adminDeleteCode(id) {
    const { rows } = await db.query(
      `DELETE FROM booking_codes WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] ?? null;
  }

  // ─── SUBSCRIPTIONS ────────────────────────────────────────
  async function findAllSubscriptions({ limit = 20, offset = 0, search = '' } = {}) {
    const searchPattern = `%${search}%`;
    const { rows } = await db.query(
      `SELECT s.*, u.username, u.email
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       WHERE ($1 = '' OR u.username ILIKE $2 OR u.email ILIKE $2 OR s.plan ILIKE $2)
       ORDER BY s.created_at DESC
       LIMIT $3 OFFSET $4`,
      [search, searchPattern, limit, offset]
    );
    return rows;
  }

  async function countSubscriptions(search = '') {
    const searchPattern = `%${search}%`;
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       WHERE ($1 = '' OR u.username ILIKE $2 OR u.email ILIKE $2 OR s.plan ILIKE $2)`,
      [search, searchPattern]
    );
    return parseInt(rows[0].count, 10);
  }

  async function createSubscription({ userId, plan, status, expiresAt, notes }) {
    const { rows } = await db.query(
      `INSERT INTO subscriptions (user_id, plan, status, expires_at, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, plan, status ?? 'active', expiresAt ?? null, notes ?? null]
    );
    return rows[0];
  }

  async function updateSubscription(id, { plan, status, expiresAt, notes }) {
    const fields = [];
    const values = [];
    let i = 1;
    if (plan !== undefined)      { fields.push(`plan = $${i++}`);       values.push(plan); }
    if (status !== undefined)    { fields.push(`status = $${i++}`);     values.push(status); }
    if (expiresAt !== undefined) { fields.push(`expires_at = $${i++}`); values.push(expiresAt); }
    if (notes !== undefined)     { fields.push(`notes = $${i++}`);      values.push(notes); }
    if (!fields.length) return null;
    values.push(id);
    const { rows } = await db.query(
      `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return rows[0] ?? null;
  }

  async function deleteSubscription(id) {
    const { rows } = await db.query(
      `DELETE FROM subscriptions WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] ?? null;
  }

  // ─── SUBSCRIPTION PLANS ───────────────────────────────────────
  async function findAllPlans() {
    const { rows } = await db.query(
      `SELECT sp.*,
              (SELECT COUNT(*)::int FROM subscriptions s WHERE s.plan = sp.slug AND s.status = 'active') AS subscriber_count
       FROM subscription_plans sp
       ORDER BY sp.sort_order ASC, sp.created_at ASC`
    );
    return rows;
  }

  async function findPlanById(id) {
    const { rows } = await db.query(
      `SELECT * FROM subscription_plans WHERE id = $1`, [id]
    );
    return rows[0] ?? null;
  }

  async function findPlanBySlug(slug) {
    const { rows } = await db.query(
      `SELECT * FROM subscription_plans WHERE slug = $1`, [slug]
    );
    return rows[0] ?? null;
  }

  async function createPlan({ slug, displayName, description, priceMonthly, priceYearly, features, limits, isActive, isPopular, sortOrder }) {
    const { rows } = await db.query(
      `INSERT INTO subscription_plans
         (slug, display_name, description, price_monthly, price_yearly, currency, features, limits, is_active, is_popular, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [slug, displayName, description ?? null, priceMonthly ?? 0, priceYearly ?? 0,
       'USD', JSON.stringify(features ?? []), JSON.stringify(limits ?? {}),
       isActive ?? true, isPopular ?? false, sortOrder ?? 0]
    );
    return rows[0];
  }

  async function updatePlan(id, payload) {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    const map: Record<string, string> = {
      displayName: 'display_name', description: 'description',
      priceMonthly: 'price_monthly', priceYearly: 'price_yearly',
      isActive: 'is_active', isPopular: 'is_popular', sortOrder: 'sort_order',
    };
    for (const [key, col] of Object.entries(map)) {
      if (payload[key] !== undefined) { fields.push(`${col} = $${i++}`); values.push(payload[key]); }
    }
    if (payload.features !== undefined) { fields.push(`features = $${i++}`); values.push(JSON.stringify(payload.features)); }
    if (payload.limits   !== undefined) { fields.push(`limits = $${i++}`);   values.push(JSON.stringify(payload.limits)); }
    fields.push(`currency = $${i++}`);
    values.push('USD');
    if (!fields.length) return null;
    values.push(id);
    const { rows } = await db.query(
      `UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values
    );
    return rows[0] ?? null;
  }

  async function deletePlan(id) {
    const { rows } = await db.query(
      `DELETE FROM subscription_plans WHERE id = $1 RETURNING id`, [id]
    );
    return rows[0] ?? null;
  }

  // ─── PREDICTIONS ──────────────────────────────────────────────
  async function findAllPredictions({ limit = 20, offset = 0, search = '', status = '' } = {}) {
    const searchPattern = `%${search}%`;
    const statusFilter = status ? `AND p.status = $5` : '';
    const params: any[] = [search, searchPattern, limit, offset];
    if (status) params.push(status);
    const { rows } = await db.query(
      `SELECT p.id, p.sport, p.league, p.match_data, p.prediction, p.status, p.is_premium,
              p.booking_code, p.stats, p.created_at,
              u.username AS creator_name, u.id AS creator_id
       FROM predictions p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE ($1 = '' OR u.username ILIKE $2 OR p.sport ILIKE $2)
       ${statusFilter}
       ORDER BY p.created_at DESC
       LIMIT $3 OFFSET $4`,
      params
    );
    return rows;
  }

  async function countPredictions(search = '', status = '') {
    const searchPattern = `%${search}%`;
    const statusFilter = status ? `AND p.status = $3` : '';
    const params: any[] = [search, searchPattern];
    if (status) params.push(status);
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM predictions p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE ($1 = '' OR u.username ILIKE $2 OR p.sport ILIKE $2)
       ${statusFilter}`,
      params
    );
    return parseInt(rows[0].count, 10);
  }

  async function updatePredictionStatus(id, status) {
    const { rows } = await db.query(
      `UPDATE predictions SET status = $1 WHERE id = $2 RETURNING id, status`,
      [status, id]
    );
    return rows[0] ?? null;
  }

  async function updatePrediction(id, { status, isPremium }) {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (status !== undefined) {
      fields.push(`status = $${i++}`);
      values.push(status);
    }
    if (isPremium !== undefined) {
      fields.push(`is_premium = $${i++}`);
      values.push(isPremium);
    }
    if (!fields.length) return null;
    values.push(id);
    const { rows } = await db.query(
      `UPDATE predictions SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, status, is_premium`,
      values
    );
    return rows[0] ?? null;
  }

  async function adminDeletePrediction(id) {
    const { rows } = await db.query(
      `DELETE FROM predictions WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] ?? null;
  }

  async function createAdminPrediction({ userId, sport, league, matchData, prediction, isPremium = false, tags = [], isTrending = false, fixtureId = null }) {
    const { rows } = await db.query(
      `INSERT INTO predictions
         (user_id, sport, league, match_data, prediction, is_premium, tags, is_trending, status, fixture_id)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, 'open', $9)
       RETURNING *`,
      [
        userId,
        sport,
        JSON.stringify(league),
        JSON.stringify(matchData),
        JSON.stringify(prediction),
        isPremium,
        tags,
        isTrending,
        fixtureId ?? matchData?.fixtureId ?? matchData?.id ?? null,
      ]
    );
    return rows[0];
  }

  // ─── FORUM ────────────────────────────────────────────────────
  async function findAllThreads({ limit = 20, offset = 0, search = '' } = {}) {
    const searchPattern = `%${search}%`;
    const { rows } = await db.query(
      `SELECT ft.id, ft.title, ft.content, ft.category, ft.is_pinned, ft.stats, ft.created_at,
              u.username AS author_name, u.id AS author_id,
              (SELECT COUNT(*)::int FROM comments c
               WHERE c.target_type = 'thread' AND c.target_id = ft.id::text) AS comment_count
       FROM forum_threads ft
       LEFT JOIN users u ON ft.user_id = u.id
       WHERE ($1 = '' OR ft.title ILIKE $2 OR ft.content ILIKE $2 OR u.username ILIKE $2)
       ORDER BY ft.is_pinned DESC, ft.created_at DESC
       LIMIT $3 OFFSET $4`,
      [search, searchPattern, limit, offset]
    );
    return rows;
  }

  async function countThreads(search = '') {
    const searchPattern = `%${search}%`;
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM forum_threads ft
       LEFT JOIN users u ON ft.user_id = u.id
       WHERE ($1 = '' OR ft.title ILIKE $2 OR ft.content ILIKE $2 OR u.username ILIKE $2)`,
      [search, searchPattern]
    );
    return parseInt(rows[0].count, 10);
  }

  async function adminDeleteThread(id) {
    const { rows } = await db.query(
      `DELETE FROM forum_threads WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] ?? null;
  }

  async function findThreadForAdmin(id) {
    const { rows } = await db.query(
      `SELECT ft.*, u.username AS author_name, u.id AS author_id, u.avatar_url AS author_avatar
       FROM forum_threads ft
       LEFT JOIN users u ON ft.user_id = u.id
       WHERE ft.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async function findThreadComments(threadId) {
    const { rows } = await db.query(
      `SELECT c.id, c.content, c.likes, c.created_at, c.parent_id,
              u.id AS user_id, u.username, u.avatar_url
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.target_type = 'thread' AND c.target_id = $1::text
       ORDER BY c.created_at ASC`,
      [threadId]
    );
    return rows;
  }

  async function adminDeleteComment(id) {
    const { rows } = await db.query(
      `DELETE FROM comments WHERE id = $1 RETURNING id, target_type, target_id`,
      [id]
    );
    if (rows[0]?.target_type === 'thread') {
      await db.query(
        `UPDATE forum_threads
         SET stats = jsonb_set(stats, '{replies}', to_jsonb(GREATEST(0, COALESCE((stats->>'replies')::int, 0) - 1)))
         WHERE id = ($1)::int`,
        [rows[0].target_id]
      );
    }
    return rows[0] ?? null;
  }

  async function adminTogglePinThread(id) {
    const { rows } = await db.query(
      `UPDATE forum_threads SET is_pinned = NOT is_pinned WHERE id = $1 RETURNING id, is_pinned`,
      [id]
    );
    return rows[0] ?? null;
  }

  // ─── DAILY STATS (7-day chart) ────────────────────────────────
  async function getDailyStats() {
    const { rows } = await db.query(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
       )
       SELECT
         to_char(d.day, 'Dy') AS day,
         COALESCE(COUNT(DISTINCT u.id) FILTER (WHERE u.created_at::date = d.day), 0)::int AS new_users,
         COALESCE(COUNT(DISTINCT bc.id) FILTER (WHERE bc.created_at::date = d.day), 0)::int AS new_codes,
         COALESCE(COUNT(DISTINCT p.id) FILTER (WHERE p.created_at::date = d.day), 0)::int AS new_predictions
       FROM days d
       LEFT JOIN users u ON u.created_at::date = d.day
       LEFT JOIN booking_codes bc ON bc.created_at::date = d.day
       LEFT JOIN predictions p ON p.created_at::date = d.day
       GROUP BY d.day
       ORDER BY d.day`
    );
    return rows;
  }

  // ─── ADMIN PROFILE ───────────────────────────────────────────
  async function getAdminPassword(id) {
    const { rows } = await db.query(
      'SELECT password FROM users WHERE id = $1 AND role = $2',
      [id, 'admin']
    );
    return rows[0]?.password ?? null;
  }

  async function updateAdminPassword(id, hashedPassword) {
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
  }

  async function findAdminById(id) {
    const { rows } = await db.query(
      `SELECT id, username, email, role, avatar_url, created_at FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async function updateAdminProfile(id, fields: { username?: string; email?: string }) {
    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (fields.username !== undefined) { updates.push(`username = $${i++}`); values.push(fields.username); }
    if (fields.email !== undefined)    { updates.push(`email = $${i++}`);    values.push(fields.email); }
    if (!updates.length) return null;
    values.push(id);
    const { rows } = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, username, email, role`,
      values
    );
    return rows[0] ?? null;
  }

  // ─── FEATURE FLAGS ───────────────────────────────────────────
  async function findAllFeatureFlags() {
    const { rows } = await db.query(
      `SELECT id, key, name, description, required_plan, is_enabled, created_at, updated_at
       FROM feature_flags
       ORDER BY CASE required_plan WHEN 'enterprise' THEN 0 WHEN 'pro' THEN 1 ELSE 2 END, key ASC`
    );
    return rows;
  }

  async function updateFeatureFlag(key: string, { required_plan, is_enabled }: { required_plan?: string; is_enabled?: boolean }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (required_plan !== undefined) { fields.push(`required_plan = $${i++}`); values.push(required_plan); }
    if (is_enabled    !== undefined) { fields.push(`is_enabled = $${i++}`);    values.push(is_enabled); }
    if (!fields.length) return null;
    fields.push(`updated_at = NOW()`);
    values.push(key);
    const { rows } = await db.query(
      `UPDATE feature_flags SET ${fields.join(', ')} WHERE key = $${i} RETURNING *`,
      values
    );
    return rows[0] ?? null;
  }

  // ─── AUDIT LOG ────────────────────────────────────────────
  async function createAuditLog({ adminId, action, targetType, targetId, metadata }) {
    await db.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, action, targetType ?? null, targetId ?? null, metadata ? JSON.stringify(metadata) : null]
    );
  }

  async function getAuditLogs({ limit = 50, offset = 0 } = {}) {
    const { rows } = await db.query(
      `SELECT al.*, u.username AS admin_name
       FROM admin_logs al
       LEFT JOIN users u ON al.admin_id = u.id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  }

  async function getAuditLogsByAdmin(adminId, { limit = 20, offset = 0 } = {}) {
    const { rows } = await db.query(
      `SELECT al.*, u.username AS admin_name
       FROM admin_logs al
       LEFT JOIN users u ON al.admin_id = u.id
       WHERE al.admin_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [adminId, limit, offset]
    );
    return rows;
  }

  // ─── CREATOR LEADERBOARD ─────────────────────────────────────
  async function getCreatorLeaderboard() {
    try {
      const { rows } = await db.query(
        `SELECT u.id, u.username, u.email, u.avatar_url, u.status, u.created_at,
                COALESCE(ps.total, 0)          AS total_predictions,
                COALESCE(ps.won, 0)            AS won,
                COALESCE(ps.lost, 0)           AS lost,
                COALESCE(ps.avg_odds, 0)       AS avg_odds,
                COALESCE(fc.followers, 0)      AS followers
         FROM users u
         LEFT JOIN (
           SELECT user_id,
                  COUNT(*) AS total,
                  SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won,
                  SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost,
                  ROUND(AVG(CASE WHEN prediction->>'odds' IS NOT NULL THEN (prediction->>'odds')::numeric END), 2) AS avg_odds
           FROM predictions
           GROUP BY user_id
         ) ps ON ps.user_id = u.id
         LEFT JOIN (
           SELECT creator_id, COUNT(*) AS followers
           FROM follows
           GROUP BY creator_id
         ) fc ON fc.creator_id = u.id
         WHERE u.role = 'creator'
         ORDER BY followers DESC, total_predictions DESC`
      );
      return rows;
    } catch (err: any) {
      // follows table may not exist yet — retry without it
      const { rows } = await db.query(
        `SELECT u.id, u.username, u.email, u.avatar_url, u.status, u.created_at,
                COALESCE(ps.total, 0)    AS total_predictions,
                COALESCE(ps.won, 0)      AS won,
                COALESCE(ps.lost, 0)     AS lost,
                COALESCE(ps.avg_odds, 0) AS avg_odds,
                0                        AS followers
         FROM users u
         LEFT JOIN (
           SELECT user_id,
                  COUNT(*) AS total,
                  SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won,
                  SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost,
                  ROUND(AVG(CASE WHEN prediction->>'odds' IS NOT NULL THEN (prediction->>'odds')::numeric END), 2) AS avg_odds
           FROM predictions
           GROUP BY user_id
         ) ps ON ps.user_id = u.id
         WHERE u.role = 'creator'
         ORDER BY total_predictions DESC`
      );
      return rows;
    }
  }

  // ─── FILTERED AUDIT LOGS ─────────────────────────────────────
  async function getFilteredAuditLogs({ limit = 50, offset = 0, action = undefined, adminId = undefined, dateFrom = undefined, dateTo = undefined }: { limit?: number; offset?: number; action?: string; adminId?: number; dateFrom?: string; dateTo?: string } = {}) {
    const conditions: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (action)   { conditions.push(`al.action = $${i++}`);                        values.push(action); }
    if (adminId)  { conditions.push(`al.admin_id = $${i++}`);                      values.push(adminId); }
    if (dateFrom) { conditions.push(`al.created_at >= $${i++}`);                   values.push(dateFrom); }
    if (dateTo)   { conditions.push(`al.created_at <= $${i++}`);                   values.push(dateTo); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit, offset);
    const { rows } = await db.query(
      `SELECT al.*, u.username AS admin_name
       FROM admin_logs al
       LEFT JOIN users u ON al.admin_id = u.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      values
    );
    return rows;
  }

  async function countFilteredAuditLogs({ action = undefined, adminId = undefined, dateFrom = undefined, dateTo = undefined }: { action?: string; adminId?: number; dateFrom?: string; dateTo?: string } = {}) {
    const conditions: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (action)   { conditions.push(`action = $${i++}`);                values.push(action); }
    if (adminId)  { conditions.push(`admin_id = $${i++}`);              values.push(adminId); }
    if (dateFrom) { conditions.push(`created_at >= $${i++}`);           values.push(dateFrom); }
    if (dateTo)   { conditions.push(`created_at <= $${i++}`);           values.push(dateTo); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM admin_logs ${where}`,
      values
    );
    return parseInt(rows[0].count, 10);
  }

  // ─── BULK USER OPERATIONS ────────────────────────────────────
  async function bulkUpdateUsers(ids: number[], patch: { status?: string; role?: string }) {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (patch.status !== undefined) { fields.push(`status = $${i++}`); values.push(patch.status); }
    if (patch.role   !== undefined) { fields.push(`role = $${i++}`);   values.push(patch.role); }
    if (!fields.length) return [];
    values.push(ids);
    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ANY($${i}::int[]) RETURNING id, username, status, role`,
      values
    );
    return rows;
  }

  async function bulkDeleteUsers(ids: number[]) {
    const { rows } = await db.query(
      `DELETE FROM users WHERE id = ANY($1::int[]) AND role != 'admin' RETURNING id`,
      [ids]
    );
    return rows;
  }

  // ─── SUBSCRIPTION FUNNEL ─────────────────────────────────────
  async function getSubscriptionFunnel() {
    const [total, pro, newUsers, newSubs] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM users`),
      db.query(`SELECT COUNT(*) FROM subscriptions WHERE plan = 'pro' AND status = 'active'`),
      db.query(`SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days'`),
      db.query(`SELECT COUNT(*) FROM subscriptions WHERE created_at > NOW() - INTERVAL '30 days'`),
    ]);
    const totalUsers        = parseInt(total.rows[0].count, 10);
    const proUsers          = parseInt(pro.rows[0].count, 10);
    const newUsersThisWeek  = parseInt(newUsers.rows[0].count, 10);
    const newSubsThisMonth  = parseInt(newSubs.rows[0].count, 10);
    return {
      totalUsers,
      proUsers,
      freeUsers: totalUsers - proUsers,
      newUsersThisWeek,
      newSubsThisMonth,
    };
  }

  return {
    getDashboardStats, getDailyStats,
    findAllUsers, countUsers, findUserById, updateUser, deleteUser,
    findAllCodes, countCodes, adminCreateCode, adminUpdateCode, adminDeleteCode,
    findAllSubscriptions, countSubscriptions, createSubscription, updateSubscription, deleteSubscription,
    findAllPlans, findPlanById, findPlanBySlug, createPlan, updatePlan, deletePlan,
    findAllPredictions, countPredictions, updatePredictionStatus, updatePrediction, adminDeletePrediction, createAdminPrediction,
    findAllThreads, countThreads, adminDeleteThread,
    findThreadForAdmin, findThreadComments, adminDeleteComment, adminTogglePinThread,
    getAdminPassword, updateAdminPassword, findAdminById, updateAdminProfile,
    createAuditLog, getAuditLogs, getAuditLogsByAdmin,
    getFilteredAuditLogs, countFilteredAuditLogs,
    findAllFeatureFlags, updateFeatureFlag,
    getCreatorLeaderboard,
    bulkUpdateUsers, bulkDeleteUsers,
    getSubscriptionFunnel,
  };
}
