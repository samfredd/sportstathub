const COLORS = [
  'from-purple-500 to-purple-700',
  'from-blue-500 to-blue-700',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-600',
  'from-sky-500 to-cyan-600',
];

function initials(name = '') {
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'U';
}

export function mapUserToCreator(row: any = {}) {
  const name = row.username || row.email?.split('@')[0] || 'Creator';
  const id = String(row.user_id ?? row.id ?? row.creator_id ?? '');
  const numeric = Number.parseInt(id, 10);
  const badge = row.role === 'admin' ? 'elite' : row.role === 'creator' ? 'verified' : null;

  return {
    id,
    name,
    username: name,
    avatar: row.avatar_url ?? null,
    initials: initials(name),
    bio: row.bio ?? 'Sports analyst sharing data-backed tips and discussion.',
    badge,
    badgeLabel: badge === 'elite' ? 'Elite' : badge === 'verified' ? 'Verified' : null,
    stats: {
      totalPredictions: Number(row.total_predictions ?? 0),
      winRate: Number(row.win_rate ?? 0),
      followers: Number(row.followers ?? 0),
      following: Number(row.following ?? 0),
      earnings: Number(row.earnings ?? 0),
      currentStreak: Number(row.current_streak ?? 0),
      monthlyWins: Number(row.monthly_wins ?? 0),
      monthlyTotal: Number(row.monthly_total ?? 0),
    },
    sports: row.sports ?? ['Football'],
    joinDate: row.created_at ?? new Date().toISOString(),
    verified: Boolean(row.is_verified),
    avatarColor: COLORS[Math.abs(Number.isNaN(numeric) ? name.length : numeric) % COLORS.length],
  };
}

export function mapPrediction(row: any) {
  return {
    id: String(row.id),
    sport: row.sport,
    league: row.league,
    match: row.match_data,
    prediction: row.prediction,
    creator: mapUserToCreator(row),
    bookingCode: row.booking_code,
    status: row.status,
    stats: row.stats ?? { likes: 0, comments: 0, views: 0, shares: 0 },
    isTrending: row.is_trending,
    isPremium: row.is_premium,
    tags: row.tags ?? [],
    timestamp: row.created_at,
  };
}

export function mapThread(row: any) {
  return {
    id: String(row.id),
    category: row.category,
    title: row.title,
    content: row.content,
    author: mapUserToCreator(row),
    stats: row.stats ?? { replies: 0, views: 0, likes: 0 },
    tags: row.tags ?? [],
    isPinned: row.is_pinned,
    timestamp: row.created_at,
    lastReply: row.last_reply_at,
  };
}

export function mapComment(row: any) {
  return {
    id: String(row.id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    author: row.author ?? mapUserToCreator(row),
    content: row.content,
    likes: row.likes ?? 0,
    timestamp: row.created_at,
    replies: [],
  };
}

export function nestComments(rows: any[]) {
  const byId = new Map(rows.map(row => {
    const comment = mapComment(row);
    return [comment.id, comment];
  }));
  const roots: any[] = [];

  for (const comment of byId.values()) {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId)!.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return roots;
}
