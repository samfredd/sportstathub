export function createCommunityRepository(db) {
  const userColumns = `
    u.id AS user_id, u.username, u.email, u.role, u.avatar_url, u.is_verified, u.created_at AS user_created_at
  `;

  async function listPredictions({ sport, status, market, league, date, creatorId, creatorRole, limit = 50 }: any = {}) {
    const values = [];
    const where = [];

    if (sport && sport !== 'All') {
      values.push(sport);
      where.push(`p.sport = $${values.length}`);
    }
    if (status && status !== 'all') {
      values.push(status);
      where.push(`p.status = $${values.length}`);
    }
    if (market && market !== 'All') {
      values.push(`%${market}%`);
      where.push(`((p.prediction->>'type') ILIKE $${values.length} OR p.tags::text ILIKE $${values.length})`);
    }
    if (league) {
      values.push(`%${league}%`);
      where.push(`(
        (p.league->>'name') ILIKE $${values.length}
        OR (p.match_data->'homeTeam'->>'name') ILIKE $${values.length}
        OR (p.match_data->'awayTeam'->>'name') ILIKE $${values.length}
      )`);
    }
    if (date) {
      values.push(date);
      where.push(`LEFT(p.match_data->>'date', 10) = $${values.length}`);
    }
    if (creatorId) {
      values.push(Number(creatorId));
      where.push(`p.user_id = $${values.length}`);
    }
    if (creatorRole) {
      values.push(creatorRole);
      where.push(`u.role = $${values.length}`);
    }

    values.push(limit);
    const { rows } = await db.query(
      `SELECT p.*, ${userColumns}
       FROM predictions p
       LEFT JOIN users u ON u.id = p.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY p.created_at DESC
       LIMIT $${values.length}`,
      values
    );
    return rows;
  }

  async function findPredictionById(id) {
    const { rows } = await db.query(
      `SELECT p.*, ${userColumns}
       FROM predictions p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [Number(id)]
    );
    return rows[0] ?? null;
  }

  async function createPrediction(userId, payload) {
    const { rows } = await db.query(
      `INSERT INTO predictions
        (user_id, sport, league, match_data, prediction, booking_code, status, stats, tags, is_trending, is_premium, fixture_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        userId,
        payload.sport ?? 'Football',
        JSON.stringify(payload.league),
        JSON.stringify(payload.match),
        JSON.stringify(payload.prediction),
        payload.bookingCode ? JSON.stringify(payload.bookingCode) : null,
        payload.status ?? 'open',
        JSON.stringify(payload.stats ?? { likes: 0, comments: 0, views: 0, shares: 0 }),
        payload.tags ?? [],
        Boolean(payload.isTrending),
        Boolean(payload.isPremium),
        // Fixture id enables automatic settlement. Accept it from the payload or
        // fall back to a fixtureId nested in the match object.
        payload.fixtureId ?? payload.match?.fixtureId ?? payload.match?.id ?? null,
      ]
    );
    return findPredictionById(rows[0].id);
  }

  async function listCreators() {
    const { rows } = await db.query(
      `SELECT u.id AS user_id, u.username, u.email, u.role, u.avatar_url, u.is_verified, u.created_at,
              COUNT(p.id)::int AS total_predictions,
              COALESCE(ROUND(
                100.0 * COUNT(*) FILTER (WHERE p.status = 'won') / NULLIF(COUNT(*) FILTER (WHERE p.status IN ('won','lost')), 0),
                1
              ), 0)::float AS win_rate
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       WHERE u.role IN ('creator', 'admin')
       GROUP BY u.id
       ORDER BY total_predictions DESC, u.created_at DESC`
    );
    return rows;
  }

  async function findCreatorById(id) {
    const { rows } = await db.query(
      `SELECT u.id AS user_id, u.username, u.email, u.role, u.avatar_url, u.is_verified, u.created_at,
              COUNT(p.id)::int AS total_predictions,
              COALESCE(ROUND(
                100.0 * COUNT(*) FILTER (WHERE p.status = 'won') / NULLIF(COUNT(*) FILTER (WHERE p.status IN ('won','lost')), 0),
                1
              ), 0)::float AS win_rate
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       WHERE u.id = $1 AND u.role IN ('creator', 'admin')
       GROUP BY u.id`,
      [Number(id)]
    );
    return rows[0] ?? null;
  }

  async function listThreads({ category, search, sort = 'latest', limit = 50 }: any = {}) {
    const values = [];
    const where = [];

    if (category && category !== 'all') {
      values.push(category);
      where.push(`ft.category = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      where.push(`(ft.title ILIKE $${values.length} OR ft.content ILIKE $${values.length})`);
    }

    const order = sort === 'hot'
      ? `(ft.stats->>'views')::int DESC`
      : sort === 'top'
        ? `(ft.stats->>'likes')::int DESC`
        : `ft.last_reply_at DESC`;

    values.push(limit);
    const { rows } = await db.query(
      `SELECT ft.*, ${userColumns}
       FROM forum_threads ft
       LEFT JOIN users u ON u.id = ft.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY ft.is_pinned DESC, ${order}
       LIMIT $${values.length}`,
      values
    );
    return rows;
  }

  async function findThreadById(id) {
    const { rows } = await db.query(
      `SELECT ft.*, ${userColumns}
       FROM forum_threads ft
       LEFT JOIN users u ON u.id = ft.user_id
       WHERE ft.id = $1`,
      [Number(id)]
    );
    return rows[0] ?? null;
  }

  async function createThread(userId, payload) {
    const { rows } = await db.query(
      `INSERT INTO forum_threads (user_id, category, title, content, tags)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [userId, payload.category, payload.title, payload.content, payload.tags ?? []]
    );
    return findThreadById(rows[0].id);
  }

  async function listComments({ targetType, targetId }) {
    const { rows } = await db.query(
      `SELECT c.*, ${userColumns}
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.target_type = $1 AND c.target_id = $2
       ORDER BY c.created_at ASC`,
      [targetType, String(targetId)]
    );
    return rows;
  }

  async function createComment(userId, payload, author) {
    const { rows } = await db.query(
      `INSERT INTO comments (target_type, target_id, parent_id, user_id, author, content)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        payload.targetType,
        String(payload.targetId),
        payload.parentId ? Number(payload.parentId) : null,
        userId,
        author ? JSON.stringify(author) : null,
        payload.content,
      ]
    );

    const numericTargetId = Number(payload.targetId);
    if (payload.targetType === 'thread' && Number.isInteger(numericTargetId)) {
      await db.query(
        `UPDATE forum_threads
         SET stats = jsonb_set(stats, '{replies}', to_jsonb(COALESCE((stats->>'replies')::int, 0) + 1)),
             last_reply_at = NOW()
         WHERE id = $1`,
        [numericTargetId]
      );
    } else if (payload.targetType === 'prediction' && Number.isInteger(numericTargetId)) {
      await db.query(
        `UPDATE predictions
         SET stats = jsonb_set(stats, '{comments}', to_jsonb(COALESCE((stats->>'comments')::int, 0) + 1))
         WHERE id = $1`,
        [numericTargetId]
      );
    }

    return rows[0];
  }

  async function createTrackingEvent(payload) {
    const { rows } = await db.query(
      `INSERT INTO tracking_events
        (tracking_id, event_name, bookmaker, code, affiliate_url, prediction_id, creator_id, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        payload.trackingId ?? null,
        payload.eventName,
        payload.bookmaker ?? null,
        payload.code ?? null,
        payload.affiliateUrl ?? null,
        payload.predictionId ? String(payload.predictionId) : null,
        payload.creatorId ? String(payload.creatorId) : null,
        JSON.stringify(payload),
      ]
    );
    return rows[0];
  }

  async function getPlatformStats() {
    const { rows } = await db.query(
      `SELECT
         COUNT(p.id) FILTER (WHERE p.created_at >= CURRENT_DATE)::int AS tips_today,
         COALESCE(ROUND(
           100.0 * COUNT(p.id) FILTER (WHERE p.status = 'won') /
           NULLIF(COUNT(p.id) FILTER (WHERE p.status IN ('won','lost')), 0),
           1
         ), 0)::float AS win_rate,
         (SELECT COUNT(*)::int FROM tracking_events WHERE event_name = 'code_copy') AS code_copies,
         (SELECT COUNT(*)::int FROM users WHERE role IN ('creator', 'admin')) AS creators,
         (SELECT COUNT(*)::int FROM forum_threads) AS forum_posts
       FROM predictions p`
    );
    return rows[0] ?? {};
  }

  async function findFeatureFlag(key: string) {
    const { rows } = await db.query(
      `SELECT key, required_plan, is_enabled FROM feature_flags WHERE key = $1`,
      [key]
    );
    return rows[0] ?? null;
  }

  async function getLeaderboard() {
    const { rows } = await db.query(
      `SELECT u.id AS user_id, u.username, u.email, u.role, u.avatar_url, u.is_verified, u.created_at,
              COUNT(p.id)::int AS total_predictions,
              COALESCE(ROUND(
                100.0 * COUNT(*) FILTER (WHERE p.status = 'won') / NULLIF(COUNT(*) FILTER (WHERE p.status IN ('won','lost')), 0),
                1
              ), 0)::float AS win_rate,
              COALESCE(SUM((p.stats->>'views')::int), 0)::int AS followers,
              COALESCE(COUNT(*) FILTER (WHERE p.status = 'won' AND p.created_at >= date_trunc('month', NOW())), 0)::int AS monthly_wins,
              COALESCE(COUNT(*) FILTER (WHERE p.created_at >= date_trunc('month', NOW())), 0)::int AS monthly_total
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       WHERE u.role IN ('creator', 'admin')
       GROUP BY u.id
       ORDER BY win_rate DESC, total_predictions DESC, u.created_at DESC
       LIMIT 10`
    );
    return rows;
  }

  async function getCreatorDashboard(userId) {
    const [creator, predictionsResult, weeklyResult, topCodesResult, weeklyChangeResult, followersResult] = await Promise.all([
      findCreatorById(userId),
      db.query(
        `SELECT p.*, ${userColumns}
         FROM predictions p
         LEFT JOIN users u ON u.id = p.user_id
         WHERE p.user_id = $1
         ORDER BY p.created_at DESC
         LIMIT 100`,
        [userId]
      ),
      db.query(
        `WITH days AS (
           SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
         )
         SELECT to_char(days.day, 'Dy') AS day,
                COALESCE(COUNT(te.id) FILTER (WHERE te.event_name IN ('code_copy','bookmaker_open')), 0)::int AS clicks,
                COALESCE(COUNT(te.id) FILTER (WHERE te.event_name = 'conversion'), 0)::int AS conversions
         FROM days
         LEFT JOIN tracking_events te
           ON te.created_at::date = days.day
          AND (
            te.creator_id = $1::text
            OR te.prediction_id IN (SELECT id::text FROM predictions WHERE user_id = $1)
          )
         GROUP BY days.day
         ORDER BY days.day`,
        [userId]
      ),
      db.query(
        `SELECT
           p.id,
           p.booking_code,
           COALESCE((p.booking_code->>'clicks')::int, 0) +
             COALESCE(COUNT(te.id) FILTER (WHERE te.event_name IN ('code_copy','bookmaker_open')), 0)::int AS clicks,
           COALESCE(COUNT(te.id) FILTER (WHERE te.event_name = 'conversion'), 0)::int AS conversions
         FROM predictions p
         LEFT JOIN tracking_events te
           ON te.prediction_id = p.id::text
           OR (p.booking_code->>'trackingId' IS NOT NULL AND te.tracking_id = p.booking_code->>'trackingId')
         WHERE p.user_id = $1
           AND p.booking_code IS NOT NULL
         GROUP BY p.id, p.booking_code
         ORDER BY clicks DESC, p.created_at DESC
         LIMIT 10`,
        [userId]
      ),
      // Week-over-week comparison for clicks and conversions
      db.query(
        `SELECT
           COUNT(*) FILTER (
             WHERE event_name IN ('code_copy','bookmaker_open')
               AND created_at >= CURRENT_DATE - INTERVAL '7 days'
           )::int AS this_clicks,
           COUNT(*) FILTER (
             WHERE event_name = 'conversion'
               AND created_at >= CURRENT_DATE - INTERVAL '7 days'
           )::int AS this_conversions,
           COUNT(*) FILTER (
             WHERE event_name IN ('code_copy','bookmaker_open')
               AND created_at >= CURRENT_DATE - INTERVAL '14 days'
               AND created_at < CURRENT_DATE - INTERVAL '7 days'
           )::int AS prev_clicks,
           COUNT(*) FILTER (
             WHERE event_name = 'conversion'
               AND created_at >= CURRENT_DATE - INTERVAL '14 days'
               AND created_at < CURRENT_DATE - INTERVAL '7 days'
           )::int AS prev_conversions
         FROM tracking_events
         WHERE creator_id = $1::text
            OR prediction_id IN (SELECT id::text FROM predictions WHERE user_id = $1)`,
        [userId]
      ),
      // Followers gained this week
      db.query(
        `SELECT COUNT(*)::int AS followers_gained
         FROM creator_follows
         WHERE creator_id = $1
           AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
        [userId]
      ),
    ]);

    const predictions = predictionsResult.rows;
    const decided = predictions.filter(p => ['won', 'lost'].includes(p.status));
    const wins = predictions.filter(p => p.status === 'won').length;
    const topCodes = topCodesResult.rows.map((row) => {
      const code = row.booking_code ?? {};
      const conversions = Number(row.conversions ?? 0);
      const clicks = Number(row.clicks ?? 0);
      return {
        id: code.trackingId ?? `prediction_${row.id}`,
        bookmaker: code.bookmaker ?? 'Bookmaker',
        code: code.code ?? '',
        clicks,
        conversions,
        successRate: clicks ? Math.round((conversions / clicks) * 100) : 0,
        earnings: conversions * 100,
      };
    });
    const totalClicks = topCodes.reduce((sum, code) => sum + code.clicks, 0);
    const totalConversions = topCodes.reduce((sum, code) => sum + code.conversions, 0);

    const wc = weeklyChangeResult.rows[0] ?? {};
    const thisClicks      = Number(wc.this_clicks ?? 0);
    const thisConversions = Number(wc.this_conversions ?? 0);
    const prevClicks      = Number(wc.prev_clicks ?? 0);
    const prevConversions = Number(wc.prev_conversions ?? 0);

    function pctChange(current: number, prev: number): number {
      if (prev === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prev) / prev) * 100);
    }

    const followersGained = Number(followersResult.rows[0]?.followers_gained ?? 0);

    return {
      creator,
      predictions,
      overview: {
        totalClicks,
        totalConversions,
        estimatedEarnings: totalConversions * 100,
        currency: '$',
        followersGained,
        winRate: decided.length ? Math.round((wins / decided.length) * 1000) / 10 : 0,
        activeCodes: topCodes.length,
        conversionRate: totalClicks ? Math.round((totalConversions / totalClicks) * 1000) / 10 : 0,
        weeklyChange: {
          clicks:      pctChange(thisClicks, prevClicks),
          conversions: pctChange(thisConversions, prevConversions),
          earnings:    pctChange(thisConversions * 100, prevConversions * 100),
          followers:   followersGained,
        },
      },
      chartData: weeklyResult.rows.map(row => ({
        day: row.day,
        clicks: Number(row.clicks ?? 0),
        conversions: Number(row.conversions ?? 0),
      })),
      topCodes,
    };
  }

  async function getUserDashboard(userId) {
    const { rows: subscriptions } = await db.query(
      `SELECT plan, status, started_at, expires_at, notes
       FROM subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    return {
      subscription: subscriptions[0] ?? { plan: 'free', status: 'active', expires_at: null, notes: null },
      savedCodes: [],
    };
  }

  // Toggle a user's like on a piece of content. Inserts the like if absent,
  // removes it if present, and moves the denormalized counter by ±1 (never
  // below 0) in the same transaction. Returns { liked } for the caller.
  async function toggleContentLike(userId: number, contentType: 'prediction' | 'thread' | 'comment', contentId: number) {
    const TABLES = {
      prediction: { sql: `UPDATE predictions SET stats = jsonb_set(stats, '{likes}', to_jsonb(GREATEST(COALESCE((stats->>'likes')::int, 0) + $2, 0))) WHERE id = $1` },
      thread:     { sql: `UPDATE forum_threads SET stats = jsonb_set(stats, '{likes}', to_jsonb(GREATEST(COALESCE((stats->>'likes')::int, 0) + $2, 0))) WHERE id = $1` },
      comment:    { sql: `UPDATE comments SET likes = GREATEST(likes + $2, 0) WHERE id = $1` },
    };

    return db.transact(async (client) => {
      const { rows: inserted } = await client.query(
        `INSERT INTO content_likes (user_id, content_type, content_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, content_type, content_id) DO NOTHING
         RETURNING id`,
        [userId, contentType, Number(contentId)]
      );
      const liked = inserted.length > 0;
      if (!liked) {
        await client.query(
          `DELETE FROM content_likes
           WHERE user_id = $1 AND content_type = $2 AND content_id = $3`,
          [userId, contentType, Number(contentId)]
        );
      }

      const { rowCount } = await client.query(TABLES[contentType].sql, [Number(contentId), liked ? 1 : -1]);
      if (!rowCount) {
        // Content row doesn't exist — abort so the like record rolls back too
        throw Object.assign(new Error('Content not found'), { statusCode: 404 });
      }
      return { liked };
    });
  }

  async function togglePredictionLike(userId: number, id) {
    const { liked } = await toggleContentLike(userId, 'prediction', id);
    const row = await findPredictionById(Number(id));
    return row ? { row, liked } : null;
  }

  async function toggleThreadLike(userId: number, id) {
    const { liked } = await toggleContentLike(userId, 'thread', id);
    const row = await findThreadById(Number(id));
    return row ? { row, liked } : null;
  }

  async function toggleCommentLike(userId: number, id) {
    const { liked } = await toggleContentLike(userId, 'comment', id);
    const { rows } = await db.query(`SELECT * FROM comments WHERE id = $1`, [Number(id)]);
    return rows[0] ? { row: rows[0], liked } : null;
  }

  async function toggleFollow(followerId: number, creatorId: number) {
    const { rows: existing } = await db.query(
      `SELECT id FROM creator_follows WHERE follower_id = $1 AND creator_id = $2`,
      [followerId, creatorId]
    );

    if (existing.length > 0) {
      await db.query(
        `DELETE FROM creator_follows WHERE follower_id = $1 AND creator_id = $2`,
        [followerId, creatorId]
      );
    } else {
      await db.query(
        `INSERT INTO creator_follows (follower_id, creator_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [followerId, creatorId]
      );
    }

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*)::int AS followers FROM creator_follows WHERE creator_id = $1`,
      [creatorId]
    );
    return {
      following: existing.length === 0,
      followers: Number(countRows[0]?.followers ?? 0),
    };
  }

  async function isFollowing(followerId: number, creatorId: number) {
    const { rows } = await db.query(
      `SELECT 1 FROM creator_follows WHERE follower_id = $1 AND creator_id = $2`,
      [followerId, creatorId]
    );
    return rows.length > 0;
  }

  async function getMe(userId: number) {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.avatar_url, u.bio, u.display_name,
              u.is_verified, u.created_at,
              s.plan        AS subscription_plan,
              s.status      AS subscription_status,
              s.expires_at  AS subscription_expires_at
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       WHERE u.id = $1`,
      [userId]
    );
    return rows[0] ?? null;
  }

  async function updateProfile(userId: number, payload: { display_name?: string; bio?: string; avatar_url?: string }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (payload.display_name !== undefined) { fields.push(`display_name = $${i++}`); values.push(payload.display_name); }
    if (payload.bio          !== undefined) { fields.push(`bio = $${i++}`);           values.push(payload.bio); }
    if (payload.avatar_url   !== undefined) { fields.push(`avatar_url = $${i++}`);    values.push(payload.avatar_url); }
    if (!fields.length) return null;
    values.push(userId);
    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, username, email, role, avatar_url, bio, display_name`,
      values
    );
    return rows[0] ?? null;
  }

  async function setUserRole(userId: number, role: string) {
    const { rows } = await db.query(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, username, email, role`,
      [role, userId]
    );
    return rows[0] ?? null;
  }

  async function getUserPassword(userId: number) {
    const { rows } = await db.query('SELECT password FROM users WHERE id = $1', [userId]);
    return rows[0]?.password ?? null;
  }

  async function updateUserPassword(userId: number, hashedPassword: string) {
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
  }

  return {
    listPredictions,
    findPredictionById,
    createPrediction,
    listCreators,
    findCreatorById,
    listThreads,
    findThreadById,
    createThread,
    listComments,
    createComment,
    createTrackingEvent,
    getPlatformStats,
    findFeatureFlag,
    getLeaderboard,
    getCreatorDashboard,
    getUserDashboard,
    getMe,
    updateProfile,
    setUserRole,
    getUserPassword,
    updateUserPassword,
    togglePredictionLike,
    toggleThreadLike,
    toggleCommentLike,
    toggleFollow,
    isFollowing,
  };
}
