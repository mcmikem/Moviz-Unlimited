import React from 'react';
import { Bookmark, Check, Play } from 'lucide-react';
import type { Movie } from '../types/movie.ts';
import { PosterArtwork } from './PosterArtwork.tsx';

interface MovieCardProps {
  movie: Movie;
  inWatchlist: boolean;
  progressRatio?: number;
  onPlay: (movie: Movie) => void;
  onToggleWatchlist: (movie: Movie) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  inWatchlist,
  progressRatio,
  onPlay,
  onToggleWatchlist,
}) => {
  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <article className="group flex flex-col gap-2.5">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/8 bg-[#13161F]">
        <button
          type="button"
          onClick={() => onPlay(movie)}
          aria-label={`Stream ${movie.title}`}
          className="block h-full w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <PosterArtwork movie={movie} />

          {/* Hover play affordance */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg">
              <Play className="h-5 w-5 fill-current translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </button>

        {/* Watchlist action button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchlist(movie);
          }}
          aria-label={inWatchlist ? `Remove ${movie.title} from My List` : `Add ${movie.title} to My List`}
          className={`absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            inWatchlist
              ? 'border-emerald-400/50 bg-emerald-500 text-slate-950'
              : 'border-white/15 bg-[#0B0D12]/80 text-slate-200 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#1A1F2B]'
          }`}
        >
          {inWatchlist ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Subtle playback resume progress bar */}
        {typeof progressRatio === 'number' && progressRatio > 0.02 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/15">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${Math.min(100, Math.round(progressRatio * 100))}%` }}
            />
          </div>
        )}
      </div>

      {/* Zero-pill clean unboxed metadata */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <button
          type="button"
          onClick={() => onPlay(movie)}
          className="text-left font-display text-sm font-semibold text-slate-100 truncate hover:text-emerald-400 transition-colors cursor-pointer"
        >
          {movie.title}
        </button>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 tabular-nums truncate">
          <span>{movie.year}</span>
          <span aria-hidden="true">·</span>
          <span>
            {movie.durationMinutes > 0
              ? formatMinutes(movie.durationMinutes)
              : movie.sourceLabel || 'Channel'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            {movie.vjName ? movie.vjName : movie.quality}
          </span>
        </div>
      </div>
    </article>
  );
};
