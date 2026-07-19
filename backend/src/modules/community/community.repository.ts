export function createCommunityRepository(db) {
  const userColumns = `
    u.id AS user_id, u.username, u.email, u.role, u.avatar_url, u.is_verified, u.created_at AS user_created_at
  `;

  async function notifyMentions(client: any, actorUserId: number, usernames: string[], link: string, contentType: string, contentId: number) {
    if (!usernames.length) return;
    await client.query(
      `INSERT INTO notifications(user_id,actor_user_id,category,title,body,link,dedupe_key,metadata)
       SELECT u.id,$1,'mentions','You were mentioned',$2,$3,$4 || u.id,$5::jsonb
       FROM users u
       WHERE LOWER(u.username)=ANY($6::text[]) AND u.id<>$1 AND u.status='active'
         AND COALESCE((SELECT mentions FROM notification_preferences WHERE user_id=u.id),TRUE)
         AND NOT EXISTS(SELECT 1 FROM user_relationships WHERE actor_user_id=u.id AND target_user_id=$1 AND relationship_type='block')
       ON CONFLICT(user_id,dedupe_key) DO NOTHING`,
      [actorUserId,'A community post mentioned you.',link,`mention:${contentType}:${contentId}:`,
       JSON.stringify({contentType,contentId}),usernames]);
  }

  async function listPredictions({ sport, status, market, league, date, creatorId, creatorRole, limit = 50, cursorData, pagination }: any = {}) {
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
    if (cursorData) {
      values.push(cursorData.createdEpoch,cursorData.id);
      where.push(`(EXTRACT(EPOCH FROM p.created_at),p.id) < ($${values.length-1}::numeric,$${values.length}::int)`);
    }

    values.push(pagination === 'cursor' ? limit + 1 : limit);
    const { rows } = await db.query(
      `SELECT p.*, EXTRACT(EPOCH FROM p.created_at)::text AS cursor_epoch, ${userColumns}
       FROM predictions p
       LEFT JOIN users u ON u.id = p.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY p.created_at DESC,p.id DESC
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
        (user_id, sport, league, match_data, prediction, booking_code, status, stats, tags, is_trending, is_premium, fixture_id,
         schema_version,published_at,match_start_at,lock_at)
       VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8,$9,$10,$11,$12,NOW(),$13,$13)
       RETURNING *`,
      [
        userId,
        payload.sport ?? 'Football',
        JSON.stringify(payload.league),
        JSON.stringify(payload.match),
        JSON.stringify(payload.prediction),
        payload.bookingCode ? JSON.stringify(payload.bookingCode) : null,
        JSON.stringify({ likes: 0, comments: 0, views: 0, shares: 0 }),
        payload.tags ?? [],
        Boolean(payload.isTrending),
        Boolean(payload.isPremium),
        // Fixture id enables automatic settlement. Accept it from the payload or
        // fall back to a fixtureId nested in the match object.
        payload.fixtureId ?? payload.match?.fixtureId ?? payload.match?.id ?? null,
        payload.schemaVersion ?? 1,
        payload.match?.date ?? null,
      ]
    );
    return findPredictionById(rows[0].id);
  }

  async function listCreators({ limit = 50, pagination, cursorData }: any = {}) {
    const values: any[] = [];
    const cursorFilter = cursorData
      ? `WHERE (total_predictions,EXTRACT(EPOCH FROM created_at),user_id)<($1::int,$2::numeric,$3::int)` : '';
    if (cursorData) values.push(cursorData.totalPredictions,cursorData.createdEpoch,cursorData.id);
    values.push(pagination === 'cursor' ? limit + 1 : limit);
    const { rows } = await db.query(
      `WITH creators AS (SELECT u.id AS user_id, u.username, u.email, u.role, u.avatar_url, u.is_verified, u.created_at,
              COUNT(p.id)::int AS total_predictions,
              COALESCE(ROUND(
                100.0 * COUNT(*) FILTER (WHERE p.status = 'won') / NULLIF(COUNT(*) FILTER (WHERE p.status IN ('won','lost')), 0),
                1
              ), 0)::float AS win_rate
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       WHERE u.role IN ('creator', 'admin')
       GROUP BY u.id)
       SELECT *,EXTRACT(EPOCH FROM created_at)::text AS cursor_epoch FROM creators
       ${cursorFilter}
       ORDER BY total_predictions DESC,created_at DESC,user_id DESC LIMIT $${values.length}`,
      values
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

  async function listThreads({ category, search, sort = 'latest', limit = 50, viewerId, cursorData, pagination }: any = {}) {
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
    where.push(`ft.visibility_status = 'visible' AND ft.deleted_at IS NULL`);
    if (viewerId) {
      values.push(Number(viewerId));
      where.push(`NOT EXISTS (SELECT 1 FROM user_relationships ur
        WHERE ur.actor_user_id=$${values.length} AND ur.target_user_id=ft.user_id
          AND ur.relationship_type IN ('block','mute'))`);
    }
    if (cursorData) {
      values.push(Boolean(cursorData.pinned),cursorData.lastReplyEpoch,cursorData.id);
      where.push(`(ft.is_pinned,EXTRACT(EPOCH FROM ft.last_reply_at),ft.id) < ($${values.length-2}::boolean,$${values.length-1}::numeric,$${values.length}::int)`);
    }

    const order = sort === 'hot'
      ? `(ft.stats->>'views')::int DESC`
      : sort === 'top'
        ? `(ft.stats->>'likes')::int DESC`
        : `ft.last_reply_at DESC`;

    values.push(pagination === 'cursor' ? limit + 1 : limit);
    const { rows } = await db.query(
      `SELECT ft.*, EXTRACT(EPOCH FROM ft.last_reply_at)::text AS cursor_reply_epoch, ${userColumns}
       FROM forum_threads ft
       LEFT JOIN users u ON u.id = ft.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY ft.is_pinned DESC, ${order},ft.id DESC
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
       WHERE ft.id = $1 AND ft.visibility_status='visible' AND ft.deleted_at IS NULL`,
      [Number(id)]
    );
    return rows[0] ?? null;
  }

  async function createThread(userId, payload) {
    const id = await db.transact(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO forum_threads (user_id, category, title, content, tags)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [userId,payload.category,payload.title,payload.content,payload.tags??[]]);
      await notifyMentions(client,userId,payload.mentionUsernames??[],`/forum/${rows[0].id}`,'thread',rows[0].id);
      return rows[0].id;
    });
    return findThreadById(id);
  }

  async function listComments({ targetType, targetId, viewerId, cursorData, pagination, limit = 100 }) {
    const values: any[] = [targetType, String(targetId)];
    const relationshipFilter = viewerId
      ? `AND NOT EXISTS (SELECT 1 FROM user_relationships ur WHERE ur.actor_user_id=$3
           AND ur.target_user_id=c.user_id AND ur.relationship_type IN ('block','mute'))` : '';
    if (viewerId) values.push(Number(viewerId));
    const cursorFilter = cursorData ? `AND (EXTRACT(EPOCH FROM c.created_at),c.id)>($${values.length+1}::numeric,$${values.length+2}::int)` : '';
    if(cursorData) values.push(cursorData.createdEpoch,cursorData.id);
    values.push(pagination === 'cursor' ? limit + 1 : limit);
    const { rows } = await db.query(
      `SELECT c.*, EXTRACT(EPOCH FROM c.created_at)::text AS cursor_epoch, ${userColumns}
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.target_type = $1 AND c.target_id = $2
         AND c.visibility_status='visible' AND c.deleted_at IS NULL ${relationshipFilter} ${cursorFilter}
       ORDER BY c.created_at ASC,c.id ASC LIMIT $${values.length}`,
      values
    );
    return rows;
  }

  async function createComment(userId, payload, author) {
    return db.transact(async (client) => {
      const numericTargetId = Number(payload.targetId);
      if (!Number.isInteger(numericTargetId)) {
        throw Object.assign(new Error('Invalid comment target'), { statusCode: 400 });
      }
      const targetTable = payload.targetType === 'thread' ? 'forum_threads' : 'predictions';
      const { rowCount: targetCount } = await client.query(
        `SELECT id FROM ${targetTable} WHERE id=$1 FOR UPDATE`, [numericTargetId]);
      if (!targetCount) throw Object.assign(new Error('Comment target not found'), { statusCode: 404 });
      const parentId = payload.parentId ? Number(payload.parentId) : null;
      if (parentId) {
        const { rows: parents } = await client.query(
          `SELECT id,parent_id FROM comments
           WHERE id=$1 AND target_type=$2 AND target_id=$3 FOR UPDATE`,
          [parentId, payload.targetType, String(payload.targetId)]);
        if (!parents[0] || parents[0].parent_id) {
          throw Object.assign(new Error('Invalid parent comment'), { statusCode: 400 });
        }
      }
      const { rows } = await client.query(
        `INSERT INTO comments (target_type,target_id,parent_id,user_id,author,content)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [payload.targetType, String(payload.targetId), parentId, userId,
          author ? JSON.stringify(author) : null, payload.content]);
      if (payload.targetType === 'thread') {
        await client.query(
          `UPDATE forum_threads SET stats=jsonb_set(stats,'{replies}',to_jsonb(COALESCE((stats->>'replies')::int,0)+1)),
             last_reply_at=NOW() WHERE id=$1`, [numericTargetId]);
      } else {
        await client.query(
          `UPDATE predictions SET stats=jsonb_set(stats,'{comments}',to_jsonb(COALESCE((stats->>'comments')::int,0)+1))
           WHERE id=$1`, [numericTargetId]);
      }
      const { rows: recipients } = await client.query(
        payload.parentId
          ? `SELECT user_id FROM comments WHERE id=$1`
          : payload.targetType === 'thread'
            ? `SELECT user_id FROM forum_threads WHERE id=$1`
            : `SELECT user_id FROM predictions WHERE id=$1`,
        [payload.parentId ? Number(payload.parentId) : numericTargetId]);
      const recipientId = recipients[0]?.user_id;
      if (recipientId && Number(recipientId) !== Number(userId)) {
        await client.query(
          `INSERT INTO notifications(user_id,actor_user_id,category,title,body,link,dedupe_key,metadata)
           SELECT $1,$2,'replies','New reply',$3,$4,$5,$6::jsonb
           WHERE COALESCE((SELECT replies FROM notification_preferences WHERE user_id=$1),TRUE)
             AND NOT EXISTS(SELECT 1 FROM user_relationships WHERE actor_user_id=$1 AND target_user_id=$2 AND relationship_type='block')
           ON CONFLICT(user_id,dedupe_key) DO NOTHING`,
          [recipientId, userId, payload.content.slice(0, 240), payload.targetType === 'thread' ? `/forum/${numericTargetId}` : `/predictions/${numericTargetId}`,
            `reply:${rows[0].id}:${recipientId}`, JSON.stringify({ commentId: rows[0].id, targetType: payload.targetType, targetId: numericTargetId })]);
      }
      await notifyMentions(client,userId,payload.mentionUsernames??[],payload.targetType==='thread'?`/forum/${numericTargetId}`:`/predictions/${numericTargetId}`,'comment',rows[0].id);
      return rows[0];
    });
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

  async function searchCommunity(query: string,limit=6) {
    const pattern=`%${query}%`;
    const [creators,predictions,threads]=await Promise.all([
      db.query(`SELECT id,username,display_name,avatar_url FROM users WHERE role IN ('creator','admin') AND status='active' AND (username ILIKE $1 OR display_name ILIKE $1) ORDER BY username,id LIMIT $2`,[pattern,limit]),
      db.query(`SELECT id,sport,league,match_data,prediction FROM predictions WHERE match_data::text ILIKE $1 OR league::text ILIKE $1 OR prediction::text ILIKE $1 ORDER BY created_at DESC,id DESC LIMIT $2`,[pattern,limit]),
      db.query(`SELECT id,title,category,content FROM forum_threads WHERE visibility_status='visible' AND deleted_at IS NULL AND (title ILIKE $1 OR content ILIKE $1 OR $3=ANY(tags)) ORDER BY last_reply_at DESC,id DESC LIMIT $2`,[pattern,limit,query]),
    ]);
    return {creators:creators.rows,predictions:predictions.rows,threads:threads.rows};
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
              COALESCE(fc.followers, 0)::int AS followers,
              COALESCE(COUNT(*) FILTER (WHERE p.status = 'won' AND p.created_at >= date_trunc('month', NOW())), 0)::int AS monthly_wins,
              COALESCE(COUNT(*) FILTER (WHERE p.created_at >= date_trunc('month', NOW())), 0)::int AS monthly_total
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       LEFT JOIN (
         SELECT creator_id, COUNT(*)::int AS followers
         FROM creator_follows GROUP BY creator_id
       ) fc ON fc.creator_id = u.id
       WHERE u.role IN ('creator', 'admin')
       GROUP BY u.id, fc.followers
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

  async function getCreatorPerformance(userId: number) {
    const { rows } = await db.query(
      `WITH decided AS (
         SELECT p.id,p.sport,COALESCE(p.league->>'name','Unknown') AS league,
                COALESCE(p.prediction->>'type','Unknown') AS market,
                (p.prediction->>'confidence')::numeric AS confidence,
                (p.prediction->>'odds')::numeric AS odds,p.status
         FROM predictions p WHERE p.user_id=$1 AND p.status IN ('won','lost','void')
       ), grouped AS (
         SELECT sport,league,market,
           COUNT(*)::int AS sample_size,
           COUNT(*) FILTER(WHERE status='won')::int AS wins,
           COUNT(*) FILTER(WHERE status='lost')::int AS losses,
           COUNT(*) FILTER(WHERE status='void')::int AS voids,
           ROUND(100.0*COUNT(*) FILTER(WHERE status='won')/NULLIF(COUNT(*) FILTER(WHERE status IN('won','lost')),0),2) AS win_rate,
           ROUND(100.0*SUM(CASE WHEN status='won' THEN odds-1 WHEN status='lost' THEN -1 ELSE 0 END)
             /NULLIF(COUNT(*) FILTER(WHERE status IN('won','lost')),0),2) AS unit_roi,
           ROUND(AVG(confidence),2) AS avg_confidence
         FROM decided GROUP BY GROUPING SETS ((sport),(league),(market),())
       ) SELECT *,CASE WHEN sport IS NULL AND league IS NULL AND market IS NULL THEN 'overall'
           WHEN sport IS NOT NULL THEN 'sport' WHEN league IS NOT NULL THEN 'league' ELSE 'market' END AS dimension,
         COALESCE(sport,league,market,'All') AS label,
         ABS(COALESCE(avg_confidence,0)-COALESCE(win_rate,0)) AS calibration_error,
         sample_size<30 AS low_sample_warning
       FROM grouped ORDER BY dimension,label`, [userId]);
    const { rows: calibration } = await db.query(
      `SELECT width_bucket((prediction->>'confidence')::numeric,0,100,10) AS bucket,
         COUNT(*)::int AS sample_size,ROUND(AVG((prediction->>'confidence')::numeric),2) AS avg_confidence,
         ROUND(100.0*COUNT(*) FILTER(WHERE status='won')/NULLIF(COUNT(*) FILTER(WHERE status IN('won','lost')),0),2) AS actual_win_rate
       FROM predictions WHERE user_id=$1 AND status IN('won','lost')
       GROUP BY bucket ORDER BY bucket`, [userId]);
    return { segments: rows, calibration, assumptions: {
      stake: '1 unit per prediction', returns: 'won = decimal odds minus 1; lost = -1; void = 0',
      warningThreshold: 30, disclaimer: 'Historical performance is not a guarantee of future results.',
    } };
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
      await db.query(
        `INSERT INTO notifications(user_id,actor_user_id,category,title,body,link,dedupe_key)
         SELECT $1,$2,'follows','New follower','Someone started following your predictions',$3,$4
         WHERE COALESCE((SELECT follows FROM notification_preferences WHERE user_id=$1),TRUE)
           AND NOT EXISTS(SELECT 1 FROM user_relationships WHERE actor_user_id=$1 AND target_user_id=$2 AND relationship_type='block')
         ON CONFLICT(user_id,dedupe_key) DO NOTHING`,
        [creatorId, followerId, `/creators/${followerId}`, `follow:${followerId}:${creatorId}`]);
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
       LEFT JOIN LATERAL (
         SELECT plan,status,COALESCE(grace_ends_at,expires_at) AS expires_at
         FROM subscriptions
         WHERE user_id=u.id AND status IN ('active','grace')
         ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END,created_at DESC
         LIMIT 1
       ) s ON TRUE
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

  async function createCreatorApplication(userId: number, payload: any) {
    return db.transact(async (client) => {
      const { rows: users } = await client.query(
        `SELECT id,role,display_name,bio FROM users WHERE id=$1 FOR UPDATE`, [userId]);
      const user = users[0];
      if (!user) return null;
      if (!user.display_name || !user.bio) {
        throw Object.assign(new Error('Complete your display name and bio before applying'), { statusCode: 400 });
      }
      const { rows } = await client.query(
        `INSERT INTO creator_applications
         (user_id,terms_version,terms_accepted_at,statement)
         VALUES ($1,$2,NOW(),$3) RETURNING *`,
        [userId, payload.termsVersion, payload.statement ?? null]);
      await client.query(
        `UPDATE users SET role='creator_pending', session_version=session_version+1 WHERE id=$1`, [userId]);
      await client.query(
        `UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()), revoke_reason='creator_application'
         WHERE user_id=$1 AND revoked_at IS NULL`, [userId]);
      return { ...rows[0], role: 'creator_pending' };
    });
  }

  async function getUserPassword(userId: number) {
    const { rows } = await db.query('SELECT password FROM users WHERE id = $1', [userId]);
    return rows[0]?.password ?? null;
  }

  async function updateUserPassword(userId: number, hashedPassword: string) {
    await db.transact(async (client) => {
      await client.query(
        'UPDATE users SET password=$1,session_version=session_version+1 WHERE id=$2', [hashedPassword, userId]);
      await client.query(
        `UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),revoke_reason='password_change'
         WHERE user_id=$1 AND revoked_at IS NULL`, [userId]);
      await client.query(`INSERT INTO notifications(user_id,category,title,body,link,dedupe_key)
        VALUES($1,'security','Password changed','Your password was changed and existing sessions were signed out.','/dashboard/settings',$2)
        ON CONFLICT(user_id,dedupe_key) DO NOTHING`,[userId,`security:password:${Date.now()}`]);
    });
  }

  async function updateContent(user: any, contentType: 'thread'|'comment', id: number, payload: any) {
    const table = contentType === 'thread' ? 'forum_threads' : 'comments';
    return db.transact(async (client) => {
      const { rows } = await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
      const current = rows[0];
      if (!current) return null;
      if (Number(current.user_id) !== Number(user.id) && user.role !== 'admin') {
        throw Object.assign(new Error('You can only edit your own content'), { statusCode: 403 });
      }
      if (current.deleted_at) throw Object.assign(new Error('Deleted content cannot be edited'), { statusCode: 409 });
      await client.query(
        `INSERT INTO content_revisions(content_type,content_id,editor_id,previous_title,previous_content)
         VALUES($1,$2,$3,$4,$5)`, [contentType,id,user.id,current.title ?? null,current.content]);
      const title = contentType === 'thread' ? payload.title : null;
      const { rows: updated } = await client.query(
        contentType === 'thread'
          ? `UPDATE forum_threads SET title=COALESCE($2,title),content=$3,edited_at=NOW() WHERE id=$1 RETURNING *`
          : `UPDATE comments SET content=$3,edited_at=NOW() WHERE id=$1 RETURNING *`,
        [id,title,payload.content]);
      return updated[0];
    });
  }

  async function softDeleteContent(user: any, contentType: 'thread'|'comment', id: number) {
    const table = contentType === 'thread' ? 'forum_threads' : 'comments';
    const { rows } = await db.query(
      `UPDATE ${table} SET deleted_at=NOW(),deleted_by=$2,visibility_status='removed'
       WHERE id=$1 AND (user_id=$2 OR $3='admin') AND deleted_at IS NULL RETURNING *`, [id,user.id,user.role]);
    return rows[0] ?? null;
  }

  async function reportContent(userId: number, input: any) {
    const table = input.contentType === 'thread' ? 'forum_threads' : 'comments';
    const { rows: content } = await db.query(`SELECT id,user_id FROM ${table} WHERE id=$1 AND deleted_at IS NULL`, [input.contentId]);
    if (!content[0]) return null;
    if (Number(content[0].user_id) === Number(userId)) {
      throw Object.assign(new Error('You cannot report your own content'), { statusCode: 400 });
    }
    const { rows } = await db.query(
      `INSERT INTO content_reports(reporter_id,content_type,content_id,reason,details)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(reporter_id,content_type,content_id)
       DO UPDATE SET reason=EXCLUDED.reason,details=EXCLUDED.details RETURNING *`,
      [userId,input.contentType,input.contentId,input.reason,input.details ?? null]);
    return rows[0];
  }

  async function setRelationship(userId: number, targetUserId: number, type: string, enabled: boolean) {
    if (enabled) await db.query(
      `INSERT INTO user_relationships(actor_user_id,target_user_id,relationship_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [userId,targetUserId,type]);
    else await db.query(
      `DELETE FROM user_relationships WHERE actor_user_id=$1 AND target_user_id=$2 AND relationship_type=$3`,
      [userId,targetUserId,type]);
    return { targetUserId, type, enabled };
  }

  async function listModerationQueue(status = 'open', limit = 50) {
    const { rows } = await db.query(
      `SELECT r.*,u.username AS reporter_username FROM content_reports r
       JOIN users u ON u.id=r.reporter_id WHERE ($1='all' OR r.status=$1)
       ORDER BY r.created_at ASC LIMIT $2`, [status,limit]);
    return rows;
  }

  async function moderateContent(moderatorId: number, input: any) {
    return db.transact(async (client) => {
      const { rows: reports } = await client.query(`SELECT * FROM content_reports WHERE id=$1 FOR UPDATE`, [input.reportId]);
      const report = reports[0]; if (!report) return null;
      const table = report.content_type === 'thread' ? 'forum_threads' : 'comments';
      const visibility = input.action === 'restore' || input.action === 'dismiss' ? 'visible'
        : input.action === 'hide' ? 'hidden' : input.action === 'remove' ? 'removed' : null;
      if (visibility) await client.query(
        `UPDATE ${table} SET visibility_status=$2::varchar,deleted_at=CASE WHEN $2::varchar='removed' THEN COALESCE(deleted_at,NOW()) ELSE NULL END,
          deleted_by=CASE WHEN $2::varchar='removed' THEN $3::integer ELSE NULL::integer END WHERE id=$1`, [report.content_id,visibility,moderatorId]);
      const { rows: actions } = await client.query(
        `INSERT INTO moderation_actions(moderator_id,report_id,content_type,content_id,action,reason)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [moderatorId,report.id,report.content_type,report.content_id,input.action,input.reason]);
      await client.query(
        `UPDATE content_reports SET status=$2,assigned_to=$3,resolution=$4,resolved_at=NOW() WHERE id=$1`,
        [report.id,input.action === 'dismiss' ? 'dismissed' : 'resolved',moderatorId,input.reason]);
      const { rows: owners } = await client.query(`SELECT user_id FROM ${table} WHERE id=$1`, [report.content_id]);
      if (owners[0]?.user_id) await client.query(
        `INSERT INTO notifications(user_id,actor_user_id,category,title,body,link,dedupe_key,metadata)
         SELECT $1,$2,'moderation','Moderation decision',$3,'/dashboard/notifications',$4,$5::jsonb
         WHERE COALESCE((SELECT moderation FROM notification_preferences WHERE user_id=$1),TRUE)
         ON CONFLICT(user_id,dedupe_key) DO NOTHING`,
        [owners[0].user_id,moderatorId,input.reason,`moderation:${actions[0].id}`,JSON.stringify({ actionId: actions[0].id, action: input.action })]);
      return actions[0];
    });
  }

  async function appealModeration(userId: number, input: any) {
    const { rows } = await db.query(
      `INSERT INTO moderation_appeals(action_id,appellant_id,statement)
       SELECT $1,$2,$3 FROM moderation_actions ma
       JOIN ${input.contentType === 'thread' ? 'forum_threads' : 'comments'} c
         ON c.id=ma.content_id AND ma.content_type=$4
       WHERE ma.id=$1 AND c.user_id=$2
       ON CONFLICT(action_id,appellant_id) DO NOTHING RETURNING *`,
      [input.actionId,userId,input.statement,input.contentType]);
    return rows[0] ?? null;
  }

  async function resolveAppeal(moderatorId: number,input: any) {
    return db.transact(async(client)=>{
      const {rows}=await client.query(`SELECT a.*,ma.content_type,ma.content_id FROM moderation_appeals a JOIN moderation_actions ma ON ma.id=a.action_id WHERE a.id=$1 AND a.status='open' FOR UPDATE`,[input.appealId]);
      const appeal=rows[0];if(!appeal)return null;
      if(input.decision==='overturned'){
        const table=appeal.content_type==='thread'?'forum_threads':'comments';
        await client.query(`UPDATE ${table} SET visibility_status='visible',deleted_at=NULL,deleted_by=NULL WHERE id=$1`,[appeal.content_id]);
        await client.query(`INSERT INTO moderation_actions(moderator_id,content_type,content_id,action,reason,metadata) VALUES($1,$2,$3,'restore',$4,$5::jsonb)`,[moderatorId,appeal.content_type,appeal.content_id,input.reason,JSON.stringify({appealId:appeal.id})]);
      }
      const {rows:updated}=await client.query(`UPDATE moderation_appeals SET status=$2,reviewed_by=$3,decision_reason=$4,reviewed_at=NOW() WHERE id=$1 RETURNING *`,[appeal.id,input.decision,moderatorId,input.reason]);
      await client.query(`INSERT INTO notifications(user_id,actor_user_id,category,title,body,link,dedupe_key) SELECT $1,$2,'moderation','Appeal decision',$3,'/dashboard/notifications',$4 WHERE COALESCE((SELECT moderation FROM notification_preferences WHERE user_id=$1),TRUE) ON CONFLICT(user_id,dedupe_key) DO NOTHING`,[appeal.appellant_id,moderatorId,input.reason,`appeal:${appeal.id}`]);
      return updated[0];
    });
  }

  async function listNotifications(userId: number, limit = 50) {
    const { rows } = await db.query(
      `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`, [userId,limit]);
    return rows;
  }

  async function markNotificationsRead(userId: number, ids?: number[]) {
    const { rowCount } = ids?.length
      ? await db.query(`UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1 AND id=ANY($2::bigint[])`, [userId,ids])
      : await db.query(`UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1`, [userId]);
    return { updated: rowCount };
  }

  async function getNotificationPreferences(userId: number) {
    const { rows } = await db.query(
      `INSERT INTO notification_preferences(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING *`, [userId]);
    return rows[0];
  }

  async function updateNotificationPreferences(userId: number, input: any) {
    await getNotificationPreferences(userId);
    const allowed = ['replies','mentions','follows','prediction_results','saved_match_starts','billing','moderation'];
    const entries = Object.entries(input).filter(([key]) => allowed.includes(key));
    if (!entries.length) return getNotificationPreferences(userId);
    const sets = entries.map(([key],index) => `${key}=$${index+2}`);
    const { rows } = await db.query(
      `UPDATE notification_preferences SET ${sets.join(',')},updated_at=NOW() WHERE user_id=$1 RETURNING *`,
      [userId,...entries.map(([,value]) => value)]);
    return rows[0];
  }

  async function saveMatch(userId: number,input: any) {
    const {rows}=await db.query(
      `INSERT INTO saved_matches(user_id,fixture_id,sport,starts_at,home_team,away_team,league)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(user_id,sport,fixture_id) DO UPDATE SET starts_at=EXCLUDED.starts_at,
         home_team=EXCLUDED.home_team,away_team=EXCLUDED.away_team,league=EXCLUDED.league,notified_at=NULL
       RETURNING *`,[userId,input.fixtureId,input.sport,input.startsAt,input.homeTeam,input.awayTeam,input.league??null]);
    return rows[0];
  }
  async function listSavedMatches(userId: number) {
    const {rows}=await db.query(`SELECT * FROM saved_matches WHERE user_id=$1 ORDER BY starts_at ASC,id ASC`,[userId]);return rows;
  }
  async function deleteSavedMatch(userId: number,fixtureId: string,sport: string) {
    const {rowCount}=await db.query(`DELETE FROM saved_matches WHERE user_id=$1 AND fixture_id=$2 AND sport=$3`,[userId,fixtureId,sport]);return {deleted:rowCount>0};
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
    searchCommunity,
    findFeatureFlag,
    getLeaderboard,
    getCreatorDashboard,
    getCreatorPerformance,
    getUserDashboard,
    getMe,
    updateProfile,
    createCreatorApplication,
    getUserPassword,
    updateUserPassword,
    togglePredictionLike,
    toggleThreadLike,
    toggleCommentLike,
    toggleFollow,
    isFollowing,
    updateContent,
    softDeleteContent,
    reportContent,
    setRelationship,
    listModerationQueue,
    moderateContent,
    appealModeration,
    resolveAppeal,
    listNotifications,
    markNotificationsRead,
    getNotificationPreferences,
    updateNotificationPreferences,
    saveMatch,listSavedMatches,deleteSavedMatch,
  };
}
