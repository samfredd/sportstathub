-- Starter public content keeps Codes, Tips, and Forum useful on fresh installs.
WITH seed_user AS (
  INSERT INTO users (username, email, role, is_verified)
  VALUES ('sportstathub_team', 'team@sportstathub.local', 'creator', TRUE)
  ON CONFLICT (email) DO UPDATE
    SET role = EXCLUDED.role,
        is_verified = TRUE
  RETURNING id
),
author AS (
  SELECT id FROM seed_user
  UNION ALL
  SELECT id FROM users WHERE email = 'team@sportstathub.local'
  LIMIT 1
),
seed_codes(code, bookmaker, description, total_odds, stake_type, category) AS (
  VALUES
    ('STHBTTS25', 'Bet9ja', 'BTTS-focused weekend slip with moderate variance.', 4.85, 'Medium', 'BTTS'),
    ('STHSAFE2', 'SportyBet', 'Lower-risk double built around draw-no-bet markets.', 2.12, 'Low', 'Accumulator'),
    ('STHOVER35', 'Bet9ja', 'Goals ladder for high-tempo fixtures and cup ties.', 6.40, 'High', 'Over/Under'),
    ('STHAWAYDNB', 'SportyBet', 'Away draw-no-bet selections where form and table pressure align.', 3.05, 'Medium', 'DNB')
)
INSERT INTO booking_codes (user_id, code, bookmaker, description, total_odds, stake_type, category, expires_at)
SELECT author.id, seed_codes.code, seed_codes.bookmaker, seed_codes.description, seed_codes.total_odds,
       seed_codes.stake_type, seed_codes.category, NOW() + INTERVAL '30 days'
FROM seed_codes
CROSS JOIN author
WHERE NOT EXISTS (
  SELECT 1
  FROM booking_codes bc
  WHERE LOWER(bc.code) = LOWER(seed_codes.code)
    AND LOWER(bc.bookmaker) = LOWER(seed_codes.bookmaker)
);

WITH author AS (
  SELECT id FROM users WHERE email = 'team@sportstathub.local' LIMIT 1
),
seed_predictions(seed_id, sport, league_name, country, home_name, home_short, away_name, away_short, day_offset, kickoff, venue, pick_type, odds, confidence, analysis, bookmaker, code, tags, trending, premium) AS (
  VALUES
    ('seed_today_arsenal_btts', 'Football', 'England Premier League', 'England', 'Arsenal', 'ARS', 'Chelsea', 'CHE', 0, '18:30', 'Emirates Stadium', 'BTTS', 1.82, 68, 'Both teams profile well for shots inside the box, but the stake is kept moderate because derby volatility is high.', 'Bet9ja', 'STHBTTS25', ARRAY['BTTS','Premier League','Preview'], TRUE, FALSE),
    ('seed_today_lagos_over', 'Football', 'Nigeria Professional Football League', 'Nigeria', 'Remo Stars', 'REM', 'Enyimba', 'ENY', 0, '16:00', 'Remo Stars Stadium', 'Over 1.5 Goals', 1.54, 64, 'Recent home tempo and set-piece volume point to at least two goals without needing an aggressive line.', 'SportyBet', 'STHSAFE2', ARRAY['Over/Under','NPFL'], FALSE, FALSE),
    ('seed_tomorrow_milan_double', 'Football', 'Italy Serie A', 'Italy', 'Inter Milan', 'INT', 'Roma', 'ROM', 1, '20:45', 'San Siro', 'Home or Draw', 1.36, 72, 'Inter carry the stronger home form and defensive floor, making the double-chance angle the cleaner entry.', 'SportyBet', 'STHSAFE2', ARRAY['1X2','Serie A','Low Risk'], TRUE, FALSE),
    ('seed_plus_two_flamengo_goals', 'Football', 'Brazil Serie A', 'Brazil', 'Flamengo', 'FLA', 'Palmeiras', 'PAL', 2, '21:00', 'Maracana', 'Under 3.5 Goals', 1.48, 66, 'The matchup has enough attacking quality for danger, but game state and recent head-to-head rhythm favour a controlled total.', 'Bet9ja', 'STHOVER35', ARRAY['Totals','Brazil'], FALSE, TRUE)
)
INSERT INTO predictions (user_id, sport, league, match_data, prediction, booking_code, status, stats, tags, is_trending, is_premium)
SELECT author.id,
       sp.sport,
       jsonb_build_object('name', sp.league_name, 'country', sp.country),
       jsonb_build_object(
         'homeTeam', jsonb_build_object('name', sp.home_name, 'shortName', sp.home_short),
         'awayTeam', jsonb_build_object('name', sp.away_name, 'shortName', sp.away_short),
         'date', to_char(CURRENT_DATE + (sp.day_offset || ' days')::interval + sp.kickoff::time, 'YYYY-MM-DD"T"HH24:MI:SS') || 'Z',
         'venue', sp.venue
       ),
       jsonb_build_object('seedId', sp.seed_id, 'type', sp.pick_type, 'odds', sp.odds, 'confidence', sp.confidence, 'analysis', sp.analysis),
       jsonb_build_object('bookmaker', sp.bookmaker, 'code', sp.code, 'affiliateUrl', '#', 'trackingId', sp.seed_id, 'clicks', 120 + sp.confidence, 'successRate', sp.confidence),
       'open',
       jsonb_build_object('likes', 18 + sp.day_offset, 'comments', 3 + sp.day_offset, 'views', 240 + (sp.confidence * 4), 'shares', 5 + sp.day_offset),
       sp.tags,
       sp.trending,
       sp.premium
FROM seed_predictions sp
CROSS JOIN author
WHERE NOT EXISTS (
  SELECT 1 FROM predictions p WHERE p.prediction->>'seedId' = sp.seed_id
);

WITH seed_predictions(seed_id, day_offset, kickoff) AS (
  VALUES
    ('seed_today_arsenal_btts', 0, '18:30'),
    ('seed_today_lagos_over', 0, '16:00'),
    ('seed_tomorrow_milan_double', 1, '20:45'),
    ('seed_plus_two_flamengo_goals', 2, '21:00')
)
UPDATE predictions p
SET match_data = jsonb_set(
      p.match_data,
      '{date}',
      to_jsonb(to_char(CURRENT_DATE + (sp.day_offset || ' days')::interval + sp.kickoff::time, 'YYYY-MM-DD"T"HH24:MI:SS') || 'Z')
    ),
    updated_at = NOW()
FROM seed_predictions sp
WHERE p.prediction->>'seedId' = sp.seed_id;

WITH author AS (
  SELECT id FROM users WHERE email = 'team@sportstathub.local' LIMIT 1
),
seed_threads(category, title, content, tags, pinned, stats) AS (
  VALUES
    ('matchday', 'Weekend match thread: lineups, team news, and live angles', 'Use this thread for verified lineup notes, tactical changes, and late market movement before kickoff.', ARRAY['matchday','lineups','live'], TRUE, '{"replies":3,"views":412,"likes":24}'::jsonb),
    ('betting', 'Booking code format guide for Bet9ja and SportyBet', 'Share working formats, rejected slips, and bookmaker-specific conversion notes so other users can troubleshoot quickly.', ARRAY['codes','converter','help'], TRUE, '{"replies":2,"views":356,"likes":19}'::jsonb),
    ('analytics', 'How are you using xG when providers have missing live stats?', 'Discuss practical fallback signals such as shots on target, box entries, corners, and recent form when xG is unavailable.', ARRAY['xG','stats','models'], FALSE, '{"replies":4,"views":298,"likes":16}'::jsonb),
    ('community', 'Creator introductions and weekly records', 'Creators can introduce their process, preferred markets, and weekly tracking records here.', ARRAY['creators','records'], FALSE, '{"replies":1,"views":184,"likes":11}'::jsonb)
)
INSERT INTO forum_threads (user_id, category, title, content, tags, is_pinned, stats, last_reply_at)
SELECT author.id, st.category, st.title, st.content, st.tags, st.pinned, st.stats, NOW()
FROM seed_threads st
CROSS JOIN author
WHERE NOT EXISTS (
  SELECT 1 FROM forum_threads ft WHERE ft.title = st.title
);

WITH author_row AS (
  SELECT id, username, email, role, avatar_url, is_verified, created_at FROM users WHERE email = 'team@sportstathub.local' LIMIT 1
),
seed_comments(thread_title, content) AS (
  VALUES
    ('Weekend match thread: lineups, team news, and live angles', 'Pinned note: please include source time and bookmaker when posting late changes.'),
    ('Booking code format guide for Bet9ja and SportyBet', 'Known-good sample formats are uppercase letters/numbers with optional hyphens or underscores.'),
    ('How are you using xG when providers have missing live stats?', 'When xG is missing, we currently weight shots on target, dangerous attacks, corners, and game state.')
)
INSERT INTO comments (target_type, target_id, user_id, author, content)
SELECT 'thread',
       ft.id::text,
       ar.id,
       jsonb_build_object('id', ar.id::text, 'name', ar.username, 'username', ar.username, 'email', ar.email, 'role', ar.role, 'avatar', ar.avatar_url, 'verified', ar.is_verified),
       sc.content
FROM seed_comments sc
JOIN forum_threads ft ON ft.title = sc.thread_title
CROSS JOIN author_row ar
WHERE NOT EXISTS (
  SELECT 1 FROM comments c
  WHERE c.target_type = 'thread'
    AND c.target_id = ft.id::text
    AND c.content = sc.content
);
