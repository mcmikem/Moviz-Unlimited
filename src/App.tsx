import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MOVIES_CATALOG } from './data/catalog.ts';
import type { Movie, WatchProgress } from './types/movie.ts';
import { Header, type NavSection } from './components/Header.tsx';
import { HeroShowcase } from './components/HeroShowcase.tsx';
import { CatalogToolbar, type CategoryFilter } from './components/CatalogToolbar.tsx';
import { MovieCard } from './components/MovieCard.tsx';
import { TheaterPlayer } from './components/TheaterPlayer.tsx';
import { TelegramPanel } from './components/TelegramPanel.tsx';

const WATCHLIST_KEY = 'hdtoday_watchlist_v1';
const PROGRESS_KEY = 'hdtoday_progress_v1';

const VJ_TOPICS: Array<{ id: string; label: string; keywords: string[] }> = [
  { id: 'all', label: 'All Topics', keywords: [] },
  { id: 'action', label: 'Action', keywords: ['action', 'thriller', 'sniper', 'commando', 'mercenary', 'war', 'gun'] },
  { id: 'kung fu martial arts', label: 'Kung Fu', keywords: ['kung fu', 'martial', 'shaolin', 'ninja', 'karate', 'taichi', 'chinese'] },
  { id: 'indian', label: 'Indian', keywords: ['indian', 'bollywood', 'hindi', 'telugu'] },
  { id: 'sci-fi', label: 'Sci-Fi', keywords: ['sci-fi', 'sci fi', 'alien', 'future', 'robot', 'space'] },
  { id: 'horror', label: 'Horror', keywords: ['horror', 'zombie', 'demon', 'ghost', 'vampire'] },
  { id: 'comedy romance', label: 'Comedy & Drama', keywords: ['comedy', 'drama', 'love', 'romance', 'highschool'] },
];

export default function App() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [curatedMovies] = useState<Movie[]>(MOVIES_CATALOG);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [liveVjMovies, setLiveVjMovies] = useState<Movie[]>([]);
  const [extraVjMovies, setExtraVjMovies] = useState<Movie[]>([]);
  const [unseenMovies, setUnseenMovies] = useState<Movie[]>([]);
  const [unseenNextExcludeIds, setUnseenNextExcludeIds] = useState<string | undefined>(undefined);
  const [loadingMoreUnseen, setLoadingMoreUnseen] = useState<boolean>(false);
  const [liveGenreMovies, setLiveGenreMovies] = useState<Movie[]>([]);
  const [loadingLiveFeeds, setLoadingLiveFeeds] = useState<boolean>(true);
  const [isLoadingMoreVj, setIsLoadingMoreVj] = useState<boolean>(false);

  const [activeNav, setActiveNav] = useState<NavSection>('home');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [activeVj, setActiveVj] = useState<string>('all');
  const [activeVjTopic, setActiveVjTopic] = useState<string>('all');
  const [vjExplorePage, setVjExplorePage] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [liveMovies, setLiveMovies] = useState<Movie[]>([]);
  const [liveModeActive, setLiveModeActive] = useState<boolean>(false);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const [heroIndex, setHeroIndex] = useState<number>(0);
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [progressMap, setProgressMap] = useState<Record<string, WatchProgress>>(() => {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, WatchProgress>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch {
      // Ignore storage errors
    }
  }, [watchlist]);

  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressMap));
    } catch {
      // Ignore storage errors
    }
  }, [progressMap]);

  // Load real full-length movies across Trending, Ugandan VJ, and Genre catalogs
  useEffect(() => {
    let active = true;
    setLoadingLiveFeeds(true);

    Promise.all([
      fetch('/api/trending')
        .then((r) => (r.ok ? (r.json() as Promise<{ movies: Movie[] }>) : { movies: [] }))
        .catch(() => ({ movies: [] })),
      fetch('/api/live-streams')
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{ vjMovies: Movie[]; genreMovies: Movie[] }>)
            : { vjMovies: [], genreMovies: [] }
        )
        .catch(() => ({ vjMovies: [], genreMovies: [] })),
      fetch('/api/unseen-catalog')
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{ movies: Movie[]; nextExcludeIds?: string }>)
            : { movies: [] as Movie[], nextExcludeIds: undefined }
        )
        .catch(() => ({ movies: [] as Movie[], nextExcludeIds: undefined })),
    ]).then(([trendData, liveData, unseenData]) => {
      if (!active) return;
      setTrendingMovies(trendData.movies || []);
      setLiveVjMovies(liveData.vjMovies || []);
      setLiveGenreMovies(liveData.genreMovies || []);
      setUnseenMovies(unseenData.movies || []);
      setUnseenNextExcludeIds(unseenData.nextExcludeIds);
      setLoadingLiveFeeds(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleLoadMoreUnseen = async () => {
    if (!unseenNextExcludeIds || loadingMoreUnseen) return;
    setLoadingMoreUnseen(true);
    try {
      const res = await fetch(
        `/api/unseen-catalog?excludeIds=${encodeURIComponent(unseenNextExcludeIds)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { movies?: Movie[]; nextExcludeIds?: string };
      const incoming = data.movies || [];
      if (incoming.length > 0) {
        setUnseenMovies((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const additions = incoming.filter((m) => !seen.has(m.id));
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      }
      setUnseenNextExcludeIds(data.nextExcludeIds);
    } catch {
      // Ignore network hiccup
    } finally {
      setLoadingMoreUnseen(false);
    }
  };

  const allMovies = useMemo(() => {
    const combined: Movie[] = [];
    const seen = new Set<string>();
    for (const m of [
      ...curatedMovies,
      ...liveVjMovies,
      ...extraVjMovies,
      ...unseenMovies,
      ...trendingMovies,
      ...liveGenreMovies,
    ]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        combined.push(m);
      }
    }
    return combined;
  }, [curatedMovies, liveVjMovies, extraVjMovies, unseenMovies, trendingMovies, liveGenreMovies]);

  const featuredMovies = useMemo(
    () => curatedMovies.filter((m) => m.featured).slice(0, 4),
    [curatedMovies]
  );

  const allUgandanVjMovies = useMemo(() => {
    const curatedVj = curatedMovies.filter((m) => m.category === 'ugandan-vj');
    const merged: Movie[] = [...curatedVj];
    const seen = new Set(curatedVj.map((m) => m.id));
    for (const m of [...liveVjMovies, ...extraVjMovies, ...unseenMovies]) {
      if (m.category === 'ugandan-vj' && !seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
    return merged;
  }, [curatedMovies, liveVjMovies, extraVjMovies, unseenMovies]);

  const continueWatchingList = useMemo(() => {
    return Object.values(progressMap)
      .filter((p) => p.currentTime > 10 && p.duration > 0 && p.currentTime / p.duration < 0.96)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((p) => allMovies.find((m) => m.id === p.movieId) || p.movieSnapshot)
      .filter((m): m is Movie => Boolean(m))
      .slice(0, 6);
  }, [progressMap, allMovies]);

  const handleToggleWatchlist = (movie: Movie) => {
    setWatchlist((prev) =>
      prev.includes(movie.id) ? prev.filter((id) => id !== movie.id) : [...prev, movie.id]
    );
  };

  const handleProgressUpdate = (movie: Movie, currentTime: number, duration: number) => {
    setProgressMap((prev) => ({
      ...prev,
      [movie.id]: {
        movieId: movie.id,
        currentTime,
        duration,
        updatedAt: Date.now(),
        movieSnapshot: movie,
      },
    }));
  };

  const handleSelectNav = (nav: NavSection) => {
    setActiveMovie(null);
    setActiveNav(nav);
    setLiveModeActive(false);
    setDiscoverError(null);

    if (nav === 'home') {
      setActiveCategory('all');
      setActiveVj('all');
      setSearchQuery('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (nav === 'trending') {
      setActiveCategory('trending');
      setActiveVj('all');
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (nav === 'ugandan-vj') {
      setActiveCategory('ugandan-vj');
      setActiveVj('all');
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (nav === 'telegram') {
      setActiveCategory('telegram');
      setActiveVj('all');
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (nav === 'my-list') {
      setActiveCategory('my-list');
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSearchTrigger = () => {
    setActiveMovie(null);
    setTimeout(() => {
      searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      searchInputRef.current?.focus();
    }, 60);
  };

  const handleLiveSearch = async (query: string) => {
    setIsDiscovering(true);
    setDiscoverError(null);
    setLiveModeActive(true);
    try {
      const res = await fetch(`/api/discover?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Could not reach live film vault');
      const data = (await res.json()) as { movies: Movie[] };
      setLiveMovies(data.movies || []);
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : 'Live search failed');
      setLiveMovies([]);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleExploreMoreVj = async (vj = activeVj, topic = activeVjTopic, pageOverride?: number) => {
    const nextPage = pageOverride ?? vjExplorePage;
    setIsLoadingMoreVj(true);
    try {
      const res = await fetch(
        `/api/vj-explore?vj=${encodeURIComponent(vj)}&topic=${encodeURIComponent(
          topic
        )}&page=${nextPage}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { movies?: Movie[] };
      const incoming = data.movies || [];
      if (incoming.length > 0) {
        setExtraVjMovies((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const additions = incoming.filter((m) => !seen.has(m.id));
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      }
      setVjExplorePage(nextPage + 1);
    } catch {
      // Ignore network hiccup on optional expand
    } finally {
      setIsLoadingMoreVj(false);
    }
  };

  const filteredMovies = useMemo(() => {
    let list = [...allMovies];

    if (activeCategory === 'my-list') {
      list = list.filter((m) => watchlist.includes(m.id));
    } else if (activeCategory === 'trending') {
      list = trendingMovies;
    } else if (activeCategory === 'ugandan-vj') {
      list = allUgandanVjMovies;
    } else if (activeCategory !== 'all') {
      list = list.filter((m) => m.category === activeCategory);
    }

    if (activeVj !== 'all') {
      list = list.filter((m) => m.vjName?.toLowerCase() === activeVj.toLowerCase());
    }

    if (activeCategory === 'ugandan-vj' && activeVjTopic !== 'all') {
      const topicMeta = VJ_TOPICS.find((t) => t.id === activeVjTopic);
      if (topicMeta && topicMeta.keywords.length > 0) {
        list = list.filter((m) => {
          const hay = `${m.title} ${m.genre} ${m.synopsis}`.toLowerCase();
          return topicMeta.keywords.some((kw) => hay.includes(kw));
        });
      }
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.genre.toLowerCase().includes(q) ||
          m.synopsis.toLowerCase().includes(q) ||
          (m.vjName && m.vjName.toLowerCase().includes(q)) ||
          (m.director && m.director.toLowerCase().includes(q))
      );
    }

    return list;
  }, [
    allMovies,
    trendingMovies,
    allUgandanVjMovies,
    activeCategory,
    activeVj,
    activeVjTopic,
    searchQuery,
    watchlist,
  ]);

  const upNextForPlayer = useMemo(() => {
    if (!activeMovie) return [];
    const pool = [...allUgandanVjMovies, ...trendingMovies, ...liveGenreMovies, ...curatedMovies];
    const sameCategory = pool.filter(
      (m) => m.id !== activeMovie.id && m.category === activeMovie.category
    );
    const others = pool.filter(
      (m) => m.id !== activeMovie.id && m.category !== activeMovie.category
    );
    const unique: Movie[] = [];
    const seen = new Set<string>();
    for (const m of [...sameCategory, ...others]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        unique.push(m);
      }
      if (unique.length >= 6) break;
    }
    return unique;
  }, [activeMovie, allUgandanVjMovies, trendingMovies, liveGenreMovies, curatedMovies]);

  const getProgressRatio = (movieId: string) => {
    const p = progressMap[movieId];
    if (!p || !p.duration) return undefined;
    return p.currentTime / p.duration;
  };

  if (activeMovie) {
    return (
      <div className="min-h-screen bg-[#0B0D12] text-slate-100">
        <Header
          activeNav={activeNav}
          onSelectNav={handleSelectNav}
          onSearchClick={handleSearchTrigger}
        />
        <TheaterPlayer
          movie={activeMovie}
          savedSeconds={progressMap[activeMovie.id]?.currentTime || 0}
          inWatchlist={watchlist.includes(activeMovie.id)}
          upNext={upNextForPlayer}
          onClose={() => setActiveMovie(null)}
          onSelectMovie={(m) => {
            setActiveMovie(m);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onToggleWatchlist={handleToggleWatchlist}
          onProgressUpdate={handleProgressUpdate}
        />
      </div>
    );
  }

  const showHomeRows =
    activeNav === 'home' &&
    activeCategory === 'all' &&
    activeVj === 'all' &&
    !searchQuery.trim() &&
    !liveModeActive;

  return (
    <div className="min-h-screen bg-[#0B0D12] text-slate-100 flex flex-col">
      <Header
        activeNav={activeNav}
        onSelectNav={handleSelectNav}
        onSearchClick={handleSearchTrigger}
      />

      <main className="flex-1">
        {activeNav === 'home' && !liveModeActive && (
          <HeroShowcase
            featuredMovies={featuredMovies}
            activeIndex={heroIndex}
            onSelectIndex={setHeroIndex}
            onPlay={(m) => {
              setActiveMovie(m);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            inWatchlist={(id) => watchlist.includes(id)}
            onToggleWatchlist={handleToggleWatchlist}
          />
        )}

        <div id="catalog-section">
          <CatalogToolbar
            searchInputRef={searchInputRef}
            activeCategory={activeCategory}
            onSelectCategory={(cat) => {
              setActiveCategory(cat);
              if (cat !== 'ugandan-vj' && cat !== 'all') {
                setActiveVj('all');
              }
            }}
            activeVj={activeVj}
            onSelectVj={setActiveVj}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              if (!q.trim()) {
                setLiveModeActive(false);
              }
            }}
            onLiveSearch={handleLiveSearch}
            isDiscovering={isDiscovering}
            liveModeActive={liveModeActive}
            onClearLiveMode={() => {
              setLiveModeActive(false);
              setDiscoverError(null);
            }}
          />
        </div>

        <div className="mx-auto max-w-[1360px] space-y-12 px-4 py-10 sm:px-6 lg:px-8">
          {/* Continue Watching row */}
          {showHomeRows && continueWatchingList.length > 0 && (
            <section aria-label="Continue watching" className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold tracking-tight text-white">
                  Continue Watching
                </h2>
                <span className="text-xs text-slate-400 tabular-nums">
                  {continueWatchingList.length} in progress
                </span>
              </div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {continueWatchingList.map((movie) => (
                  <MovieCard
                    key={`cw-${movie.id}`}
                    movie={movie}
                    inWatchlist={watchlist.includes(movie.id)}
                    progressRatio={getProgressRatio(movie.id)}
                    onPlay={(m) => {
                      setActiveMovie(m);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onToggleWatchlist={handleToggleWatchlist}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Home Spotlight 1: Trending Full-Length Action & Thriller Movies */}
          {showHomeRows && (
            <section aria-label="Trending Full Movies" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 border-b border-white/8 pb-3">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight text-white">
                    Trending Full Movies
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Real 70–135 minute action, sci-fi, and thriller movies ready to stream in full
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCategory('trending')}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  View all {trendingMovies.length || ''}
                </button>
              </div>
              {loadingLiveFeeds && trendingMovies.length === 0 ? (
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[3/4] animate-pulse rounded-xl bg-[#13161F]"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {trendingMovies.slice(0, 12).map((movie) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      inWatchlist={watchlist.includes(movie.id)}
                      progressRatio={getProgressRatio(movie.id)}
                      onPlay={(m) => {
                        setActiveMovie(m);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onToggleWatchlist={handleToggleWatchlist}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Home Spotlight 2: Unseen Luganda Catalog Releases */}
          {showHomeRows && unseenMovies.length > 0 && (
            <section aria-label="Latest Luganda Catalog Releases" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 border-b border-white/8 pb-3">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight text-white">
                    Latest Luganda Releases (Unseen Catalog)
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Latest translated cinema with official posters — resolves verified 70m+ full streams on play
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCategory('ugandan-vj')}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  View all {unseenMovies.length}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {unseenMovies.slice(0, 18).map((movie) => (
                  <MovieCard
                    key={`unseen-home-${movie.id}`}
                    movie={movie}
                    inWatchlist={watchlist.includes(movie.id)}
                    progressRatio={getProgressRatio(movie.id)}
                    onPlay={(m) => {
                      setActiveMovie(m);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onToggleWatchlist={handleToggleWatchlist}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Home Spotlight 3: Ugandan VJ Full Movies */}
          {showHomeRows && (
            <section aria-label="Ugandan VJ Translated Full Movies" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 border-b border-white/8 pb-3">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight text-white">
                    Ugandan VJ Translated Full Movies
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Instant full-length Luganda movies by VJ Junior, VJ Jingo, VJ Emmy, VJ Mark, VJ Ice P, VJ Kevo, and VJ Ulio
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCategory('ugandan-vj')}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  View all {allUgandanVjMovies.length}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {allUgandanVjMovies.slice(0, 24).map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    inWatchlist={watchlist.includes(movie.id)}
                    progressRatio={getProgressRatio(movie.id)}
                    onPlay={(m) => {
                      setActiveMovie(m);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onToggleWatchlist={handleToggleWatchlist}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Telegram Public Channels View */}
          {!liveModeActive && activeCategory === 'telegram' ? (
            <TelegramPanel
              watchlist={watchlist}
              onPlay={(m) => {
                setActiveMovie(m);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onToggleWatchlist={handleToggleWatchlist}
              getProgressRatio={getProgressRatio}
            />
          ) : liveModeActive ? (
            <section aria-label="Live Search results" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight text-white">
                    Full Movies Matching “{searchQuery}”
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Aggregated across full-length YouTube channels, Dailymotion, and Archive.org MP4s
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLiveModeActive(false)}
                  className="rounded-lg border border-white/10 bg-[#141822] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1C212E] cursor-pointer"
                >
                  Return to Catalog
                </button>
              </div>

              {isDiscovering ? (
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[3/4] animate-pulse rounded-xl bg-[#13161F]"
                    />
                  ))}
                </div>
              ) : discoverError ? (
                <div className="rounded-xl border border-white/8 bg-[#13161F] p-8 text-center">
                  <p className="text-sm font-medium text-slate-200">{discoverError}</p>
                </div>
              ) : liveMovies.length === 0 ? (
                <div className="rounded-xl border border-white/8 bg-[#13161F] p-8 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-200">
                    No full movies matched that query.
                  </p>
                  <p className="text-xs text-slate-400">
                    Try searching "VJ Junior 2026", "Action Thriller", or "Kung Fu".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {liveMovies.map((movie) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      inWatchlist={watchlist.includes(movie.id)}
                      progressRatio={getProgressRatio(movie.id)}
                      onPlay={(m) => {
                        setActiveMovie(m);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onToggleWatchlist={handleToggleWatchlist}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section aria-label="Movie catalog" className="space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/8 pb-3">
                <h2 className="font-display text-xl font-bold tracking-tight text-white">
                  {activeCategory === 'my-list'
                    ? 'My Watchlist'
                    : activeCategory === 'trending'
                    ? 'Trending Full Movies'
                    : activeCategory === 'ugandan-vj'
                    ? 'Ugandan VJ Translated Full Movies'
                    : showHomeRows
                    ? 'Complete Full-Movie Library'
                    : 'Filtered Full Movies'}
                </h2>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {filteredMovies.length} titles
                </span>
              </div>

              {activeCategory === 'ugandan-vj' && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {VJ_TOPICS.map((topic) => {
                      const active = activeVjTopic === topic.id;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => {
                            setActiveVjTopic(topic.id);
                            if (topic.id !== 'all') {
                              handleExploreMoreVj(activeVj, topic.id, 0);
                            }
                          }}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                              : 'bg-[#141822] text-slate-300 border border-white/8 hover:text-white'
                          }`}
                        >
                          {topic.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={isLoadingMoreVj}
                    onClick={() => handleExploreMoreVj(activeVj, activeVjTopic)}
                    className="rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isLoadingMoreVj
                      ? 'Fetching YouTube VJ Movies...'
                      : 'Load More Translated Movies from YouTube'}
                  </button>
                </div>
              )}

              {filteredMovies.length === 0 ? (
                <div className="rounded-xl border border-white/8 bg-[#13161F] p-10 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-200">
                    {activeCategory === 'my-list'
                      ? 'Your watchlist is empty. Click the bookmark button on any movie poster to save it here.'
                      : 'No local titles matched your filter.'}
                  </p>
                  {activeCategory === 'ugandan-vj' ? (
                    <button
                      type="button"
                      disabled={isLoadingMoreVj}
                      onClick={() => handleExploreMoreVj(activeVj, activeVjTopic)}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                    >
                      {isLoadingMoreVj
                        ? 'Fetching YouTube VJ Movies...'
                        : 'Fetch Translated Movies from YouTube'}
                    </button>
                  ) : searchQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => handleLiveSearch(searchQuery.trim())}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                    >
                      Find Full Movies for “{searchQuery.trim()}”
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {filteredMovies.map((movie) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                        inWatchlist={watchlist.includes(movie.id)}
                        progressRatio={getProgressRatio(movie.id)}
                        onPlay={(m) => {
                          setActiveMovie(m);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onToggleWatchlist={handleToggleWatchlist}
                      />
                    ))}
                  </div>

                  {activeCategory === 'ugandan-vj' && (
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        disabled={isLoadingMoreVj}
                        onClick={() => handleExploreMoreVj(activeVj, activeVjTopic)}
                        className="rounded-lg border border-white/12 bg-[#141822] px-5 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-500/40 hover:text-white disabled:opacity-50 cursor-pointer"
                      >
                        {isLoadingMoreVj
                          ? 'Loading more Luganda translated movies...'
                          : 'Load More YouTube Luganda Movies'}
                      </button>

                      {unseenNextExcludeIds && (
                        <button
                          type="button"
                          disabled={loadingMoreUnseen}
                          onClick={handleLoadMoreUnseen}
                          className="rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-5 py-2.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 cursor-pointer"
                        >
                          {loadingMoreUnseen
                            ? 'Loading more Unseen releases...'
                            : 'Load More from Unseen Catalog'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </main>

      <footer className="border-t border-white/8 bg-[#0E1118]">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-3 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-bold text-slate-200">
              HD<span className="text-emerald-400">Today</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>Full-length movies, Ugandan VJ cinema, and Telegram channel feeds</span>
          </div>
          <p>Direct MP4, HTTP range relay & multi-source embeds</p>
        </div>
      </footer>
    </div>
  );
}
