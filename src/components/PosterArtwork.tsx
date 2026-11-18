import React, { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import type { Movie } from '../types/movie.ts';

interface PosterArtworkProps {
  movie: Movie;
  className?: string;
}

export const PosterArtwork: React.FC<PosterArtworkProps> = ({
  movie,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  const imageSrc =
    movie.posterUrl || `/api/poster/${encodeURIComponent(movie.archiveId)}`;

  useEffect(() => {
    setImgError(false);
  }, [imageSrc]);

  if (!imgError && imageSrc) {
    return (
      <div className={`relative h-full w-full overflow-hidden bg-[#13161F] ${className}`}>
        <img
          src={imageSrc}
          alt={`${movie.title} (${movie.year}) poster`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
      </div>
    );
  }

  // Editorial cinema poster fallback (Zero-Broken-Image Policy)
  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#13161F] p-4 ${className}`}
      style={{
        backgroundImage: `radial-gradient(circle at 80% 15%, ${movie.accentHex}26 0%, transparent 58%), linear-gradient(165deg, #171B26 0%, #0D1017 100%)`,
      }}
    >
      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
        <span>{movie.year}</span>
        <span>{movie.quality}</span>
      </div>

      <div className="my-auto flex flex-col gap-2">
        <Film
          className="h-5 w-5 text-slate-500/80"
          style={{ color: movie.accentHex }}
          aria-hidden="true"
        />
        <p className="font-display text-base font-bold leading-snug tracking-tight text-slate-100 line-clamp-3">
          {movie.title}
        </p>
        <p className="text-xs text-slate-400 line-clamp-1">
          {movie.vjName ? `${movie.vjName} · Luganda` : movie.director || movie.genre}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px] text-slate-400">
        <span className="truncate">{movie.country}</span>
        <span className="font-mono tabular-nums shrink-0">
          {movie.durationMinutes > 0 ? `${movie.durationMinutes}m` : movie.sourceLabel || movie.quality}
        </span>
      </div>
    </div>
  );
};
