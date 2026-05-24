import { createHash } from 'crypto';

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
}

const FEEDS = [
  { name: 'BBC Sport',  url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { name: 'Sky Sports', url: 'https://www.skysports.com/rss/12040' },
  { name: 'Guardian',   url: 'https://www.theguardian.com/football/rss' },
  { name: 'ESPN',       url: 'https://www.espn.com/espn/rss/soccer/news' },
];

const FEED_TTL = 900; // 15 min

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function sanitizeText(value = ''): string {
  return value
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, entity => ENTITY_MAP[entity] ?? entity)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
  return m ? sanitizeText(m[1]) : '';
}

function parseRSS(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = getText(block, 'title');
    const description = getText(block, 'description').slice(0, 300);
    const linkM = block.match(/<link>([^<]+)/i) || block.match(/<link[^>]+href="([^"]+)"/i);
    const url = linkM ? linkM[1].trim() : '';
    const pubDate = getText(block, 'pubDate') || getText(block, 'dc:date') || getText(block, 'published');
    const imageUrl =
      block.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ||
      block.match(/<enclosure[^>]+url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)?.[1] ||
      block.match(/url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*?)"/i)?.[1] ||
      undefined;

    if (title && url) {
      items.push({
        id: createHash('md5').update(url).digest('hex').slice(0, 16),
        title,
        description,
        url,
        source: sourceName,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        imageUrl,
      });
    }
  }
  return items;
}

async function fetchFeed(name: string, feedUrl: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; sportstathub/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    return parseRSS(await res.text(), name);
  } catch {
    return [];
  }
}

export function createNewsService({ redis }: { redis: any }) {
  async function getAllNews(): Promise<NewsItem[]> {
    try {
      const cached = await redis.get('news:all');
      if (cached) return JSON.parse(cached);
    } catch {}

    const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f.name, f.url)));
    const all: NewsItem[] = [];
    results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value); });

    all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const seen = new Set<string>();
    const deduped = all.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    try { await redis.setex('news:all', FEED_TTL, JSON.stringify(deduped)); } catch {}
    return deduped;
  }

  async function getTeamNews(team1: string, team2?: string): Promise<NewsItem[]> {
    const slug = [team1, team2].filter(Boolean).join(':').toLowerCase().replace(/\s+/g, '-');
    const cacheKey = `news:team:${slug}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    const all = await getAllNews();
    const words1 = team1.split(' ').filter(w => w.length > 3);
    const words2 = team2 ? team2.split(' ').filter(w => w.length > 3) : [];

    const relevant = all.filter(item => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      return words1.some(w => text.includes(w.toLowerCase())) ||
             words2.some(w => text.includes(w.toLowerCase()));
    });

    try { await redis.setex(cacheKey, FEED_TTL, JSON.stringify(relevant)); } catch {}
    return relevant;
  }

  return { getAllNews, getTeamNews };
}
