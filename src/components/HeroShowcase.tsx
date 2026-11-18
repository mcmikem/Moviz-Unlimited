import React from 'react';
import { Bookmark, Check, Play } from 'lucide-react';
import type { Movie } from '../types/movie.ts';

interface HeroShowcaseProps {
  featuredMovies: Movie[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
  onPlay: (movie: Movie) => void;
  inWatchlist: (movieId: string) => boolean;
  onToggleWatchlist: (movie: Movie) => void;
}

const BACKDROP_BY_ID: Record<string, string> = {
  'who-killed-captain-alex': '/src/assets/images/hero_wakaliwood_cinema_1794947709114.jpg',
  'forbidden-kingdom-vj-mark': '/src/assets/images/poster_vj_action_1794947708826.jpg',
  'tears-of-steel': '/src/assets/images/poster_scifi_vfx_1794947709573.jpg',
  'night-of-the-living-dead': '/src/assets/images/poster_midnight_horror_1794947709471.jpg',
  'charade-1963': '/src/assets/images/poster_noir_thriller_1794947710485.jpg',
};

export const HeroShowcase: React.FC<HeroShowcaseProps> = ({
  featuredMovies,
  activeIndex,
  onSelectIndex,
  onPlay,
  inWatchlist,
  onToggleWatchlist,
}) => {
  const movie = featuredMovies[activeIndex] || featuredMovies[0];
  if (!movie) return null;

  const backdropSrc =
    movie.heroBackdrop ||
    BACKDROP_BY_ID[movie.id] ||
    '/src/assets/images/hero_wakaliwood_cinema_1794947709114.jpg';
  const saved = inWatchlist(movie.id);

  const formatRuntime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <section
      aria-label="Featured film"
      className="relative w-full overflow-hidden border-b border-white/8 bg-[#0B0D12]"
    >
      <div className="relative mx-auto min-h-[440px] lg:h-[520px] max-w-[1360px]">
        {/* Full-bleed background frame inside max container */}
        <img
          src={
            movie.isTrending
              ? '/src/assets/images/poster_scifi_vfx_1794947709573.jpg'
              : backdropSrc
          }
          alt={movie.title}
          referrerPolicy="no-referrer"
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ${
            movie.isTrending ? 'opacity-35 blur-sm scale-105' : 'opacity-75'
          }`}
        />

        {movie.isTrending && movie.posterUrl && (
          <div className="pointer-events-none absolute right-10 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
            <img
              src={movie.posterUrl}
              alt={`${movie.title} poster`}
              referrerPolicy="no-referrer"
              className="h-[380px] w-[254px] rounded-xl border border-white/15 object-cover shadow-2xl"
            />
          </div>
        )}

        {/* Measured contrast scrims */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0B0D12] via-[#0B0D12]/85 to-[#0B0D12]/30"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-transparent to-[#0B0D12]/50"
        />

        {/* Foreground content */}
        <div className="relative z-10 flex h-full flex-col justify-end px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="max-w-2xl space-y-4">
            {/* Unboxed metadata row */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300 tabular-nums">
              <span className="text-emerald-400 font-semibold">
                {movie.vjName ? `${movie.vjName} Edition` : 'Featured Stream'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{movie.year}</span>
              <span aria-hidden="true">·</span>
              <span>{formatRuntime(movie.durationMinutes)}</span>
              <span aria-hidden="true">·</span>
              <span>{movie.quality}</span>
              <span aria-hidden="true">·</span>
              <span>{movie.language}</span>
              <span aria-hidden="true">·</span>
              <span>Ad-Free</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl text-balance leading-[1.08]">
              {movie.title}
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base line-clamp-3">
              {movie.synopsis}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onPlay(movie)}
                className="inline-flex items-center gap-2.5 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors duration-150 hover:bg-emerald-400 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                <span>Watch Now</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleWatchlist(movie)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#13161F]/80 px-5 py-3 text-sm font-medium text-slate-100 transition-colors duration-150 hover:bg-[#1C212E] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {saved ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <span>In My List</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" aria-hidden="true" />
                    <span>Add to List</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Clean editorial spotlight switcher */}
          {featuredMovies.length > 1 && (
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
              {featuredMovies.map((item, idx) => {
                const active = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectIndex(idx)}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      active
                        ? 'bg-white/12 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-mono tabular-nums text-emerald-400">
                      0{idx + 1}
                    </span>
                    <span className="max-w-[160px] truncate">{item.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
