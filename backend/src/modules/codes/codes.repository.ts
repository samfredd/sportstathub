export function createCodesRepository(db) {
  async function findAll({ limit = 20, offset = 0, bookmaker }: any = {}) {
    const params = [limit, offset];
    let where = `WHERE bc.is_active = TRUE AND (bc.expires_at IS NULL OR bc.expires_at > NOW())`;

    if (bookmaker) {
      params.unshift(bookmaker);
      where += ` AND bc.bookmaker = $1`;
      // shift the positional params: bookmaker=$1, limit=$2, offset=$3
      const { rows } = await db.query(
        `SELECT bc.*, u.username AS submitter_name
         FROM booking_codes bc
         LEFT JOIN users u ON bc.user_id = u.id
         ${where}
         ORDER BY bc.created_at DESC
         LIMIT $2 OFFSET $3`,
        params
      );
      return rows;
    }

    const { rows } = await db.query(
      `SELECT bc.*, u.username AS submitter_name
       FROM booking_codes bc
       LEFT JOIN users u ON bc.user_id = u.id
       ${where}
       ORDER BY bc.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    return rows;
  }

  async function count({ bookmaker }: any = {}) {
    if (bookmaker) {
      const { rows } = await db.query(
        `SELECT COUNT(*) FROM booking_codes
         WHERE is_active = TRUE
           AND bookmaker = $1
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [bookmaker]
      );
      return parseInt(rows[0].count, 10);
    }
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM booking_codes
       WHERE is_active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())`
    );
    return parseInt(rows[0].count, 10);
  }

  async function findById(id) {
    const { rows } = await db.query(
      `SELECT bc.*, u.username AS submitter_name
       FROM booking_codes bc
       LEFT JOIN users u ON bc.user_id = u.id
       WHERE bc.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async function create({ userId, code, bookmaker, description, totalOdds, stakeType, category, expiresAt }) {
    const { rows } = await db.query(
      `INSERT INTO booking_codes
         (user_id, code, bookmaker, description, total_odds, stake_type, category, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [userId, code, bookmaker, description ?? null, totalOdds ?? null, stakeType ?? null, category ?? null, expiresAt ?? null]
    );
    return rows[0];
  }

  async function deactivate(id) {
    const { rows } = await db.query(
      `UPDATE booking_codes SET is_active = FALSE WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] ?? null;
  }

  async function findByCode(code: string, bookmaker: string) {
    const { rows } = await db.query(
      `SELECT bc.*, u.username AS submitter_name
       FROM booking_codes bc
       LEFT JOIN users u ON bc.user_id = u.id
       WHERE LOWER(bc.code) = LOWER($1) AND LOWER(bc.bookmaker) = LOWER($2) AND bc.is_active = TRUE
       LIMIT 1`,
      [code, bookmaker]
    );
    return rows[0] ?? null;
  }

  async function findSimilarByOdds({ toBookmaker, totalOdds, category, limit = 5 }: any) {
    const params: any[] = [toBookmaker, limit];
    let oddsClause = '';
    let categoryClause = '';

    if (totalOdds != null) {
      const margin = Math.max(totalOdds * 0.15, 1.0);
      params.push(totalOdds - margin, totalOdds + margin);
      oddsClause = `AND bc.total_odds BETWEEN $${params.length - 1} AND $${params.length}`;
    }
    if (category) {
      params.push(category);
      categoryClause = `AND LOWER(bc.category) = LOWER($${params.length})`;
    }

    const { rows } = await db.query(
      `SELECT bc.*, u.username AS submitter_name
       FROM booking_codes bc
       LEFT JOIN users u ON bc.user_id = u.id
       WHERE LOWER(bc.bookmaker) = LOWER($1)
         AND bc.is_active = TRUE
         AND (bc.expires_at IS NULL OR bc.expires_at > NOW())
         ${oddsClause}
         ${categoryClause}
       ORDER BY bc.created_at DESC
       LIMIT $2`,
      params
    );
    return rows;
  }

  return { findAll, count, findById, findByCode, findSimilarByOdds, create, deactivate };
}
