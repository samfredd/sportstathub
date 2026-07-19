import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  dateMissing?: boolean;
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

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: true });
const array = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
function text(value: any): string {
  return sanitizeText(typeof value === 'object' ? String(value?.['#text'] ?? '') : String(value ?? ''));
}
function safeHttpUrl(value: unknown): string | undefined {
  try {
    const url = new URL(String(value ?? ''));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : undefined;
  } catch { return undefined; }
}

function parseRSS(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = [];
  const parsed = xmlParser.parse(xml);
  const candidates = [
    ...array(parsed?.rss?.channel?.item),
    ...array(parsed?.feed?.entry),
  ];
  for (const item of candidates) {
    try {
      const title = text(item?.title);
      const description = text(item?.description ?? item?.summary ?? item?.content).slice(0, 300);
      const linkValue = typeof item?.link === 'object' ? item.link?.['@_href'] : item?.link;
      const url = safeHttpUrl(linkValue);
      const pubDateRaw = text(item?.pubDate ?? item?.['dc:date'] ?? item?.published ?? item?.updated);
      const parsedDate = pubDateRaw ? new Date(pubDateRaw) : null;
      const publishedAt = parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString() : '';
      const imageUrl = safeHttpUrl(
        item?.['media:thumbnail']?.['@_url'] ?? item?.enclosure?.['@_url'] ?? item?.['media:content']?.['@_url']);
      if (!title || !url) continue;
      items.push({
        id: createHash('md5').update(url).digest('hex').slice(0, 16),
        title,
        description,
        url,
        source: sourceName,
        publishedAt,
        dateMissing: !publishedAt,
        imageUrl,
      });
    } catch { /* one malformed item must not discard the rest of the feed */ }
  }
  return items;
}

async function fetchFeed(name: string, feedUrl: string): Promise<{ items: NewsItem[]; healthy: boolean }> {
  try {
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; sportstathub/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { items: [], healthy: false };
    return { items: parseRSS(await res.text(), name), healthy: true };
  } catch {
    return { items: [], healthy: false };
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
    const health: Record<string, boolean> = {};
    results.forEach((r, index) => {
      const name = FEEDS[index].name;
      health[name] = r.status === 'fulfilled' && r.value.healthy;
      if (r.status === 'fulfilled') all.push(...r.value.items);
    });

    all.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||b.id.localeCompare(a.id));

    const seen = new Set<string>();
    const deduped = all.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    try {
      await redis.setex('news:health', FEED_TTL, JSON.stringify(health));
      if (deduped.length) {
        await redis.setex('news:all', FEED_TTL, JSON.stringify(deduped));
        await redis.setex('news:stale', 86_400, JSON.stringify(deduped));
      }
    } catch {}
    if (deduped.length) return deduped;
    try { return JSON.parse(await redis.get('news:stale') || '[]'); } catch { return []; }
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
