export interface MockMatch {
  id: number;
  league: string;
  country: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  score: string | null;
  status: 'Upcoming' | 'Live';
  prediction: string;
  odds: string;
  date: number;
  locked: boolean;
}

export interface MockLeague {
  id: number;
  name: string;
  country: string;
  count: number;
}

export interface MockCountry {
  id: number;
  name: string;
  count: number;
}

export interface MockBookingCode {
  id: number;
  platform: string;
  code: string;
}

export interface MockReferee {
  id: number;
  name: string;
  league: string;
  matches: number;
  yellowCards: number;
  redCards: number;
  penalties: number;
}

export interface MockRanking {
  rank: number;
  team: string;
  points: number;
  change: number;
}

export const MOCK_MATCHES: MockMatch[] = [
  { id: 1, league: "Premier League", country: "England", time: "20:00", homeTeam: "Arsenal", awayTeam: "Chelsea", score: null, status: "Upcoming", prediction: "Home or Draw", odds: "1.45", date: 11, locked: false },
  { id: 2, league: "La Liga", country: "Spain", time: "21:15", homeTeam: "Sevilla", awayTeam: "Atletico Madrid", score: null, status: "Upcoming", prediction: "Over 2.5", odds: "1.80", date: 11, locked: true },
  { id: 3, league: "Serie A", country: "Italy", time: "19:45", homeTeam: "Atalanta", awayTeam: "Juventus", score: null, status: "Upcoming", prediction: "Away Win", odds: "2.10", date: 11, locked: true },
  { id: 4, league: "Ligue 1", country: "France", time: "20:05", homeTeam: "Rennes", awayTeam: "Angers", score: "2 - 0", status: "Live", prediction: "Home Win", odds: "1.50", date: 11, locked: false },
  { id: 5, league: "Primeira Liga", country: "Portugal", time: "20:30", homeTeam: "Club Foot Estrela", awayTeam: "Sporting", score: null, status: "Upcoming", prediction: "Away Win", odds: "1.35", date: 11, locked: true },
  { id: 6, league: "Eredivisie", country: "Netherlands", time: "20:00", homeTeam: "Heracles", awayTeam: "Ajax", score: null, status: "Upcoming", prediction: "Over 2.5", odds: "1.65", date: 11, locked: true },
  { id: 7, league: "Bundisliga", country: "Germany", time: "15:30", homeTeam: "B. Munich", awayTeam: "Dortmund", score: null, status: "Upcoming", prediction: "Home Win", odds: "1.55", date: 11, locked: false },
  { id: 8, league: "Premier League", country: "England", time: "12:30", homeTeam: "Liverpool", awayTeam: "Everton", score: "1 - 1", status: "Live", prediction: "Home Win", odds: "1.40", date: 11, locked: false },
  { id: 9, league: "Premier League", country: "England", time: "15:00", homeTeam: "Man City", awayTeam: "Man Utd", score: null, status: "Upcoming", prediction: "Home Win", odds: "1.30", date: 12, locked: false },
  { id: 10, league: "La Liga", country: "Spain", time: "20:00", homeTeam: "Barcelona", awayTeam: "Real Madrid", score: null, status: "Upcoming", prediction: "Draw", odds: "3.40", date: 12, locked: true },
  { id: 11, league: "MLS", country: "USA", time: "02:00", homeTeam: "LA Galaxy", awayTeam: "Inter Miami", score: null, status: "Upcoming", prediction: "Over 3.5", odds: "2.10", date: 11, locked: false },
  { id: 12, league: "Serie A", country: "Italy", time: "18:00", homeTeam: "Napoli", awayTeam: "AC Milan", score: null, status: "Upcoming", prediction: "Goal/Goal", odds: "1.75", date: 13, locked: false },
  { id: 13, league: "Brasileirão", country: "Brazil", time: "23:00", homeTeam: "Flamengo", awayTeam: "Palmeiras", score: "0 - 0", status: "Live", prediction: "Home Win", odds: "2.05", date: 11, locked: true },
  { id: 14, league: "Premier League", country: "England", time: "15:00", homeTeam: "Crystal Palace", awayTeam: "Fulham", score: null, status: "Upcoming", prediction: "Under 2.5", odds: "1.90", date: 14, locked: false },
  { id: 15, league: "Bundesliga", country: "Germany", time: "15:30", homeTeam: "Wolfsburg", awayTeam: "Bremen", score: "3 - 1", status: "Live", prediction: "Over 2.5", odds: "1.60", date: 11, locked: false },
  { id: 16, league: "Ligue 1", country: "France", time: "17:05", homeTeam: "Monaco", awayTeam: "Lyon", score: null, status: "Upcoming", prediction: "Home Win", odds: "1.85", date: 11, locked: true },
];

export const MOCK_LEAGUES: MockLeague[] = [
  { id: 1, name: "Premier League", country: "England", count: 18 },
  { id: 2, name: "Serie A", country: "Italy", count: 12 },
  { id: 3, name: "Bundesliga", country: "Germany", count: 14 },
  { id: 4, name: "La Liga", country: "Spain", count: 15 },
  { id: 5, name: "Ligue 1", country: "France", count: 11 },
  { id: 6, name: "Primeira Liga", country: "Portugal", count: 8 },
  { id: 7, name: "Eredivisie", country: "Netherlands", count: 9 },
  { id: 8, name: "Champions League", country: "Europe", count: 24 },
  { id: 9, name: "Europa League", country: "Europe", count: 18 },
  { id: 10, name: "MLS", country: "USA", count: 12 },
  { id: 11, name: "Championship", country: "England", count: 14 },
  { id: 12, name: "Copa Libertadores", country: "Brazil", count: 16 },
];

export const MOCK_COUNTRIES: MockCountry[] = [
  { id: 1, name: "England", count: 142 },
  { id: 2, name: "Spain", count: 115 },
  { id: 3, name: "Italy", count: 98 },
  { id: 4, name: "Germany", count: 87 },
  { id: 5, name: "France", count: 74 },
  { id: 6, name: "Brazil", count: 154 },
  { id: 7, name: "Argentina", count: 112 },
  { id: 8, name: "Portugal", count: 54 },
  { id: 9, name: "Netherlands", count: 48 },
  { id: 10, name: "USA", count: 32 },
  { id: 11, name: "Mexico", count: 41 },
  { id: 12, name: "Turkey", count: 39 },
  { id: 13, name: "Belgium", count: 28 },
  { id: 14, name: "Austria", count: 22 },
  { id: 15, name: "Denmark", count: 19 },
];

export const MOCK_BOOKING_CODES: MockBookingCode[] = [
  { id: 1, platform: "Bet9ja", code: "Z7R9PXT" },
  { id: 2, platform: "SportyBet", code: "BC4E8TA" },
  { id: 3, platform: "1XBet", code: "VNWKX" },
  { id: 4, platform: "Melbet", code: "9QK8P" },
  { id: 5, platform: "BetKing", code: "BK77-R42" },
  { id: 6, platform: "Parimatch", code: "PM-X5X" },
];

export const MOCK_REFEREES: MockReferee[] = [
  { id: 1, name: "Michael Oliver", league: "Premier League", matches: 24, yellowCards: 86, redCards: 3, penalties: 6 },
  { id: 2, name: "Anthony Taylor", league: "Premier League", matches: 22, yellowCards: 91, redCards: 4, penalties: 8 },
  { id: 3, name: "Jesus Gil Manzano", league: "La Liga", matches: 19, yellowCards: 110, redCards: 6, penalties: 5 },
  { id: 4, name: "Daniele Orsato", league: "Serie A", matches: 18, yellowCards: 78, redCards: 2, penalties: 4 },
];

export const MOCK_RANKINGS: MockRanking[] = [
  { rank: 1, team: "Manchester City", points: 2150, change: 0 },
  { rank: 2, team: "Real Madrid", points: 2085, change: 0 },
  { rank: 3, team: "Bayern Munich", points: 1990, change: 1 },
  { rank: 4, team: "Arsenal", points: 1975, change: -1 },
  { rank: 5, team: "Inter Milan", points: 1940, change: 2 },
];
