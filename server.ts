import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { createServer as createViteServer } from 'vite';
import { MOVIES_CATALOG } from './src/data/catalog.ts';
import type { Movie, MovieCategory, StreamSource } from './src/types/movie.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isAllowedMediaUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'archive.org' ||
      host.endsWith('.archive.org') ||
      host.endsWith('.telesco.pe') ||
      host.endsWith('.telegram.org')
    );
  } catch {
    return false;
  }
}

function isAllowedThumbUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'archive.org' ||
      host.endsWith('.archive.org') ||
      host === 'image.tmdb.org' ||
      host === 'unseen.africa' ||
      host.endsWith('.unseen.africa') ||
      host === 'i.ytimg.com' ||
      host === 'i9.ytimg.com' ||
      host.endsWith('.ytimg.com') ||
      host.endsWith('.dmcdn.net') ||
      host.endsWith('.dailymotion.com') ||
      host.endsWith('.telesco.pe') ||
      host.endsWith('.telegram.org')
    );
  } catch {
    return false;
  }
}

const cache = new Map<string, { expiresAt: number; data: unknown }>();
function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}
function setCached(key: string, data: unknown, ttlMs = 20 * 60 * 1000) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, data });
}

function parseDurationMinutes(lengthText?: string): number {
  if (!lengthText) return 0;
  const parts = lengthText.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 60 + parts[1];
  if (parts.length === 2) return parts[0];
  return 0;
}

function detectVjName(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('vj junior') || lower.includes('v.j junior')) return 'VJ Junior';
  if (lower.includes('vj jingo') || lower.includes('vjjingo')) return 'VJ Jingo';
  if (lower.includes('vj emmy') || lower.includes('vj emmie')) return 'VJ Emmie';
  if (lower.includes('vj mark')) return 'VJ Mark';
  if (lower.includes('vj ice')) return 'VJ Ice P';
  if (lower.includes('vj kevo')) return 'VJ Kevo';
  if (lower.includes('vj ulio')) return 'VJ Ulio';
  if (lower.includes('luganda') || lower.includes('enjogerere') || lower.includes('enjyogere')) {
    return 'Ugandan VJ';
  }
  return undefined;
}

function detectLugandaSubGenre(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('kung fu') || lower.includes('martial') || lower.includes('taichi') || lower.includes('shaolin') || lower.includes('ninja') || lower.includes('karate')) {
    return 'Kung Fu · Luganda';
  }
  if (lower.includes('indian') || lower.includes('bollywood') || lower.includes('hindi') || lower.includes('telugu')) {
    return 'Indian · Luganda';
  }
  if (lower.includes('sci-fi') || lower.includes('sci fi') || lower.includes('alien') || lower.includes('future') || lower.includes('robot')) {
    return 'Sci-Fi · Luganda';
  }
  if (lower.includes('horror') || lower.includes('zombie') || lower.includes('demon') || lower.includes('ghost') || lower.includes('vampire')) {
    return 'Horror · Luganda';
  }
  if (lower.includes('comedy') || lower.includes('love') || lower.includes('romance') || lower.includes('highschool')) {
    return 'Comedy & Drama · Luganda';
  }
  return 'Action · Luganda';
}

const NON_MOVIE_TITLE_RE =
  /\b(review|recap|explain|explained|explanation|breakdown|reaction|analysis|podcast|gameplay|walkthrough|game mode|full album|jazztage|live concert|reveal|teaser|trailer|behind the scenes|on set|audiobook|soundtrack|uno)\b|facts\s*&\s*rev/i;

function isNonMovieTitle(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < 4) return true;
  return NON_MOVIE_TITLE_RE.test(trimmed);
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectUnseenVjFromSlug(slug: string, fallbackVj?: string): string | undefined {
  const clean = slug.toLowerCase().replace(/-/g, ' ');
  const detected = detectVjName(clean);
  if (detected) return detected;
  if (slug.startsWith('vj-kriss-sweet')) return 'VJ Kriss Sweet';
  if (slug.startsWith('vj-mk-kisuule')) return 'VJ MK Kisuule';
  if (slug.startsWith('vj-heavy-q')) return 'VJ Heavy Q';
  if (slug.startsWith('vj-remmy')) return 'VJ Remmy';
  if (slug.startsWith('vj-chris-edwards')) return 'VJ Chris Edwards';
  return fallbackVj;
}

function parseUnseenCatalogHtml(html: string, fallbackVj?: string): { movies: Movie[]; nextScrollUrl?: string } {
  const movies: Movie[] = [];
  const seen = new Set<string>();
  const blocks = html.split('<div class="item r">').slice(1);

  for (const b of blocks) {
    const slugMatch = b.match(/https:\/\/unseen\.africa\/movie\/([^'"\s;]+)/);
    const titleMatch = b.match(/class="item-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    const imgMatch =
      b.match(/background-image:\s*url\('([^']+)'\)/) ||
      b.match(/data-bg="([^"]+)"/);
    const metaMatch = b.match(/class="item-author[^"]*"[^>]*>([\s\S]*?)<\/div>/);

    if (!slugMatch || !titleMatch) continue;
    const slug = slugMatch[1].trim();
    const id = `unseen-${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const title = decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, ''));
    if (!title || isNonMovieTitle(title)) continue;

    const rawMeta = metaMatch ? decodeHtmlEntities(metaMatch[1].replace(/<[^>]+>/g, ' ')) : '';
    const rawPoster = imgMatch?.[1]?.trim();
    const vjName = detectUnseenVjFromSlug(slug, fallbackVj);
    const lowerGenre = rawMeta.toLowerCase();

    const category: MovieCategory = vjName
      ? 'ugandan-vj'
      : lowerGenre.includes('science fiction') || lowerGenre.includes('sci-fi')
      ? 'scifi'
      : lowerGenre.includes('horror')
      ? 'horror'
      : lowerGenre.includes('comedy')
      ? 'comedy'
      : 'action';

    movies.push({
      id,
      archiveId: `unseen:${slug}`,
      title,
      year: 2026,
      durationMinutes: 0,
      genre: rawMeta ? `${rawMeta} · Luganda` : 'Luganda Translated',
      category,
      vjName,
      language: vjName ? 'Luganda Translated' : 'Luganda / English',
      rating: 7.6,
      quality: 'HD',
      country: vjName ? 'Uganda' : 'International',
      director: vjName || 'Unseen Catalog',
      sourceLabel: 'Unseen Catalog',
      posterUrl: rawPoster ? `/api/thumb?url=${encodeURIComponent(rawPoster)}` : undefined,
      synopsis: `${title}${vjName ? ` — Narrated in Luganda by ${vjName}` : ''}. Click Watch Now to resolve verified full-length streams.`,
      accentHex: vjName ? '#F59E0B' : '#10B981',
      streams: [],
    });
  }

  const nextMatch = html.match(/href="(https:\/\/unseen\.africa\/scroll\/movie\.scroll\.php[^"]+)"/);
  const nextScrollUrl = nextMatch?.[1] ? decodeHtmlEntities(nextMatch[1]) : undefined;
  return { movies, nextScrollUrl };
}

function matchesQueryRelevance(query: string, title: string): boolean {
  const stopWords = new Set(['full', 'movie', 'movies', 'hd', '4k', 'free', 'english', 'the', 'and', 'in', 'a', 'of', 'new', 'day']);
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stopWords.has(t));
  if (tokens.length === 0) return true;
  const hay = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const compact = hay.replace(/\s+/g, '');
  const matchCount = tokens.filter((tok) => hay.includes(tok) || compact.includes(tok)).length;
  return matchCount >= Math.min(2, tokens.length);
}

async function isYouTubeEmbeddable(videoId: string): Promise<boolean> {
  try {
    const html = await fetch(`https://www.youtube.com/embed/${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000),
    }).then((r) => r.text());
    return (
      !html.includes('UNPLAYABLE') &&
      !html.includes('Playback on other websites has been disabled') &&
      !html.includes('Video unavailable')
    );
  } catch {
    return false;
  }
}

interface RawYtVideo {
  id: string;
  title: string;
  channel: string;
  minutes: number;
  thumb: string;
}

async function searchYouTubeFullMovies(
  query: string,
  minMinutes = 75,
  limit = 10
): Promise<RawYtVideo[]> {
  try {
    const html = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(7000),
      }
    ).then((r) => r.text());

    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
    if (!match) return [];
    const data = JSON.parse(match[1]) as {
      contents?: {
        twoColumnSearchResultsRenderer?: {
          primaryContents?: {
            sectionListRenderer?: {
              contents?: Array<{
                itemSectionRenderer?: {
                  contents?: Array<{
                    videoRenderer?: {
                      videoId?: string;
                      title?: { runs?: Array<{ text?: string }> };
                      ownerText?: { runs?: Array<{ text?: string }> };
                      lengthText?: { simpleText?: string };
                    };
                  }>;
                };
              }>;
            };
          };
        };
      };
    };

    const sections =
      data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents || [];

    const candidates: RawYtVideo[] = [];
    const seen = new Set<string>();

    for (const sec of sections) {
      for (const item of sec.itemSectionRenderer?.contents || []) {
        const v = item.videoRenderer;
        if (!v?.videoId || seen.has(v.videoId)) continue;
        seen.add(v.videoId);

        const title = (v.title?.runs || []).map((r) => r.text || '').join('').trim();
        const minutes = parseDurationMinutes(v.lengthText?.simpleText);
        if (!title || minutes < minMinutes || isNonMovieTitle(title)) continue;

        candidates.push({
          id: v.videoId,
          title,
          channel: v.ownerText?.runs?.[0]?.text || 'Cinema Channel',
          minutes,
          thumb: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        });
      }
    }

    const subset = candidates.slice(0, limit + 4);
    const checks = await Promise.all(
      subset.map(async (c) => ({ c, ok: await isYouTubeEmbeddable(c.id) }))
    );
    return checks.filter((x) => x.ok).map((x) => x.c).slice(0, limit);
  } catch {
    return [];
  }
}

function mapYtToMovie(v: RawYtVideo, categoryOverride?: MovieCategory, isTrending = false): Movie {
  const detectedVj = detectVjName(`${v.title} ${v.channel}`);
  const lower = v.title.toLowerCase();
  const yearMatch = v.title.match(/\b(202[0-6]|201\d)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : 2025;

  const category: MovieCategory =
    categoryOverride ||
    (detectedVj
      ? 'ugandan-vj'
      : lower.includes('sci-fi') || lower.includes('alien') || lower.includes('dystopian')
      ? 'scifi'
      : lower.includes('horror') || lower.includes('vampire') || lower.includes('demon')
      ? 'horror'
      : lower.includes('kung fu') || lower.includes('wu tang') || lower.includes('shaolin')
      ? 'martial-arts'
      : lower.includes('comedy') || lower.includes('romance')
      ? 'comedy'
      : 'action');

  return {
    id: `yt-${v.id}`,
    archiveId: v.id,
    youtubeId: v.id,
    title: v.title.slice(0, 96),
    year,
    durationMinutes: v.minutes,
    genre: detectedVj ? detectLugandaSubGenre(v.title) : `${v.channel} · Full Movie`,
    category,
    vjName: detectedVj,
    language: detectedVj ? 'Luganda Translated' : 'English',
    rating: 7.5,
    quality: 'HD',
    country: detectedVj ? 'Uganda' : 'International',
    director: v.channel,
    sourceLabel: 'YouTube Full Movie',
    posterUrl: `/api/thumb?url=${encodeURIComponent(v.thumb)}`,
    synopsis: `${v.title} — Full ${v.minutes}-minute feature movie streamed in HD from ${v.channel}.`,
    accentHex: detectedVj ? '#F59E0B' : '#10B981',
    isTrending,
    streams: [
      {
        label: detectedVj ? `${detectedVj} Full Movie` : 'Full Movie Stream',
        quality: 'HD',
        type: 'youtube',
        youtubeId: v.id,
        url: `https://www.youtube-nocookie.com/embed/${v.id}`,
      },
    ],
  };
}

interface DailymotionItem {
  id: string;
  title: string;
  duration: number;
  thumbnail_720_url?: string;
  allow_embed?: boolean;
}

async function searchDailymotionFullMovies(
  query: string,
  minMinutes = 75,
  limit = 10
): Promise<Movie[]> {
  try {
    const url = `https://api.dailymotion.com/videos?search=${encodeURIComponent(
      query
    )}&longer_than=${minMinutes}&limit=${limit + 10}&fields=id,title,duration,thumbnail_720_url,allow_embed`;

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { list?: DailymotionItem[] };

    return (data.list || [])
      .filter(
        (v) =>
          v.allow_embed !== false &&
          v.id &&
          v.title &&
          v.duration >= minMinutes * 60 &&
          !isNonMovieTitle(v.title)
      )
      .slice(0, limit)
      .map((v): Movie => {
        const vjName = detectVjName(v.title);
        const lower = v.title.toLowerCase();
        const yearMatch = v.title.match(/\b(202[0-6]|201\d)\b/);
        const year = yearMatch ? Number(yearMatch[1]) : 2024;
        const mins = Math.round(v.duration / 60);

        const category: MovieCategory = vjName
          ? 'ugandan-vj'
          : lower.includes('sci-fi') || lower.includes('sci fi')
          ? 'scifi'
          : lower.includes('horror')
          ? 'horror'
          : lower.includes('kung fu') || lower.includes('martial')
          ? 'martial-arts'
          : 'action';

        return {
          id: `dm-${v.id}`,
          archiveId: v.id,
          dailymotionId: v.id,
          title: v.title.slice(0, 96),
          year,
          durationMinutes: mins,
          genre: vjName ? `Luganda VJ · Full Movie` : `Full Feature · Action`,
          category,
          vjName,
          language: vjName ? 'Luganda Translated' : 'English',
          rating: 7.3,
          quality: 'HD',
          country: vjName ? 'Uganda' : 'International',
          director: 'Dailymotion Cinema',
          sourceLabel: 'Full Movie Stream',
          posterUrl: v.thumbnail_720_url
            ? `/api/thumb?url=${encodeURIComponent(v.thumbnail_720_url)}`
            : undefined,
          synopsis: `${v.title} — Full ${mins}-minute movie ready to stream.`,
          accentHex: vjName ? '#F59E0B' : '#38BDF8',
          streams: [
            {
              label: vjName ? `${vjName} Full Movie` : 'Full Movie Stream',
              quality: 'HD',
              type: 'dailymotion',
              dailymotionId: v.id,
              url: `https://www.dailymotion.com/embed/video/${v.id}`,
            },
          ],
        };
      });
  } catch {
    return [];
  }
}

async function startServer() {
  const app = express();
  const portArgIdx = process.argv.indexOf('--port');
  const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
  const PORT =
    Number.isFinite(cliPort) && cliPort > 0
      ? cliPort
      : process.env.NODE_ENV === 'production'
      ? Number(process.env.PORT || 3000)
      : 3000;

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', catalogCount: MOVIES_CATALOG.length });
  });

  app.get('/api/movies', (_req, res) => {
    res.json({ movies: MOVIES_CATALOG });
  });

  // 1. Live Full-Length Trending Movies (70-135 min real full movies across major channels + Dailymotion)
  app.get('/api/trending', async (_req, res) => {
    const cached = getCached<Movie[]>('trending-full');
    if (cached) {
      res.json({ movies: cached });
      return;
    }

    try {
      const [movieCentral, filmRise, sciFiZone, dmAction] = await Promise.all([
        searchYouTubeFullMovies('Movie Central full movie action thriller', 75, 10),
        searchYouTubeFullMovies('FilmRise Movies full movie action thriller', 75, 8),
        searchYouTubeFullMovies('THE SCI-FI MOVIE ZONE OR PlayFlicks full movie', 75, 8),
        searchDailymotionFullMovies('full movie english action thriller', 75, 6),
      ]);

      const merged: Movie[] = [];
      const seen = new Set<string>();
      for (const v of [...movieCentral, ...filmRise, ...sciFiZone]) {
        const mapped = mapYtToMovie(v, undefined, true);
        if (!seen.has(mapped.id)) {
          seen.add(mapped.id);
          merged.push(mapped);
        }
      }
      for (const m of dmAction) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          merged.push({ ...m, isTrending: true });
        }
      }

      setCached('trending-full', merged, 20 * 60 * 1000);
      res.json({ movies: merged });
    } catch (err) {
      console.error('Trending full feed error:', err);
      res.json({ movies: [] });
    }
  });

  // 2. Live Multi-App Full-Length Ugandan VJ + Genre Cinema (YouTube + Dailymotion)
  app.get('/api/live-streams', async (_req, res) => {
    const cached = getCached<{ vjMovies: Movie[]; genreMovies: Movie[] }>('live-full-streams');
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const [
        ytVjJunior1,
        ytVjJunior2,
        ytVjJingo,
        ytVjEmmy,
        ytVjIce,
        ytVjMark,
        ytVjKevoUlio,
        ytLugandaKungFu,
        ytLugandaIndian,
        ytLugandaHorrorSciFi,
        dmVjJunior,
        dmVjJingo,
        dmVjEmmy,
        ytHorror,
        ytMartial,
        ytComedy,
        dmSciFi,
      ] = await Promise.all([
        searchYouTubeFullMovies('vj junior full movie luganda translated 2026', 70, 16),
        searchYouTubeFullMovies('vj junior action thriller luganda translated full movie', 70, 14),
        searchYouTubeFullMovies('vj jingo full movie luganda translated', 70, 14),
        searchYouTubeFullMovies('vj emmy full movie luganda translated', 70, 14),
        searchYouTubeFullMovies('vj ice p full movie luganda translated', 70, 12),
        searchYouTubeFullMovies('vj mark full movie luganda translated', 70, 10),
        searchYouTubeFullMovies('vj kevo OR vj ulio full movie luganda translated', 70, 10),
        searchYouTubeFullMovies('luganda translated chinese kung fu full movie', 70, 10),
        searchYouTubeFullMovies('luganda translated indian movie full', 70, 10),
        searchYouTubeFullMovies('luganda translated horror sci fi full movie', 70, 10),
        searchDailymotionFullMovies('vj junior luganda', 70, 6),
        searchDailymotionFullMovies('vj jingo', 70, 6),
        searchDailymotionFullMovies('vj emmy', 70, 4),
        searchYouTubeFullMovies('Kings of Horror full movie horror', 75, 6),
        searchYouTubeFullMovies('Wu Tang Collection full movie martial arts', 75, 6),
        searchYouTubeFullMovies('Maverick Movies full movie comedy', 75, 6),
        searchDailymotionFullMovies('full sci-fi movie english', 75, 5),
      ]);

      const vjSeen = new Set<string>();
      const vjMovies: Movie[] = [];
      for (const ytItem of [
        ...ytVjJunior1,
        ...ytVjJunior2,
        ...ytVjJingo,
        ...ytVjEmmy,
        ...ytVjIce,
        ...ytVjMark,
        ...ytVjKevoUlio,
        ...ytLugandaKungFu,
        ...ytLugandaIndian,
        ...ytLugandaHorrorSciFi,
      ]) {
        const m = mapYtToMovie(ytItem, 'ugandan-vj');
        if (!vjSeen.has(m.id)) {
          vjSeen.add(m.id);
          vjMovies.push({ ...m, vjName: m.vjName || 'Ugandan VJ' });
        }
      }
      for (const dmItem of [...dmVjJunior, ...dmVjJingo, ...dmVjEmmy]) {
        if (!vjSeen.has(dmItem.id)) {
          vjSeen.add(dmItem.id);
          vjMovies.push({ ...dmItem, category: 'ugandan-vj', vjName: dmItem.vjName || 'Ugandan VJ' });
        }
      }

      const genreSeen = new Set<string>();
      const genreMovies: Movie[] = [];
      for (const item of ytHorror) {
        const m = mapYtToMovie(item, 'horror');
        if (!genreSeen.has(m.id)) {
          genreSeen.add(m.id);
          genreMovies.push(m);
        }
      }
      for (const item of ytMartial) {
        const m = mapYtToMovie(item, 'martial-arts');
        if (!genreSeen.has(m.id)) {
          genreSeen.add(m.id);
          genreMovies.push(m);
        }
      }
      for (const item of ytComedy) {
        const m = mapYtToMovie(item, 'comedy');
        if (!genreSeen.has(m.id)) {
          genreSeen.add(m.id);
          genreMovies.push(m);
        }
      }
      for (const m of dmSciFi) {
        if (!genreSeen.has(m.id)) {
          genreSeen.add(m.id);
          genreMovies.push({ ...m, category: 'scifi' });
        }
      }

      const payload = { vjMovies, genreMovies };
      setCached('live-full-streams', payload, 20 * 60 * 1000);
      res.json(payload);
    } catch (err) {
      console.error('Live streams error:', err);
      res.json({ vjMovies: [], genreMovies: [] });
    }
  });

  // On-demand YouTube Ugandan VJ explorer by narrator or sub-genre
  app.get('/api/vj-explore', async (req, res) => {
    const vj = String(req.query.vj || 'all').trim();
    const topic = String(req.query.topic || 'action').trim();
    const page = Math.max(0, Number(req.query.page || 0) || 0);
    const pageModifiers = ['', '2026', '2025', '2024', 'latest', 'part 1'];
    const modifier = pageModifiers[page % pageModifiers.length];

    const qParts: string[] = [];
    if (vj !== 'all') qParts.push(vj);
    if (topic !== 'all') qParts.push(topic);
    qParts.push('luganda translated full movie');
    if (modifier) qParts.push(modifier);
    const query = qParts.join(' ');

    const cacheKey = `vj-explore:${query.toLowerCase()}`;
    const cached = getCached<Movie[]>(cacheKey);
    if (cached) {
      res.json({ movies: cached });
      return;
    }

    try {
      const [ytMovies, dmMovies] = await Promise.all([
        searchYouTubeFullMovies(query, 70, 20),
        searchDailymotionFullMovies(query, 70, 6),
      ]);
      const merged: Movie[] = [];
      const seen = new Set<string>();
      for (const yt of ytMovies) {
        const m = mapYtToMovie(yt, 'ugandan-vj');
        if (!seen.has(m.id)) {
          seen.add(m.id);
          merged.push({ ...m, vjName: m.vjName || 'Ugandan VJ' });
        }
      }
      for (const dm of dmMovies) {
        if (!seen.has(dm.id)) {
          seen.add(dm.id);
          merged.push({ ...dm, category: 'ugandan-vj', vjName: dm.vjName || 'Ugandan VJ' });
        }
      }
      setCached(cacheKey, merged, 20 * 60 * 1000);
      res.json({ movies: merged });
    } catch {
      res.json({ movies: [] });
    }
  });

  // 2B. Unseen Entertainment Public Catalog Bridge (https://unseen.africa)
  app.get('/api/unseen-catalog', async (req, res) => {
    const vjSlug = String(req.query.vj || 'all').trim().toLowerCase();
    const excludeIds = String(req.query.excludeIds || '').trim();
    const cacheKey = `unseen-cat:${vjSlug}:${excludeIds}`;
    const cached = getCached<{ movies: Movie[]; nextExcludeIds?: string }>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      if (excludeIds) {
        const scrollUrl = `https://unseen.africa/scroll/movie.scroll.php?exclude_ids=${encodeURIComponent(
          excludeIds
        )}&watch_status=all&sort=newest&unwatched=0`;
        const html = await fetch(scrollUrl, { headers, signal: AbortSignal.timeout(8000) }).then((r) =>
          r.text()
        );
        const parsed = parseUnseenCatalogHtml(html);
        const nextEx = parsed.nextScrollUrl
          ? new URL(parsed.nextScrollUrl).searchParams.get('exclude_ids') || undefined
          : undefined;
        const payload = { movies: parsed.movies, nextExcludeIds: nextEx };
        setCached(cacheKey, payload, 20 * 60 * 1000);
        res.json(payload);
        return;
      }

      const pages =
        vjSlug !== 'all'
          ? [{ url: `https://unseen.africa/vj/${encodeURIComponent(vjSlug)}`, vj: undefined }]
          : [
              { url: 'https://unseen.africa/movies', vj: undefined },
              { url: 'https://unseen.africa/vj/vj-junior', vj: 'VJ Junior' },
              { url: 'https://unseen.africa/vj/vj-emmy', vj: 'VJ Emmy' },
              { url: 'https://unseen.africa/vj/vj-ice-p', vj: 'VJ Ice P' },
              { url: 'https://unseen.africa/vj/vj-mark', vj: 'VJ Mark' },
              { url: 'https://unseen.africa/vj/vj-jingo', vj: 'VJ Jingo' },
              { url: 'https://unseen.africa/vj/vj-kevo', vj: 'VJ Kevo' },
              { url: 'https://unseen.africa/vj/vj-ulio', vj: 'VJ Ulio' },
            ];

      const htmls = await Promise.all(
        pages.map((p) =>
          fetch(p.url, { headers, signal: AbortSignal.timeout(8000) })
            .then((r) => (r.ok ? r.text() : ''))
            .catch(() => '')
        )
      );

      const merged: Movie[] = [];
      const seen = new Set<string>();
      let nextExcludeIds: string | undefined;

      htmls.forEach((html, idx) => {
        if (!html) return;
        const parsed = parseUnseenCatalogHtml(html, pages[idx].vj);
        if (idx === 0 && parsed.nextScrollUrl) {
          try {
            nextExcludeIds = new URL(parsed.nextScrollUrl).searchParams.get('exclude_ids') || undefined;
          } catch {
            // ignore URL parse
          }
        }
        for (const m of parsed.movies) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            merged.push(m);
          }
        }
      });

      const payload = { movies: merged, nextExcludeIds };
      setCached(cacheKey, payload, 20 * 60 * 1000);
      res.json(payload);
    } catch (err) {
      console.error('Unseen catalog error:', err);
      res.json({ movies: [] });
    }
  });

  // On-demand full-length stream resolver for catalog titles (YouTube Luganda + English + Dailymotion + Archive MP4)
  app.get('/api/resolve-title', async (req, res) => {
    const title = String(req.query.title || '').trim();
    const vj = String(req.query.vj || '').trim();
    if (!title) {
      res.status(400).json({ error: 'Movie title is required' });
      return;
    }

    const cacheKey = `resolve-title:${title.toLowerCase()}:${vj.toLowerCase()}`;
    const cached = getCached<{ streams: StreamSource[]; durationMinutes: number }>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const safeTerm = title.replace(/[()":]/g, ' ').trim();
      const archiveQuery = `(${safeTerm}) AND mediatype:movies AND format:MPEG4 NOT subject:quran`;
      const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
        archiveQuery
      )}&fl[]=identifier,title&sort[]=downloads+desc&rows=6&output=json`;

      const [ytVj, ytFull, dmFull, archiveRes] = await Promise.all([
        vj
          ? searchYouTubeFullMovies(`${title} ${vj} luganda full movie`, 70, 5)
          : searchYouTubeFullMovies(`${title} luganda translated full movie`, 70, 5),
        searchYouTubeFullMovies(`${title} full movie`, 75, 5),
        searchDailymotionFullMovies(title, 75, 5),
        fetch(searchUrl, { signal: AbortSignal.timeout(6000) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      const streams: StreamSource[] = [];
      const seenUrl = new Set<string>();
      let bestDuration = 0;

      for (const v of ytVj.filter((x) => matchesQueryRelevance(title, x.title))) {
        const url = `https://www.youtube-nocookie.com/embed/${v.id}`;
        if (!seenUrl.has(url)) {
          seenUrl.add(url);
          bestDuration = Math.max(bestDuration, v.minutes);
          const detected = detectVjName(`${v.title} ${v.channel}`);
          streams.push({
            label: `${detected || 'Luganda VJ'} · ${v.minutes}m`,
            quality: 'HD',
            type: 'youtube',
            youtubeId: v.id,
            url,
          });
        }
      }

      for (const v of ytFull.filter((x) => matchesQueryRelevance(title, x.title))) {
        const url = `https://www.youtube-nocookie.com/embed/${v.id}`;
        if (!seenUrl.has(url)) {
          seenUrl.add(url);
          bestDuration = Math.max(bestDuration, v.minutes);
          streams.push({
            label: `YouTube Full · ${v.minutes}m`,
            quality: 'HD',
            type: 'youtube',
            youtubeId: v.id,
            url,
          });
        }
      }

      for (const dm of dmFull.filter((x) => matchesQueryRelevance(title, x.title))) {
        const s = dm.streams[0];
        if (s && !seenUrl.has(s.url)) {
          seenUrl.add(s.url);
          bestDuration = Math.max(bestDuration, dm.durationMinutes);
          streams.push({
            ...s,
            label: `Dailymotion · ${dm.durationMinutes}m`,
          });
        }
      }

      const docs =
        (archiveRes as {
          response?: { docs?: Array<{ identifier: string; title?: string }> };
        } | null)?.response?.docs || [];

      const archiveMatches = await Promise.all(
        docs
          .filter((d) => d.identifier && d.title && matchesQueryRelevance(title, String(d.title)))
          .slice(0, 3)
          .map(async (d) => {
            try {
              const meta = (await fetch(`https://archive.org/metadata/${d.identifier}`, {
                signal: AbortSignal.timeout(4500),
              }).then((r) => (r.ok ? r.json() : null))) as {
                files?: Array<{ name?: string; size?: string; length?: string }>;
              } | null;
              const mp4 = (meta?.files || [])
                .filter(
                  (f) =>
                    f.name &&
                    /\.mp4$/i.test(f.name) &&
                    !/big_buck_bunny/i.test(f.name) &&
                    Number(f.size || 0) > 50_000_000
                )
                .sort((a, b) => Number(b.size || 0) - Number(a.size || 0))[0];
              if (!mp4) return null;
              const mins = Math.round(Number(mp4.length || 0) / 60);
              if (mins < 70) return null;
              return {
                label: `Direct MP4 · ${mins}m`,
                quality: Number(mp4.size || 0) > 700_000_000 ? '1080p' : 'HD',
                type: 'mp4' as const,
                url: `https://archive.org/download/${d.identifier}/${encodeURIComponent(mp4.name || '')}`,
                mins,
              };
            } catch {
              return null;
            }
          })
      );

      for (const am of archiveMatches) {
        if (am && !seenUrl.has(am.url)) {
          seenUrl.add(am.url);
          bestDuration = Math.max(bestDuration, am.mins);
          streams.push({
            label: am.label,
            quality: am.quality,
            type: 'mp4',
            url: am.url,
          });
        }
      }

      if (streams.length === 0) {
        res.status(404).json({
          error: `No verified 70m+ public full stream found for "${title}" yet.`,
        });
        return;
      }

      const payload = { streams: streams.slice(0, 8), durationMinutes: bestDuration };
      setCached(cacheKey, payload, 20 * 60 * 1000);
      res.json(payload);
    } catch (err) {
      console.error('Resolve title error:', err);
      res.status(500).json({ error: 'Unable to resolve full movie streams right now.' });
    }
  });

  // 3. Public Telegram Channel Reader (t.me/s/<channel>)
  app.get('/api/telegram', async (req, res) => {
    let rawChannel = String(req.query.channel || 'trailers').trim();
    rawChannel = rawChannel
      .replace(/^https?:\/\/(t\.me|telegram\.me)\/(s\/)?/i, '')
      .replace(/^@/, '')
      .split('/')[0]
      .split('?')[0]
      .trim();

    if (!rawChannel || !/^[a-zA-Z0-9_]{3,64}$/.test(rawChannel)) {
      res.status(400).json({ error: 'Enter a valid Telegram channel handle (e.g. trailers or @channelname)' });
      return;
    }

    const cacheKey = `tg:${rawChannel.toLowerCase()}`;
    const cached = getCached<{ channel: string; title: string; description: string; movies: Movie[] }>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const html = await fetch(`https://t.me/s/${rawChannel}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(7000),
      }).then((r) => r.text());

      if (!html.includes('tgme_widget_message')) {
        res.status(404).json({
          error: `No public broadcast preview found for @${rawChannel}. Ensure it is a public Telegram channel.`,
        });
        return;
      }

      const channelTitle =
        html
          .match(/class="tgme_channel_info_header_title"[^>]*>([\s\S]*?)<\/div>/)?.[1]
          ?.replace(/<[^>]+>/g, '')
          .trim() || `@${rawChannel}`;
      const channelDesc =
        html
          .match(/class="tgme_channel_info_description"[^>]*>([\s\S]*?)<\/div>/)?.[1]
          ?.replace(/<[^>]+>/g, '')
          .trim() || 'Public Telegram movie channel';

      const blocks = html.split('class="tgme_widget_message_wrap').slice(1).reverse();
      const movies: Movie[] = [];

      for (const block of blocks) {
        const postMatch = block.match(/data-post="([^"]+)"/);
        const postId = postMatch?.[1];
        if (!postId) continue;

        const textMatch = block.match(
          /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
        );
        const cleanText = textMatch
          ? textMatch[1]
              .replace(/<br\s*\/?>/gi, ' ')
              .replace(/<[^>]+>/g, '')
              .replace(/\s+/g, ' ')
              .trim()
          : '';

        const photoMatch = block.match(
          /tgme_widget_message_photo_wrap[\s\S]*?background-image:url\('([^']+)'\)/
        );
        const vThumbMatch = block.match(
          /tgme_widget_message_video_thumb[\s\S]*?background-image:url\('([^']+)'\)/
        );
        const videoSrcMatch = block.match(/<video[^>]+src="([^"]+)"/);
        const dateMatch = block.match(/datetime="([^"]+)"/);

        const rawThumb = photoMatch?.[1] || vThumbMatch?.[1] || '';
        const videoSrc = videoSrcMatch?.[1] || '';

        if (!cleanText && !videoSrc && !rawThumb) continue;

        const title =
          cleanText.split(/[\n|]/)[0]?.slice(0, 78) || `Telegram Post #${postId.split('/')[1]}`;
        const vjName = detectVjName(cleanText);
        const year = Number(dateMatch?.[1]?.slice(0, 4)) || 2026;

        const streams: StreamSource[] = [];
        if (videoSrc) {
          streams.push({
            label: 'Telegram Direct Video',
            quality: 'HD MP4',
            type: 'mp4',
            url: videoSrc,
          });
        }
        streams.push({
          label: 'Telegram Post Player',
          quality: 'Embed',
          type: 'telegram',
          telegramPost: postId,
          url: `https://t.me/${postId}?embed=1&dark=1`,
        });

        movies.push({
          id: `tg-${postId.replace('/', '-')}`,
          archiveId: postId,
          telegramPost: postId,
          title,
          year,
          durationMinutes: 0,
          genre: vjName ? `Telegram · ${vjName}` : `Telegram · ${channelTitle}`,
          category: 'telegram',
          vjName,
          language: vjName ? 'Luganda Translated' : 'Telegram Channel',
          rating: 7.5,
          quality: videoSrc ? 'MP4' : 'TG Post',
          country: vjName ? 'Uganda' : 'Telegram',
          director: channelTitle,
          sourceLabel: videoSrc ? 'TG Video' : 'TG Post',
          posterUrl: rawThumb ? `/api/thumb?url=${encodeURIComponent(rawThumb)}` : undefined,
          synopsis: cleanText || `Shared from Telegram channel @${rawChannel}.`,
          accentHex: '#38BDF8',
          streams,
        });
      }

      const payload = {
        channel: rawChannel,
        title: channelTitle,
        description: channelDesc,
        movies: movies.slice(0, 24),
      };
      setCached(cacheKey, payload, 5 * 60 * 1000);
      res.json(payload);
    } catch (err) {
      console.error('Telegram parse error:', err);
      res.status(502).json({ error: 'Unable to fetch Telegram channel preview right now.' });
    }
  });

  // 4. Triple-Source Live Search (YouTube Full Movies + Dailymotion Full Movies + Archive.org MP4 Vault)
  app.get('/api/discover', async (req, res) => {
    const rawQuery = String(req.query.q || '').trim();
    if (!rawQuery) {
      res.json({ movies: [] });
      return;
    }

    try {
      const safeTerm = rawQuery.replace(/[()":]/g, ' ').trim();
      const archiveQuery = `(${safeTerm}) AND mediatype:movies AND format:MPEG4 NOT subject:quran`;
      const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
        archiveQuery
      )}&fl[]=identifier,title,year,description,downloads&sort[]=downloads+desc&rows=12&output=json`;

      const [ytResults, dmResults, archiveRes] = await Promise.all([
        searchYouTubeFullMovies(`${rawQuery} full movie`, 75, 10),
        searchDailymotionFullMovies(rawQuery, 75, 10),
        fetch(searchUrl, { signal: AbortSignal.timeout(7000) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      const ytMovies = ytResults
        .filter((v) => matchesQueryRelevance(rawQuery, v.title))
        .map((v) => mapYtToMovie(v));

      const dmFiltered = dmResults.filter((m) => matchesQueryRelevance(rawQuery, m.title));

      const docs =
        (archiveRes as {
          response?: {
            docs?: Array<{
              identifier: string;
              title?: string;
              year?: string | number;
              description?: string | string[];
            }>;
          };
        } | null)?.response?.docs || [];

      const candidateDocs = docs
        .filter(
          (d) =>
            d.identifier &&
            d.title &&
            !isNonMovieTitle(String(d.title)) &&
            matchesQueryRelevance(rawQuery, String(d.title))
        )
        .slice(0, 8);

      const resolvedArchive = await Promise.all(
        candidateDocs.map(async (d): Promise<Movie | null> => {
          try {
            const metaRes = await fetch(`https://archive.org/metadata/${d.identifier}`, {
              signal: AbortSignal.timeout(5000),
            });
            if (!metaRes.ok) return null;
            const meta = (await metaRes.json()) as {
              files?: Array<{ name?: string; size?: string; length?: string }>;
            };
            const mp4Files = (meta.files || [])
              .filter(
                (f) =>
                  f.name &&
                  /\.(mp4|m4v|webm)$/i.test(f.name) &&
                  !f.name.endsWith('.ia.mp4') &&
                  !/big_buck_bunny/i.test(f.name) &&
                  Number(f.size || 0) > 50_000_000
              )
              .sort((a, b) => Number(b.size || 0) - Number(a.size || 0));

            const fallbackMp4 =
              mp4Files.length > 0
                ? mp4Files
                : (meta.files || [])
                    .filter(
                      (f) =>
                        f.name &&
                        /\.mp4$/i.test(f.name) &&
                        !/big_buck_bunny/i.test(f.name) &&
                        Number(f.size || 0) > 50_000_000
                    )
                    .sort((a, b) => Number(b.size || 0) - Number(a.size || 0));

            if (fallbackMp4.length === 0) return null;
            const lengthSeconds = Number(fallbackMp4[0].length || 0);
            const durationMinutes = Math.round(lengthSeconds / 60);
            // Enforce genuine feature-length runtime (>= 70 minutes)
            if (durationMinutes < 70) return null;

            const titleStr = String(d.title);
            const detectedVj = detectVjName(titleStr);
            const descRaw = Array.isArray(d.description)
              ? d.description.join(' ')
              : d.description || '';
            const cleanDesc =
              descRaw.replace(/<[^>]*>/g, '').trim().slice(0, 220) ||
              'Full feature stream sourced directly from the Internet Archive vault with zero ads.';
            const parsedYear = Number(String(d.year || '').slice(0, 4));

            const streams: StreamSource[] = fallbackMp4.slice(0, 3).map((f, idx) => ({
              label: idx === 0 ? 'Primary MP4 Stream' : `Mirror Print ${idx + 1}`,
              quality: Number(f.size || 0) > 700_000_000 ? '1080p' : 'HD',
              type: 'mp4',
              url: `https://archive.org/download/${d.identifier}/${encodeURIComponent(f.name || '')}`,
            }));

            return {
              id: `ia-${d.identifier}`,
              archiveId: d.identifier,
              title: titleStr.slice(0, 90),
              year: Number.isFinite(parsedYear) && parsedYear > 1900 ? parsedYear : 2022,
              durationMinutes,
              genre: detectedVj ? 'Ugandan VJ · Archive MP4' : 'Archive Vault · Feature',
              category: detectedVj ? 'ugandan-vj' : 'action',
              vjName: detectedVj,
              language: detectedVj ? 'Luganda Translated' : 'English',
              rating: 7.2,
              quality: 'HD',
              country: detectedVj ? 'Uganda' : 'International',
              sourceLabel: 'Direct MP4',
              posterUrl: `/api/poster/${encodeURIComponent(d.identifier)}`,
              synopsis: cleanDesc,
              accentHex: detectedVj ? '#F59E0B' : '#10B981',
              streams,
              isLiveDiscovered: true,
            };
          } catch {
            return null;
          }
        })
      );

      const archiveMovies = resolvedArchive.filter((m): m is Movie => Boolean(m));

      const merged: Movie[] = [];
      const seen = new Set<string>();
      for (const m of [...ytMovies, ...dmFiltered, ...archiveMovies]) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          merged.push(m);
        }
      }
      res.json({ movies: merged });
    } catch (error) {
      console.error('Discover error:', error);
      res.status(500).json({ error: 'Unable to query live film sources' });
    }
  });

  // Resolve real MP4 files for any Archive.org identifier on demand
  app.get('/api/resolve/:identifier', async (req, res) => {
    const identifier = req.params.identifier;
    if (!identifier || !/^[a-zA-Z0-9._-]+$/.test(identifier)) {
      res.status(400).json({ error: 'Invalid archive identifier' });
      return;
    }

    try {
      const metaRes = await fetch(`https://archive.org/metadata/${identifier}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!metaRes.ok) {
        res.status(404).json({ error: 'Item metadata not found' });
        return;
      }

      const meta = (await metaRes.json()) as {
        files?: Array<{ name?: string; size?: string; length?: string }>;
      };

      const mp4Files = (meta.files || [])
        .filter((f) => f.name && /\.(mp4|m4v|webm)$/i.test(f.name) && !f.name.endsWith('.ia.mp4'))
        .sort((a, b) => Number(b.size || 0) - Number(a.size || 0));

      const fallbackMp4 =
        mp4Files.length > 0
          ? mp4Files
          : (meta.files || [])
              .filter((f) => f.name && /\.mp4$/i.test(f.name))
              .sort((a, b) => Number(b.size || 0) - Number(a.size || 0));

      if (fallbackMp4.length === 0) {
        res.status(404).json({ error: 'No MP4 stream available for this title' });
        return;
      }

      const streams: StreamSource[] = fallbackMp4.slice(0, 3).map((f, idx) => ({
        label: idx === 0 ? 'Primary MP4 Stream' : `Mirror Print ${idx + 1}`,
        quality: Number(f.size || 0) > 700_000_000 ? '1080p' : 'HD',
        type: 'mp4',
        url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name || '')}`,
      }));

      const durationMinutes = Math.max(
        1,
        Math.round(Number(fallbackMp4[0].length || 5400) / 60)
      );

      res.json({ streams, durationMinutes });
    } catch (error) {
      console.error('Resolve error:', error);
      res.status(500).json({ error: 'Failed to resolve MP4 stream' });
    }
  });

  // HTTP Range Stream Relay (Server 2)
  app.get('/api/stream', async (req, res) => {
    const targetUrl = String(req.query.url || '');
    if (!targetUrl || !isAllowedMediaUrl(targetUrl)) {
      res.status(400).json({ error: 'Invalid or disallowed stream source' });
      return;
    }

    try {
      const headers: Record<string, string> = {};
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const upstream = await fetch(targetUrl, {
        headers,
        redirect: 'follow',
      });

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).end();
        return;
      }

      res.status(upstream.status);
      for (const h of [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
      ]) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      if (!upstream.headers.get('accept-ranges')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }

      if (!upstream.body) {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(
        upstream.body as unknown as import('stream/web').ReadableStream
      );
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502);
        res.end();
      });
      req.on('close', () => nodeStream.destroy());
      nodeStream.pipe(res);
    } catch (error) {
      console.error('Stream proxy error:', error);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Stream relay error' });
      }
    }
  });

  // Safe image proxy for YouTube, Dailymotion, Telegram, and Archive thumbnails
  app.get('/api/thumb', async (req, res) => {
    const rawUrl = String(req.query.url || '');
    if (!rawUrl || !isAllowedThumbUrl(rawUrl)) {
      res.status(400).end();
      return;
    }

    try {
      const imgRes = await fetch(rawUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(6000),
      });
      if (!imgRes.ok || !imgRes.body) {
        res.status(404).end();
        return;
      }
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        res.status(404).end();
        return;
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buf = Buffer.from(await imgRes.arrayBuffer());
      res.send(buf);
    } catch {
      res.status(404).end();
    }
  });

  app.get('/api/poster/:identifier', async (req, res) => {
    const identifier = req.params.identifier;
    if (!identifier || !/^[a-zA-Z0-9._-]+$/.test(identifier)) {
      res.status(404).end();
      return;
    }

    try {
      const imgRes = await fetch(`https://archive.org/services/img/${identifier}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      if (!imgRes.ok || !imgRes.body) {
        res.status(404).end();
        return;
      }
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        res.status(404).end();
        return;
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buf = Buffer.from(await imgRes.arrayBuffer());
      res.send(buf);
    } catch {
      res.status(404).end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HDToday server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
