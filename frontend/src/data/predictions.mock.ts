// ─── Types ────────────────────────────────────────────────────────────────────

export type CreatorBadge = 'elite' | 'pro' | 'verified';

export interface CreatorStats {
  totalPredictions: number;
  winRate: number;
  followers: number;
  following: number;
  earnings: number;
  currentStreak: number;
  monthlyWins: number;
  monthlyTotal: number;
}

export interface Creator {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  initials: string;
  bio: string;
  badge: CreatorBadge;
  badgeLabel: string;
  stats: CreatorStats;
  sports: string[];
  joinDate: string;
  verified: boolean;
  avatarColor: string;
}

export interface LeagueRef {
  name: string;
  country: string;
  id: number;
}

export interface TeamRef {
  name: string;
  shortName: string;
  form: string[];
}

export interface MatchRef {
  id: string;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  date: string;
  venue: string;
}

export interface PredictionDetail {
  type: string;
  shorthand: string;
  odds: number;
  confidence: number;
  analysis: string;
}

export type PredictionStatus = 'open' | 'won' | 'lost';

export interface BookingCode {
  id: string;
  bookmaker: string;
  code: string;
  clicks: number;
  successRate: number;
  trackingId: string;
  affiliateUrl: string;
  conversionStatus: string | null;
}

export interface PredictionEngagement {
  likes: number;
  comments: number;
  views: number;
  shares: number;
}

export interface Prediction {
  id: string;
  sport: string;
  league: LeagueRef;
  match: MatchRef;
  prediction: PredictionDetail;
  creator: Creator;
  bookingCode: BookingCode;
  status: PredictionStatus;
  stats: PredictionEngagement;
  isTrending: boolean;
  isPremium: boolean;
  tags: string[];
  timestamp: string;
}

export interface ForumAuthor {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  badge: CreatorBadge | null;
}

export interface ForumStats {
  replies: number;
  views: number;
  likes: number;
}

export interface ForumThread {
  id: string;
  category: string;
  title: string;
  content: string;
  author: Creator | ForumAuthor;
  stats: ForumStats;
  tags: string[];
  isPinned: boolean;
  timestamp: string;
  lastReply: string;
}

export interface ForumComment {
  id: string;
  threadId?: string;
  author: ForumAuthor;
  content: string;
  likes: number;
  timestamp: string;
  replies: ForumComment[];
}

export interface DashboardOverview {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  estimatedEarnings: number;
  currency: string;
  winRate: number;
  activeCodes: number;
  followersGained: number;
  weeklyChange: {
    clicks: number;
    conversions: number;
    earnings: number;
    followers: number;
  };
}

export interface ChartDataPoint {
  day: string;
  clicks: number;
  conversions: number;
  earnings: number;
}

export interface TopCode {
  id: string;
  bookmaker: string;
  code: string;
  clicks: number;
  conversions: number;
  earnings: number;
  successRate: number;
}

export interface DashboardStats {
  overview: DashboardOverview;
  chartData: ChartDataPoint[];
  topCodes: TopCode[];
}

export interface ForumCategory {
  id: string;
  label: string;
  count: number;
}

export interface LeaderboardEntry extends Creator {
  rank: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_CREATORS: Creator[] = [
  {
    id: 'c1',
    name: 'KingPredictor',
    username: 'kingpredictor',
    avatar: null,
    initials: 'KP',
    bio: '5+ years professional analyst. Football & Basketball specialist. Former bookmaker data analyst. Currently on a 7-game winning streak.',
    badge: 'elite',
    badgeLabel: 'Elite',
    stats: {
      totalPredictions: 342,
      winRate: 68.5,
      followers: 12400,
      following: 89,
      earnings: 8750,
      currentStreak: 7,
      monthlyWins: 23,
      monthlyTotal: 31,
    },
    sports: ['Football', 'Basketball'],
    joinDate: '2024-01-15',
    verified: true,
    avatarColor: 'from-purple-500 to-purple-700',
  },
  {
    id: 'c2',
    name: 'StatGuru',
    username: 'statguru',
    avatar: null,
    initials: 'SG',
    bio: 'Data-driven predictions backed by advanced statistics. Serie A & La Liga expert. 62% accuracy over 200+ predictions.',
    badge: 'pro',
    badgeLabel: 'Pro',
    stats: {
      totalPredictions: 218,
      winRate: 62.3,
      followers: 7850,
      following: 134,
      earnings: 4200,
      currentStreak: 3,
      monthlyWins: 16,
      monthlyTotal: 24,
    },
    sports: ['Football'],
    joinDate: '2024-03-22',
    verified: true,
    avatarColor: 'from-blue-500 to-blue-700',
  },
  {
    id: 'c3',
    name: 'BallHawkNG',
    username: 'ballhawkng',
    avatar: null,
    initials: 'BH',
    bio: 'Nigerian betting guru. Focus on African & European leagues. 3-year track record. Community favourite with 23k+ followers.',
    badge: 'verified',
    badgeLabel: 'Verified',
    stats: {
      totalPredictions: 567,
      winRate: 58.9,
      followers: 23100,
      following: 312,
      earnings: 12300,
      currentStreak: 2,
      monthlyWins: 18,
      monthlyTotal: 28,
    },
    sports: ['Football', 'Basketball', 'Tennis'],
    joinDate: '2023-08-10',
    verified: true,
    avatarColor: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'c4',
    name: 'OddsShark',
    username: 'oddsshark',
    avatar: null,
    initials: 'OS',
    bio: 'Value betting specialist. Finding edge in Premier League and Champions League markets. ROI-focused approach.',
    badge: 'pro',
    badgeLabel: 'Pro',
    stats: {
      totalPredictions: 189,
      winRate: 65.1,
      followers: 5420,
      following: 67,
      earnings: 3100,
      currentStreak: 5,
      monthlyWins: 14,
      monthlyTotal: 19,
    },
    sports: ['Football'],
    joinDate: '2024-02-08',
    verified: false,
    avatarColor: 'from-orange-500 to-red-600',
  },
  {
    id: 'c5',
    name: 'CourtVision',
    username: 'courtvision',
    avatar: null,
    initials: 'CV',
    bio: 'NBA & EuroLeague basketball analyst. Statistical modeling and line movement tracking. Former sports journalist.',
    badge: 'verified',
    badgeLabel: 'Verified',
    stats: {
      totalPredictions: 412,
      winRate: 61.4,
      followers: 9800,
      following: 201,
      earnings: 5600,
      currentStreak: 4,
      monthlyWins: 20,
      monthlyTotal: 30,
    },
    sports: ['Basketball'],
    joinDate: '2023-11-20',
    verified: true,
    avatarColor: 'from-amber-500 to-orange-600',
  },
  {
    id: 'c6',
    name: 'AceAnalyst',
    username: 'aceanalyst',
    avatar: null,
    initials: 'AA',
    bio: 'Tennis predictions specialist. ATP/WTA tour follower. Surface-specific insights and player fatigue tracking.',
    badge: 'verified',
    badgeLabel: 'Verified',
    stats: {
      totalPredictions: 284,
      winRate: 63.7,
      followers: 4300,
      following: 88,
      earnings: 2400,
      currentStreak: 6,
      monthlyWins: 19,
      monthlyTotal: 27,
    },
    sports: ['Tennis'],
    joinDate: '2024-01-30',
    verified: true,
    avatarColor: 'from-sky-500 to-cyan-600',
  },
];

const [c1, c2, c3, c4, c5, c6] = MOCK_CREATORS;

export const MOCK_PREDICTIONS: Prediction[] = [
  {
    id: 'pred_001',
    sport: 'Football',
    league: { name: 'Premier League', country: 'England', id: 39 },
    match: {
      id: 'm_001',
      homeTeam: { name: 'Arsenal', shortName: 'ARS', form: ['W', 'W', 'D', 'L', 'W'] },
      awayTeam: { name: 'Chelsea', shortName: 'CHE', form: ['W', 'D', 'W', 'L', 'W'] },
      date: '2026-04-28T15:00:00Z',
      venue: 'Emirates Stadium',
    },
    prediction: {
      type: 'Over 2.5 Goals',
      shorthand: 'OV 2.5',
      odds: 1.85,
      confidence: 78,
      analysis: "Arsenal have scored in all 8 home games this season, averaging 2.8 goals per game. Chelsea's away record shows 3+ goals in 5 of their last 7 away matches. Both teams' defenses have shown vulnerabilities, and the head-to-head history shows this fixture consistently delivers over 2.5 goals (7 of last 10 meetings). The midfield battle will be intense but expect both attacks to find openings.",
    },
    creator: c1,
    bookingCode: {
      id: 'code_001',
      bookmaker: 'Bet9ja',
      code: 'BET9JA7R9X',
      clicks: 1247,
      successRate: 72,
      trackingId: 'tk_pred001_c1',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'open',
    stats: { likes: 342, comments: 87, views: 4521, shares: 156 },
    isTrending: true,
    isPremium: false,
    tags: ['Over Goals', 'Arsenal', 'Premier League'],
    timestamp: '2026-04-28T10:00:00Z',
  },
  {
    id: 'pred_002',
    sport: 'Football',
    league: { name: 'La Liga', country: 'Spain', id: 140 },
    match: {
      id: 'm_002',
      homeTeam: { name: 'Barcelona', shortName: 'BAR', form: ['W', 'W', 'W', 'D', 'W'] },
      awayTeam: { name: 'Real Madrid', shortName: 'RMA', form: ['W', 'L', 'W', 'W', 'D'] },
      date: '2026-04-28T20:00:00Z',
      venue: 'Camp Nou',
    },
    prediction: {
      type: 'Both Teams to Score',
      shorthand: 'BTTS',
      odds: 1.70,
      confidence: 82,
      analysis: "El Clasico consistently produces goals at both ends. Barcelona's press and Real Madrid's counter-attack make this a high-scoring affair. In the last 8 head-to-head matches, BTTS has landed 7 times. Expect both teams to find the net regardless of who takes the points.",
    },
    creator: c2,
    bookingCode: {
      id: 'code_002',
      bookmaker: 'SportyBet',
      code: 'SPT-BC4E8TA',
      clicks: 2341,
      successRate: 68,
      trackingId: 'tk_pred002_c2',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'open',
    stats: { likes: 891, comments: 234, views: 12400, shares: 445 },
    isTrending: true,
    isPremium: false,
    tags: ['BTTS', 'El Clasico', 'La Liga'],
    timestamp: '2026-04-28T08:30:00Z',
  },
  {
    id: 'pred_003',
    sport: 'Basketball',
    league: { name: 'NBA', country: 'USA', id: 12 },
    match: {
      id: 'm_003',
      homeTeam: { name: 'LA Lakers', shortName: 'LAL', form: ['W', 'L', 'W', 'W', 'L'] },
      awayTeam: { name: 'Golden State', shortName: 'GSW', form: ['W', 'W', 'W', 'L', 'W'] },
      date: '2026-04-28T02:30:00Z',
      venue: 'Crypto.com Arena',
    },
    prediction: {
      type: 'Lakers Win',
      shorthand: 'HW',
      odds: 2.10,
      confidence: 61,
      analysis: "Lakers are 8-2 at home this season. LeBron averaging 28.4 points this month. Golden State's away record is 4-6 in last 10. This line has value at 2.10 given the home advantage factor.",
    },
    creator: c5,
    bookingCode: {
      id: 'code_003',
      bookmaker: '1XBet',
      code: '1XBET-VNWKX',
      clicks: 876,
      successRate: 55,
      trackingId: 'tk_pred003_c5',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'won',
    stats: { likes: 213, comments: 45, views: 2100, shares: 67 },
    isTrending: false,
    isPremium: false,
    tags: ['NBA', 'Lakers', 'Home Win'],
    timestamp: '2026-04-27T20:00:00Z',
  },
  {
    id: 'pred_004',
    sport: 'Tennis',
    league: { name: 'ATP Tour', country: 'International', id: 60 },
    match: {
      id: 'm_004',
      homeTeam: { name: 'Djokovic', shortName: 'DJK', form: ['W', 'W', 'W', 'L', 'W'] },
      awayTeam: { name: 'Alcaraz', shortName: 'ALC', form: ['W', 'W', 'L', 'W', 'W'] },
      date: '2026-04-29T14:00:00Z',
      venue: 'Roland Garros',
    },
    prediction: {
      type: 'Djokovic to Win',
      shorthand: 'P1 Win',
      odds: 1.95,
      confidence: 57,
      analysis: "Djokovic's clay court expertise remains unmatched. 91% win rate at Roland Garros across his career. Alcaraz is a serious threat, especially on clay, but this surface still historically favors the veteran.",
    },
    creator: c6,
    bookingCode: {
      id: 'code_004',
      bookmaker: 'Betway',
      code: 'BWY-QK8P4',
      clicks: 543,
      successRate: 63,
      trackingId: 'tk_pred004_c6',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'open',
    stats: { likes: 156, comments: 32, views: 1870, shares: 44 },
    isTrending: false,
    isPremium: true,
    tags: ['ATP', 'Roland Garros', 'Djokovic'],
    timestamp: '2026-04-28T09:15:00Z',
  },
  {
    id: 'pred_005',
    sport: 'Football',
    league: { name: 'Champions League', country: 'Europe', id: 2 },
    match: {
      id: 'm_005',
      homeTeam: { name: 'Bayern Munich', shortName: 'BAY', form: ['W', 'W', 'D', 'W', 'W'] },
      awayTeam: { name: 'Inter Milan', shortName: 'INT', form: ['W', 'L', 'D', 'W', 'D'] },
      date: '2026-04-29T20:00:00Z',
      venue: 'Allianz Arena',
    },
    prediction: {
      type: 'Bayern -1 Handicap',
      shorthand: 'AH -1',
      odds: 2.25,
      confidence: 71,
      analysis: "Bayern are dominant at home in European competition. Inter's defensive fragility away from San Siro is well-documented this season. The handicap provides excellent value at 2.25 given Bayern's recent form.",
    },
    creator: c1,
    bookingCode: {
      id: 'code_005',
      bookmaker: 'Bet365',
      code: 'B365-9QK8P',
      clicks: 987,
      successRate: 69,
      trackingId: 'tk_pred005_c1',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'open',
    stats: { likes: 445, comments: 112, views: 5600, shares: 189 },
    isTrending: true,
    isPremium: false,
    tags: ['UCL', 'Bayern', 'Handicap'],
    timestamp: '2026-04-28T07:00:00Z',
  },
  {
    id: 'pred_006',
    sport: 'Football',
    league: { name: 'Serie A', country: 'Italy', id: 135 },
    match: {
      id: 'm_006',
      homeTeam: { name: 'Napoli', shortName: 'NAP', form: ['W', 'D', 'W', 'W', 'L'] },
      awayTeam: { name: 'AC Milan', shortName: 'MIL', form: ['L', 'W', 'D', 'L', 'W'] },
      date: '2026-04-28T19:45:00Z',
      venue: 'Diego Armando Maradona',
    },
    prediction: {
      type: 'Home Win',
      shorthand: '1',
      odds: 1.65,
      confidence: 74,
      analysis: "Napoli unbeaten in last 6 home games. Milan have lost 3 of their last 5 away matches. The atmosphere at Maradona gives the home side a significant psychological advantage.",
    },
    creator: c2,
    bookingCode: {
      id: 'code_006',
      bookmaker: 'BetKing',
      code: 'BK77-R42',
      clicks: 654,
      successRate: 71,
      trackingId: 'tk_pred006_c2',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'won',
    stats: { likes: 267, comments: 54, views: 3210, shares: 98 },
    isTrending: false,
    isPremium: false,
    tags: ['Serie A', 'Home Win', 'Napoli'],
    timestamp: '2026-04-27T18:00:00Z',
  },
  {
    id: 'pred_007',
    sport: 'Football',
    league: { name: 'Bundesliga', country: 'Germany', id: 78 },
    match: {
      id: 'm_007',
      homeTeam: { name: 'Dortmund', shortName: 'BVB', form: ['L', 'W', 'W', 'D', 'W'] },
      awayTeam: { name: 'RB Leipzig', shortName: 'RBL', form: ['W', 'D', 'W', 'W', 'L'] },
      date: '2026-04-29T17:30:00Z',
      venue: 'Signal Iduna Park',
    },
    prediction: {
      type: 'Under 3.5 Goals',
      shorthand: 'UN 3.5',
      odds: 1.55,
      confidence: 66,
      analysis: "Both teams are managing fatigue ahead of cup commitments. Dortmund's attacking form has dipped in recent weeks. Tactical match expected, with both managers prioritizing defensive shape.",
    },
    creator: c4,
    bookingCode: {
      id: 'code_007',
      bookmaker: 'Melbet',
      code: 'MLB-9QK8P',
      clicks: 321,
      successRate: 59,
      trackingId: 'tk_pred007_c4',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'open',
    stats: { likes: 89, comments: 21, views: 1230, shares: 34 },
    isTrending: false,
    isPremium: false,
    tags: ['Bundesliga', 'Under Goals', 'BVB'],
    timestamp: '2026-04-28T11:30:00Z',
  },
  {
    id: 'pred_008',
    sport: 'Basketball',
    league: { name: 'EuroLeague', country: 'Europe', id: 15 },
    match: {
      id: 'm_008',
      homeTeam: { name: 'Real Madrid', shortName: 'RMB', form: ['W', 'W', 'W', 'L', 'W'] },
      awayTeam: { name: 'Olympiacos', shortName: 'OLY', form: ['W', 'W', 'L', 'W', 'W'] },
      date: '2026-04-29T19:00:00Z',
      venue: 'WiZink Center',
    },
    prediction: {
      type: 'Total Over 160.5',
      shorthand: 'OV 160.5',
      odds: 1.90,
      confidence: 69,
      analysis: "Real Madrid averaging 85 points per game at home this EuroLeague season. Olympiacos play high-tempo basketball and this fixture has gone over in 6 of their last 8 meetings.",
    },
    creator: c5,
    bookingCode: {
      id: 'code_008',
      bookmaker: 'SportyBet',
      code: 'SPT-XL7M3',
      clicks: 445,
      successRate: 64,
      trackingId: 'tk_pred008_c5',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'open',
    stats: { likes: 134, comments: 28, views: 1560, shares: 45 },
    isTrending: false,
    isPremium: true,
    tags: ['EuroLeague', 'Basketball', 'Over Total'],
    timestamp: '2026-04-28T08:00:00Z',
  },
  {
    id: 'pred_009',
    sport: 'Football',
    league: { name: 'AFCON Qualifiers', country: 'Africa', id: 6 },
    match: {
      id: 'm_009',
      homeTeam: { name: 'Nigeria', shortName: 'NGA', form: ['W', 'W', 'D', 'W', 'W'] },
      awayTeam: { name: 'Ghana', shortName: 'GHA', form: ['D', 'L', 'W', 'D', 'W'] },
      date: '2026-04-29T16:00:00Z',
      venue: 'Moshood Abiola Stadium',
    },
    prediction: {
      type: 'Nigeria Win',
      shorthand: 'HW',
      odds: 1.75,
      confidence: 72,
      analysis: "Nigeria unbeaten in last 9 home AFCON qualifiers. The Super Eagles' attacking prowess at home is unmatched in West Africa. Ghana missing key defensive players through injury.",
    },
    creator: c3,
    bookingCode: {
      id: 'code_009',
      bookmaker: 'Bet9ja',
      code: 'BET9-NG7V4',
      clicks: 3421,
      successRate: 73,
      trackingId: 'tk_pred009_c3',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'open',
    stats: { likes: 1203, comments: 445, views: 18700, shares: 678 },
    isTrending: true,
    isPremium: false,
    tags: ['AFCON', 'Nigeria', 'Home Win'],
    timestamp: '2026-04-28T06:00:00Z',
  },
  {
    id: 'pred_010',
    sport: 'Football',
    league: { name: 'Premier League', country: 'England', id: 39 },
    match: {
      id: 'm_010',
      homeTeam: { name: 'Liverpool', shortName: 'LIV', form: ['W', 'W', 'W', 'D', 'W'] },
      awayTeam: { name: 'Manchester City', shortName: 'MCI', form: ['W', 'D', 'W', 'W', 'L'] },
      date: '2026-04-29T16:30:00Z',
      venue: 'Anfield',
    },
    prediction: {
      type: 'Draw',
      shorthand: 'X',
      odds: 3.40,
      confidence: 45,
      analysis: "Two evenly matched title contenders. High draw odds represent genuine value — these sides have drawn 4 of their last 9 meetings. Anfield's atmosphere is electric but City have the tactical edge to contain.",
    },
    creator: c4,
    bookingCode: {
      id: 'code_010',
      bookmaker: '1XBet',
      code: '1XB-LMC88P',
      clicks: 765,
      successRate: 42,
      trackingId: 'tk_pred010_c4',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'open',
    stats: { likes: 387, comments: 134, views: 7800, shares: 212 },
    isTrending: true,
    isPremium: false,
    tags: ['Premier League', 'Draw', 'Value Bet'],
    timestamp: '2026-04-28T09:00:00Z',
  },
  {
    id: 'pred_011',
    sport: 'Tennis',
    league: { name: 'WTA Tour', country: 'International', id: 61 },
    match: {
      id: 'm_011',
      homeTeam: { name: 'Swiatek', shortName: 'SWT', form: ['W', 'W', 'W', 'W', 'L'] },
      awayTeam: { name: 'Gauff', shortName: 'GAU', form: ['W', 'L', 'W', 'W', 'W'] },
      date: '2026-04-29T11:00:00Z',
      venue: 'Roland Garros',
    },
    prediction: {
      type: 'Swiatek Win',
      shorthand: 'P1 Win',
      odds: 1.45,
      confidence: 85,
      analysis: "Swiatek is the undisputed queen of clay. 35-1 clay court record this season. Dominant serve returns and baseline play make her near-unbeatable on this surface.",
    },
    creator: c6,
    bookingCode: {
      id: 'code_011',
      bookmaker: 'Betway',
      code: 'BWY-SWT2024',
      clicks: 234,
      successRate: 87,
      trackingId: 'tk_pred011_c6',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'won',
    stats: { likes: 198, comments: 41, views: 2340, shares: 67 },
    isTrending: false,
    isPremium: false,
    tags: ['WTA', 'Clay', 'Swiatek'],
    timestamp: '2026-04-27T15:00:00Z',
  },
  {
    id: 'pred_012',
    sport: 'Football',
    league: { name: 'Ligue 1', country: 'France', id: 61 },
    match: {
      id: 'm_012',
      homeTeam: { name: 'PSG', shortName: 'PSG', form: ['W', 'W', 'W', 'W', 'D'] },
      awayTeam: { name: 'Monaco', shortName: 'MON', form: ['W', 'D', 'W', 'L', 'W'] },
      date: '2026-04-29T20:45:00Z',
      venue: 'Parc des Princes',
    },
    prediction: {
      type: 'Over 2.5 Goals',
      shorthand: 'OV 2.5',
      odds: 1.72,
      confidence: 76,
      analysis: "PSG average 3.1 goals per home game. Monaco away record sees them concede 1.8 goals/game. High attacking quality from both sides.",
    },
    creator: c3,
    bookingCode: {
      id: 'code_012',
      bookmaker: 'Parimatch',
      code: 'PM-PSG2024',
      clicks: 543,
      successRate: 70,
      trackingId: 'tk_pred012_c3',
      affiliateUrl: '#',
      conversionStatus: null,
    },
    status: 'lost',
    stats: { likes: 145, comments: 67, views: 2890, shares: 89 },
    isTrending: false,
    isPremium: false,
    tags: ['Ligue 1', 'PSG', 'Over Goals'],
    timestamp: '2026-04-27T12:00:00Z',
  },
];

export const MOCK_FORUM_THREADS: ForumThread[] = [
  {
    id: 'thread_001',
    category: "Today's Matches",
    title: "Arsenal vs Chelsea — Who takes the points today?",
    content: "Today's Premier League fixture is going to be huge. Arsenal need the 3 points to stay in title contention, while Chelsea are fighting for European spots. What's your take? I'm going with Over 2.5 given both teams' recent form...",
    author: c1,
    stats: { replies: 87, views: 2341, likes: 234 },
    tags: ['Premier League', 'Arsenal', 'Chelsea'],
    isPinned: true,
    timestamp: '2026-04-28T07:00:00Z',
    lastReply: '2026-04-28T11:30:00Z',
  },
  {
    id: 'thread_002',
    category: 'Hot Tips',
    title: "My 3-fold accumulator for this weekend — 7.5 odds total",
    content: "I've been tracking my selections for the past 3 months and this weekend's card looks excellent. Here's my acca breakdown with full reasoning behind each pick...",
    author: c1,
    stats: { replies: 145, views: 5620, likes: 567 },
    tags: ['Accumulator', 'Weekend Tips'],
    isPinned: false,
    timestamp: '2026-04-28T06:30:00Z',
    lastReply: '2026-04-28T12:00:00Z',
  },
  {
    id: 'thread_003',
    category: 'Basketball Talk',
    title: "NBA Playoffs Round 2 — Full Bracket Predictions",
    content: "The Round 2 matchups are set. Who advances? My bracket analysis based on team stats, fatigue factor, and historical head-to-head data...",
    author: c5,
    stats: { replies: 63, views: 1890, likes: 189 },
    tags: ['NBA', 'Playoffs'],
    isPinned: false,
    timestamp: '2026-04-27T20:00:00Z',
    lastReply: '2026-04-28T10:00:00Z',
  },
  {
    id: 'thread_004',
    category: 'Betting Strategy',
    title: "How I turned $20 into $180 in 6 weeks — My system explained",
    content: "Not clickbait. I've been using a modified Kelly Criterion system with strict bankroll management. Here's the full breakdown of every bet, unit size, and the reasoning...",
    author: c3,
    stats: { replies: 312, views: 14200, likes: 1023 },
    tags: ['Strategy', 'Bankroll', 'System'],
    isPinned: true,
    timestamp: '2026-04-26T14:00:00Z',
    lastReply: '2026-04-28T11:45:00Z',
  },
  {
    id: 'thread_005',
    category: 'Tennis Corner',
    title: "Roland Garros 2026 — Full Draw Analysis and Dark Horses",
    content: "The draw is out. Who are the dark horses? Which upsets can we expect? Let's break it down by quarter and surface-specific stats...",
    author: c6,
    stats: { replies: 45, views: 1240, likes: 134 },
    tags: ['Roland Garros', 'Tennis', 'Analysis'],
    isPinned: false,
    timestamp: '2026-04-27T16:00:00Z',
    lastReply: '2026-04-28T09:15:00Z',
  },
  {
    id: 'thread_006',
    category: 'General Discussion',
    title: "Best bookmakers for fast payouts in Nigeria — 2026 ranking",
    content: "Been testing withdrawal times across 8 different platforms over the past 2 months. Here are my findings with actual data and screenshots...",
    author: c3,
    stats: { replies: 198, views: 8900, likes: 445 },
    tags: ['Bookmakers', 'Nigeria', 'Payouts'],
    isPinned: false,
    timestamp: '2026-04-25T10:00:00Z',
    lastReply: '2026-04-28T08:30:00Z',
  },
  {
    id: 'thread_007',
    category: "Today's Matches",
    title: "El Clasico live discussion thread — Camp Nou tonight",
    content: "Tonight's match at Camp Nou is going to be electric. Share your predictions, discuss line-ups, and let's track it together in real-time...",
    author: c2,
    stats: { replies: 234, views: 9800, likes: 678 },
    tags: ['El Clasico', 'Barcelona', 'Real Madrid'],
    isPinned: false,
    timestamp: '2026-04-28T10:00:00Z',
    lastReply: '2026-04-28T12:30:00Z',
  },
  {
    id: 'thread_008',
    category: 'Hot Tips',
    title: "AFCON Qualifier preview — Nigeria should comfortably win at home",
    content: "Nigeria's Super Eagles against Ghana at home. This should be a banker selection based on historical data and current squad status...",
    author: c3,
    stats: { replies: 156, views: 7600, likes: 534 },
    tags: ['AFCON', 'Nigeria', 'Preview'],
    isPinned: false,
    timestamp: '2026-04-28T05:00:00Z',
    lastReply: '2026-04-28T11:00:00Z',
  },
];

export const MOCK_FORUM_COMMENTS: ForumComment[] = [
  {
    id: 'cmt_001',
    threadId: 'thread_001',
    author: { id: 'u1', name: 'FootballFan99', initials: 'FF', avatarColor: 'from-blue-500 to-blue-700', badge: null },
    content: "Totally agree with the Over 2.5 pick. Arsenal at home have been unstoppable this season. I'm putting $10 on this one.",
    likes: 23,
    timestamp: '2026-04-28T07:30:00Z',
    replies: [
      {
        id: 'cmt_001_r1',
        author: { id: 'c1', name: 'KingPredictor', initials: 'KP', avatarColor: 'from-purple-500 to-purple-700', badge: 'elite' },
        content: "Good call! The odds at 1.85 are still excellent value. Remember to set your stake limit and do your own research too.",
        likes: 45,
        timestamp: '2026-04-28T07:45:00Z',
        replies: [],
      },
    ],
  },
  {
    id: 'cmt_002',
    threadId: 'thread_001',
    author: { id: 'u2', name: 'ChelseaBlue', initials: 'CB', avatarColor: 'from-sky-500 to-sky-700', badge: null },
    content: "Not so sure. Chelsea have been solid defensively the last 3 games. I think Under 2.5 has value here, especially with Mudryk injured.",
    likes: 12,
    timestamp: '2026-04-28T08:00:00Z',
    replies: [],
  },
  {
    id: 'cmt_003',
    threadId: 'thread_001',
    author: { id: 'u3', name: 'BettingPro_Ade', initials: 'BA', avatarColor: 'from-green-500 to-emerald-700', badge: null },
    content: "What bookmaker is giving 1.85 for this? SportyBet has it at 1.78 for me right now.",
    likes: 8,
    timestamp: '2026-04-28T08:15:00Z',
    replies: [
      {
        id: 'cmt_003_r1',
        author: { id: 'u4', name: 'OddsTracker', initials: 'OT', avatarColor: 'from-orange-500 to-amber-600', badge: null },
        content: "1XBet and Bet9ja both have it at 1.85. Line shopping is key — always check 2-3 books before placing.",
        likes: 19,
        timestamp: '2026-04-28T08:25:00Z',
        replies: [],
      },
    ],
  },
  {
    id: 'cmt_004',
    threadId: 'thread_004',
    author: { id: 'u5', name: 'AccaKing', initials: 'AK', avatarColor: 'from-red-500 to-rose-700', badge: null },
    content: "This is gold. The Kelly Criterion approach is exactly what separates pros from punters. Bookmarked and sharing with my group.",
    likes: 67,
    timestamp: '2026-04-26T15:00:00Z',
    replies: [],
  },
  {
    id: 'cmt_005',
    threadId: 'thread_004',
    author: { id: 'u6', name: 'NaijaSharp', initials: 'NS', avatarColor: 'from-teal-500 to-cyan-700', badge: null },
    content: "What was your average stake size during this run? And did you ever go above 5% of bankroll on any single bet?",
    likes: 34,
    timestamp: '2026-04-26T15:30:00Z',
    replies: [
      {
        id: 'cmt_005_r1',
        author: { id: 'c3', name: 'BallHawkNG', initials: 'BH', avatarColor: 'from-emerald-500 to-teal-600', badge: 'verified' },
        content: "Max 3% on any single. Never exceeded 8% total exposure on any given matchday. Risk management is everything.",
        likes: 89,
        timestamp: '2026-04-26T16:00:00Z',
        replies: [],
      },
    ],
  },
];

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  overview: {
    totalClicks: 8743,
    totalConversions: 1234,
    conversionRate: 14.1,
    estimatedEarnings: 4875,
    currency: '$',
    winRate: 68.5,
    activeCodes: 7,
    followersGained: 342,
    weeklyChange: {
      clicks: 12.4,
      conversions: 8.7,
      earnings: 15.2,
      followers: 23.1,
    },
  },
  chartData: [
    { day: 'Mon', clicks: 1200, conversions: 167, earnings: 670 },
    { day: 'Tue', clicks: 980, conversions: 134, earnings: 540 },
    { day: 'Wed', clicks: 1450, conversions: 198, earnings: 810 },
    { day: 'Thu', clicks: 1100, conversions: 145, earnings: 590 },
    { day: 'Fri', clicks: 1890, conversions: 267, earnings: 1100 },
    { day: 'Sat', clicks: 2100, conversions: 298, earnings: 1200 },
    { day: 'Sun', clicks: 1890, conversions: 245, earnings: 985 },
  ],
  topCodes: [
    { id: 'code_009', bookmaker: 'Bet9ja', code: 'BET9-NG7V4', clicks: 3421, conversions: 512, earnings: 2048, successRate: 73 },
    { id: 'code_001', bookmaker: 'Bet9ja', code: 'BET9JA7R9X', clicks: 1247, conversions: 187, earnings: 748, successRate: 72 },
    { id: 'code_005', bookmaker: 'Bet365', code: 'B365-9QK8P', clicks: 987, conversions: 148, earnings: 592, successRate: 69 },
  ],
};

// ─── ADDITIONAL PREDICTIONS (28 total) ────────────────────────────────────────

const extraPredictions: Prediction[] = [
  {
    id: 'pred_013',
    sport: 'Football',
    league: { name: 'Eredivisie', country: 'Netherlands', id: 88 },
    match: {
      id: 'm_013',
      homeTeam: { name: 'Ajax', shortName: 'AJX', form: ['W', 'W', 'W', 'D', 'W'] },
      awayTeam: { name: 'PSV Eindhoven', shortName: 'PSV', form: ['W', 'W', 'L', 'W', 'W'] },
      date: '2026-04-30T18:45:00Z',
      venue: 'Johan Cruyff Arena',
    },
    prediction: {
      type: 'Both Teams to Score',
      shorthand: 'BTTS',
      odds: 1.78,
      confidence: 80,
      analysis: "The Dutch title decider. Ajax at home in front of 55k fans vs PSV who lead on goal difference. Both teams have averaged 2.5+ goals in all league games this season. BTTS has landed in 9 of the last 11 Ajax vs PSV meetings.",
    },
    creator: c2,
    bookingCode: { id: 'code_013', bookmaker: 'Betway', code: 'BWY-AJX14', clicks: 432, successRate: 76, trackingId: 'tk_pred013_c2', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 178, comments: 43, views: 2100, shares: 56 },
    isTrending: false,
    isPremium: false,
    tags: ['Eredivisie', 'BTTS', 'Dutch Derby'],
    timestamp: '2026-04-29T12:00:00Z',
  },
  {
    id: 'pred_014',
    sport: 'Basketball',
    league: { name: 'NBA', country: 'USA', id: 12 },
    match: {
      id: 'm_014',
      homeTeam: { name: 'Miami Heat', shortName: 'MIA', form: ['W', 'L', 'W', 'W', 'W'] },
      awayTeam: { name: 'Boston Celtics', shortName: 'BOS', form: ['W', 'W', 'W', 'D', 'W'] },
      date: '2026-04-30T01:00:00Z',
      venue: 'Kaseya Center',
    },
    prediction: {
      type: 'Over 216.5 Total',
      shorthand: 'OV 216.5',
      odds: 1.92,
      confidence: 67,
      analysis: "Both teams play at a fast pace in the playoffs. Miami's defense has improved but their offense has been exceptional lately. Boston bring championship experience. Expect a high-scoring, entertaining game.",
    },
    creator: c5,
    bookingCode: { id: 'code_014', bookmaker: '1XBet', code: '1XB-MIA216', clicks: 312, successRate: 61, trackingId: 'tk_pred014_c5', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 98, comments: 22, views: 1340, shares: 31 },
    isTrending: false,
    isPremium: false,
    tags: ['NBA', 'Playoffs', 'Over Total'],
    timestamp: '2026-04-29T14:00:00Z',
  },
  {
    id: 'pred_015',
    sport: 'Football',
    league: { name: 'Copa Libertadores', country: 'South America', id: 13 },
    match: {
      id: 'm_015',
      homeTeam: { name: 'Flamengo', shortName: 'FLA', form: ['W', 'W', 'D', 'W', 'L'] },
      awayTeam: { name: 'Boca Juniors', shortName: 'BJU', form: ['D', 'W', 'W', 'L', 'W'] },
      date: '2026-04-30T23:30:00Z',
      venue: 'Maracanã',
    },
    prediction: {
      type: 'Home Win',
      shorthand: 'HW',
      odds: 2.05,
      confidence: 63,
      analysis: "Flamengo at Maracanã is one of the most intimidating home atmospheres in world football. Unbeaten in their last 12 Copa Libertadores home games. Boca have a long trip and rotation concerns.",
    },
    creator: c3,
    bookingCode: { id: 'code_015', bookmaker: 'Bet9ja', code: 'BET9-FLA30', clicks: 654, successRate: 58, trackingId: 'tk_pred015_c3', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 287, comments: 78, views: 4500, shares: 134 },
    isTrending: true,
    isPremium: false,
    tags: ['Copa Libertadores', 'Flamengo', 'Home Win'],
    timestamp: '2026-04-29T08:00:00Z',
  },
  {
    id: 'pred_016',
    sport: 'Football',
    league: { name: 'Premier League', country: 'England', id: 39 },
    match: {
      id: 'm_016',
      homeTeam: { name: 'Tottenham', shortName: 'TOT', form: ['W', 'D', 'L', 'W', 'D'] },
      awayTeam: { name: 'West Ham', shortName: 'WHU', form: ['L', 'L', 'W', 'D', 'L'] },
      date: '2026-04-30T14:00:00Z',
      venue: 'Tottenham Hotspur Stadium',
    },
    prediction: {
      type: 'Tottenham -1 Handicap',
      shorthand: 'AH -1',
      odds: 2.30,
      confidence: 68,
      analysis: "Spurs are in strong home form, winning their last 5 at the Tottenham Hotspur Stadium by 2+ goals. West Ham's away record is abysmal — just 2 wins in their last 12 away Premier League games.",
    },
    creator: c4,
    bookingCode: { id: 'code_016', bookmaker: 'SportyBet', code: 'SPT-TOT16', clicks: 289, successRate: 65, trackingId: 'tk_pred016_c4', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 112, comments: 34, views: 1890, shares: 45 },
    isTrending: false,
    isPremium: false,
    tags: ['Premier League', 'Handicap', 'Tottenham'],
    timestamp: '2026-04-29T10:00:00Z',
  },
  {
    id: 'pred_017',
    sport: 'Tennis',
    league: { name: 'ATP Tour', country: 'International', id: 60 },
    match: {
      id: 'm_017',
      homeTeam: { name: 'Sinner', shortName: 'SIN', form: ['W', 'W', 'W', 'W', 'W'] },
      awayTeam: { name: 'Zverev', shortName: 'ZVE', form: ['W', 'L', 'W', 'D', 'W'] },
      date: '2026-04-30T12:00:00Z',
      venue: 'Roland Garros',
    },
    prediction: {
      type: 'Sinner in 3 Sets',
      shorthand: '3 Sets',
      odds: 2.45,
      confidence: 55,
      analysis: "Sinner is on a 23-match winning streak. Zverev always pushes him but Sinner's baseline consistency is unmatched right now. Expect a competitive 3-setter rather than a walkover.",
    },
    creator: c6,
    bookingCode: { id: 'code_017', bookmaker: 'Bet365', code: 'B365-SIN17', clicks: 187, successRate: 52, trackingId: 'tk_pred017_c6', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 67, comments: 14, views: 980, shares: 23 },
    isTrending: false,
    isPremium: true,
    tags: ['ATP', 'Roland Garros', 'Sinner'],
    timestamp: '2026-04-29T07:00:00Z',
  },
  {
    id: 'pred_018',
    sport: 'Football',
    league: { name: 'La Liga', country: 'Spain', id: 140 },
    match: {
      id: 'm_018',
      homeTeam: { name: 'Atletico Madrid', shortName: 'ATM', form: ['W', 'D', 'W', 'W', 'D'] },
      awayTeam: { name: 'Sevilla', shortName: 'SEV', form: ['L', 'D', 'L', 'W', 'L'] },
      date: '2026-04-30T19:00:00Z',
      venue: 'Wanda Metropolitano',
    },
    prediction: {
      type: 'Under 2.5 Goals',
      shorthand: 'UN 2.5',
      odds: 1.68,
      confidence: 72,
      analysis: "Diego Simeone's Atletico are the masters of the 1-0. They average only 2.1 goals per home game. Sevilla are in terrible form and will pack the defence. Classic low-scoring Atletico match.",
    },
    creator: c2,
    bookingCode: { id: 'code_018', bookmaker: 'BetKing', code: 'BK-ATM18', clicks: 445, successRate: 69, trackingId: 'tk_pred018_c2', affiliateUrl: '#', conversionStatus: null },
    status: 'won',
    stats: { likes: 134, comments: 28, views: 1670, shares: 42 },
    isTrending: false,
    isPremium: false,
    tags: ['La Liga', 'Under Goals', 'Atletico'],
    timestamp: '2026-04-28T14:00:00Z',
  },
  {
    id: 'pred_019',
    sport: 'Basketball',
    league: { name: 'NBA', country: 'USA', id: 12 },
    match: {
      id: 'm_019',
      homeTeam: { name: 'Phoenix Suns', shortName: 'PHX', form: ['L', 'W', 'W', 'L', 'W'] },
      awayTeam: { name: 'Denver Nuggets', shortName: 'DEN', form: ['W', 'W', 'D', 'W', 'W'] },
      date: '2026-04-30T03:00:00Z',
      venue: 'Footprint Center',
    },
    prediction: {
      type: 'Denver Win',
      shorthand: 'AW',
      odds: 1.80,
      confidence: 65,
      analysis: "Nikola Jokić is in MVP form, averaging a triple-double this playoffs. Denver have the experience from their championship run and match up well against Phoenix's style.",
    },
    creator: c5,
    bookingCode: { id: 'code_019', bookmaker: 'Melbet', code: 'MLB-DEN19', clicks: 234, successRate: 63, trackingId: 'tk_pred019_c5', affiliateUrl: '#', conversionStatus: null },
    status: 'won',
    stats: { likes: 145, comments: 31, views: 1890, shares: 54 },
    isTrending: false,
    isPremium: false,
    tags: ['NBA', 'Denver', 'Away Win'],
    timestamp: '2026-04-28T20:00:00Z',
  },
  {
    id: 'pred_020',
    sport: 'Football',
    league: { name: 'Bundesliga', country: 'Germany', id: 78 },
    match: {
      id: 'm_020',
      homeTeam: { name: 'Bayer Leverkusen', shortName: 'LEV', form: ['W', 'W', 'W', 'W', 'D'] },
      awayTeam: { name: 'VfB Stuttgart', shortName: 'STU', form: ['W', 'D', 'L', 'W', 'W'] },
      date: '2026-04-30T17:30:00Z',
      venue: 'BayArena',
    },
    prediction: {
      type: 'Over 2.5 Goals',
      shorthand: 'OV 2.5',
      odds: 1.75,
      confidence: 74,
      analysis: "Leverkusen's attacking play under Alonso is spectacular — averaging 3.2 goals/home game. Stuttgart also like to attack. This match has high goal potential and both teams have the quality to score.",
    },
    creator: c1,
    bookingCode: { id: 'code_020', bookmaker: '1XBet', code: '1XB-LEV20', clicks: 378, successRate: 71, trackingId: 'tk_pred020_c1', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 156, comments: 38, views: 2100, shares: 67 },
    isTrending: true,
    isPremium: false,
    tags: ['Bundesliga', 'Over Goals', 'Leverkusen'],
    timestamp: '2026-04-29T09:00:00Z',
  },
  {
    id: 'pred_021',
    sport: 'Football',
    league: { name: 'AFCON Qualifiers', country: 'Africa', id: 6 },
    match: {
      id: 'm_021',
      homeTeam: { name: "Ivory Coast", shortName: 'CIV', form: ['W', 'W', 'W', 'D', 'W'] },
      awayTeam: { name: 'Morocco', shortName: 'MAR', form: ['W', 'W', 'D', 'W', 'W'] },
      date: '2026-04-30T16:00:00Z',
      venue: 'Stade Félix Houphouët-Boigny',
    },
    prediction: {
      type: 'Draw',
      shorthand: 'X',
      odds: 3.10,
      confidence: 48,
      analysis: "Two of Africa's strongest nations. Ivory Coast have the home advantage but Morocco under Regragui are tactically superb. The last 3 meetings have been draws. This is genuine value at 3.10.",
    },
    creator: c3,
    bookingCode: { id: 'code_021', bookmaker: 'Bet9ja', code: 'BET9-CIV21', clicks: 987, successRate: 44, trackingId: 'tk_pred021_c3', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 567, comments: 189, views: 8900, shares: 234 },
    isTrending: true,
    isPremium: false,
    tags: ['AFCON', 'Draw', 'Value Bet'],
    timestamp: '2026-04-29T07:30:00Z',
  },
  {
    id: 'pred_022',
    sport: 'Football',
    league: { name: 'MLS', country: 'USA', id: 253 },
    match: {
      id: 'm_022',
      homeTeam: { name: 'LA Galaxy', shortName: 'LAG', form: ['W', 'D', 'W', 'L', 'W'] },
      awayTeam: { name: 'Inter Miami', shortName: 'MIA', form: ['W', 'W', 'W', 'D', 'W'] },
      date: '2026-05-01T02:30:00Z',
      venue: 'Dignity Health Sports Park',
    },
    prediction: {
      type: 'Over 3.5 Goals',
      shorthand: 'OV 3.5',
      odds: 2.20,
      confidence: 62,
      analysis: "Messi-led Inter Miami are averaging 3.1 goals/game. LA Galaxy have been equally free-scoring at home. This Western Conference rivalry always produces entertainment and goals.",
    },
    creator: c3,
    bookingCode: { id: 'code_022', bookmaker: 'SportyBet', code: 'SPT-MLS22', clicks: 523, successRate: 59, trackingId: 'tk_pred022_c3', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 234, comments: 67, views: 3400, shares: 98 },
    isTrending: false,
    isPremium: false,
    tags: ['MLS', 'Over Goals', 'Inter Miami'],
    timestamp: '2026-04-29T11:00:00Z',
  },
  {
    id: 'pred_023',
    sport: 'Football',
    league: { name: 'Serie A', country: 'Italy', id: 135 },
    match: {
      id: 'm_023',
      homeTeam: { name: 'AS Roma', shortName: 'ROM', form: ['W', 'D', 'L', 'W', 'D'] },
      awayTeam: { name: 'SS Lazio', shortName: 'LAZ', form: ['W', 'L', 'D', 'W', 'L'] },
      date: '2026-05-01T19:45:00Z',
      venue: 'Stadio Olimpico',
    },
    prediction: {
      type: 'Both Teams to Score',
      shorthand: 'BTTS',
      odds: 1.75,
      confidence: 79,
      analysis: "The Derby della Capitale is always electric. Both teams MUST score to satisfy their fanbases in this fixture. BTTS has come in 8 of the last 10 Rome derbies. Expect a fiery match with goals.",
    },
    creator: c2,
    bookingCode: { id: 'code_023', bookmaker: 'Bet365', code: 'B365-ROM23', clicks: 456, successRate: 74, trackingId: 'tk_pred023_c2', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 189, comments: 54, views: 2780, shares: 87 },
    isTrending: false,
    isPremium: false,
    tags: ['Serie A', 'Derby', 'BTTS'],
    timestamp: '2026-04-29T13:00:00Z',
  },
  {
    id: 'pred_024',
    sport: 'Football',
    league: { name: 'Champions League', country: 'Europe', id: 2 },
    match: {
      id: 'm_024',
      homeTeam: { name: 'PSG', shortName: 'PSG', form: ['W', 'W', 'D', 'W', 'W'] },
      awayTeam: { name: 'Manchester City', shortName: 'MCI', form: ['W', 'W', 'W', 'L', 'W'] },
      date: '2026-05-01T20:00:00Z',
      venue: 'Parc des Princes',
    },
    prediction: {
      type: 'Man City Win',
      shorthand: 'AW',
      odds: 2.60,
      confidence: 54,
      analysis: "City's European pedigree is unmatched. Guardiola has tactical solutions against Paris's high press. Away wins in UCL semis are common for City — they've won in Paris before. Big value at 2.60.",
    },
    creator: c4,
    bookingCode: { id: 'code_024', bookmaker: 'Betway', code: 'BWY-PSG24', clicks: 678, successRate: 49, trackingId: 'tk_pred024_c4', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 345, comments: 112, views: 6700, shares: 178 },
    isTrending: true,
    isPremium: true,
    tags: ['UCL', 'Value', 'Man City Away'],
    timestamp: '2026-04-29T08:30:00Z',
  },
  {
    id: 'pred_025',
    sport: 'Basketball',
    league: { name: 'EuroLeague', country: 'Europe', id: 15 },
    match: {
      id: 'm_025',
      homeTeam: { name: 'Barcelona', shortName: 'BAR', form: ['W', 'L', 'W', 'W', 'W'] },
      awayTeam: { name: 'CSKA Moscow', shortName: 'CSK', form: ['W', 'D', 'L', 'W', 'D'] },
      date: '2026-05-01T19:00:00Z',
      venue: 'Palau Blaugrana',
    },
    prediction: {
      type: 'Barcelona Win',
      shorthand: 'HW',
      odds: 1.70,
      confidence: 73,
      analysis: "Barcelona are 9-1 at home in EuroLeague this season. CSKA travel poorly and have key defensive absences. Barca's guard rotation is world-class and should dominate the paint.",
    },
    creator: c5,
    bookingCode: { id: 'code_025', bookmaker: 'SportyBet', code: 'SPT-BAR25', clicks: 198, successRate: 68, trackingId: 'tk_pred025_c5', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 78, comments: 18, views: 1120, shares: 29 },
    isTrending: false,
    isPremium: false,
    tags: ['EuroLeague', 'Barcelona', 'Home Win'],
    timestamp: '2026-04-29T15:00:00Z',
  },
  {
    id: 'pred_026',
    sport: 'Football',
    league: { name: 'Nigeria Premier League', country: 'Nigeria', id: 320 },
    match: {
      id: 'm_026',
      homeTeam: { name: 'Rivers United', shortName: 'RVU', form: ['W', 'W', 'D', 'W', 'W'] },
      awayTeam: { name: 'Kano Pillars', shortName: 'KNP', form: ['L', 'D', 'W', 'L', 'D'] },
      date: '2026-04-30T15:00:00Z',
      venue: 'Adokiye Amiesimaka Stadium',
    },
    prediction: {
      type: 'Home Win & Over 1.5',
      shorthand: 'HW+OV 1.5',
      odds: 2.10,
      confidence: 77,
      analysis: "Rivers United at home are the most dominant team in the NPFL right now. 6 consecutive home wins by 2+ goals. Kano Pillars are struggling away from home with 1 win in 8 away games this season.",
    },
    creator: c3,
    bookingCode: { id: 'code_026', bookmaker: 'Bet9ja', code: 'BET9-RVU26', clicks: 1890, successRate: 74, trackingId: 'tk_pred026_c3', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 678, comments: 234, views: 9800, shares: 312 },
    isTrending: true,
    isPremium: false,
    tags: ['NPFL', 'Nigeria', 'Home Win'],
    timestamp: '2026-04-29T06:00:00Z',
  },
  {
    id: 'pred_027',
    sport: 'Football',
    league: { name: 'Premier League', country: 'England', id: 39 },
    match: {
      id: 'm_027',
      homeTeam: { name: 'Newcastle', shortName: 'NEW', form: ['W', 'W', 'D', 'W', 'L'] },
      awayTeam: { name: 'Aston Villa', shortName: 'AVL', form: ['D', 'W', 'W', 'L', 'W'] },
      date: '2026-05-01T19:30:00Z',
      venue: "St. James' Park",
    },
    prediction: {
      type: 'Over 2.5 Goals',
      shorthand: 'OV 2.5',
      odds: 1.90,
      confidence: 69,
      analysis: "Both clubs in European contention, forced to attack. Newcastle's St James' Park atmosphere lifts their attack and Villa have conceded in all 5 away games vs top-half sides. High entertainment likely.",
    },
    creator: c1,
    bookingCode: { id: 'code_027', bookmaker: 'Parimatch', code: 'PM-NEW27', clicks: 345, successRate: 66, trackingId: 'tk_pred027_c1', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 145, comments: 36, views: 2230, shares: 67 },
    isTrending: false,
    isPremium: false,
    tags: ['Premier League', 'Over Goals', 'Newcastle'],
    timestamp: '2026-04-29T11:30:00Z',
  },
  {
    id: 'pred_028',
    sport: 'Tennis',
    league: { name: 'WTA Tour', country: 'International', id: 61 },
    match: {
      id: 'm_028',
      homeTeam: { name: 'Sabalenka', shortName: 'SAB', form: ['W', 'W', 'W', 'L', 'W'] },
      awayTeam: { name: 'Rybakina', shortName: 'RYB', form: ['W', 'D', 'W', 'W', 'L'] },
      date: '2026-04-30T14:30:00Z',
      venue: 'Roland Garros',
    },
    prediction: {
      type: 'Sabalenka Win',
      shorthand: 'P1 Win',
      odds: 1.65,
      confidence: 70,
      analysis: "Sabalenka is firing on all cylinders. Her powerful baseline game translates well to clay. Rybakina is the only one who can match her physically but has a patchy clay record.",
    },
    creator: c6,
    bookingCode: { id: 'code_028', bookmaker: 'Betway', code: 'BWY-SAB28', clicks: 156, successRate: 68, trackingId: 'tk_pred028_c6', affiliateUrl: '#', conversionStatus: null },
    status: 'open',
    stats: { likes: 89, comments: 19, views: 1230, shares: 34 },
    isTrending: false,
    isPremium: false,
    tags: ['WTA', 'Sabalenka', 'Clay'],
    timestamp: '2026-04-29T08:00:00Z',
  },
];

MOCK_PREDICTIONS.push(...extraPredictions);

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [...MOCK_CREATORS]
  .sort((a, b) => b.stats.winRate - a.stats.winRate)
  .slice(0, 5)
  .map((c, i) => ({ ...c, rank: i + 1 }));

export const FORUM_CATEGORIES: ForumCategory[] = [
  { id: 'all', label: 'All', count: 8 },
  { id: "Today's Matches", label: "Today's Matches", count: 2 },
  { id: 'Hot Tips', label: 'Hot Tips', count: 2 },
  { id: 'Betting Strategy', label: 'Strategy', count: 1 },
  { id: 'Basketball Talk', label: 'Basketball', count: 1 },
  { id: 'Tennis Corner', label: 'Tennis', count: 1 },
  { id: 'General Discussion', label: 'General', count: 1 },
];
