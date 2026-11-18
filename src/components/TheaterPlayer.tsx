import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  Check,
  ExternalLink,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  RefreshCw,
  Server,
} from 'lucide-react';
import type { Movie, StreamSource } from '../types/movie.ts';
import { PosterArtwork } from './PosterArtwork.tsx';

interface TheaterPlayerProps {
  movie: Movie;
  savedSeconds: number;
  inWatchlist: boolean;
  upNext: Movie[];
  onClose: () => void;
  onSelectMovie: (movie: Movie) => void;
  onToggleWatchlist: (movie: Movie) => void;
  onProgressUpdate: (movie: Movie, currentTime: number, duration: number) => void;
}

type ServerMode = 'direct' | 'relay';

export const TheaterPlayer: React.FC<TheaterPlayerProps> = ({
  movie,
  savedSeconds,
  inWatchlist,
  upNext,
  onClose,
  onSelectMovie,
  onToggleWatchlist,
  onProgressUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [resolvedStreams, setResolvedStreams] = useState<StreamSource[]>(movie.streams);
  const [resolvedDuration, setResolvedDuration] = useState<number>(movie.durationMinutes);
  const [resolving, setResolving] = useState<boolean>(
    movie.streams.length === 0 && !movie.youtubeId && !movie.dailymotionId && !movie.telegramPost
  );
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [trackIndex, setTrackIndex] = useState<number>(0);
  const [serverMode, setServerMode] = useState<ServerMode>('direct');
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [theaterWide, setTheaterWide] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [hasRestoredSeek, setHasRestoredSeek] = useState<boolean>(false);

  useEffect(() => {
    setResolvedStreams(movie.streams);
    setResolvedDuration(movie.durationMinutes);
    setTrackIndex(0);
    setServerMode('direct');
    setStreamError(null);
    setResolveError(null);
    setHasRestoredSeek(false);

    if (
      movie.streams.length === 0 &&
      !movie.youtubeId &&
      !movie.dailymotionId &&
      !movie.telegramPost
    ) {
      let active = true;
      setResolving(true);
      const endpoint = movie.archiveId.startsWith('unseen:')
        ? `/api/resolve-title?title=${encodeURIComponent(movie.title)}&vj=${encodeURIComponent(
            movie.vjName || ''
          )}`
        : `/api/resolve/${encodeURIComponent(movie.archiveId)}`;

      fetch(endpoint)
        .then(async (r) => {
          if (!r.ok) {
            const body = (await r.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error || 'Could not resolve stream');
          }
          return r.json() as Promise<{ streams: StreamSource[]; durationMinutes?: number }>;
        })
        .then((data) => {
          if (!active) return;
          setResolvedStreams(data.streams || []);
          if (data.durationMinutes && data.durationMinutes > 0) {
            setResolvedDuration(data.durationMinutes);
          }
          setResolving(false);
        })
        .catch((err: Error) => {
          if (!active) return;
          setResolveError(err.message || 'Unable to load video stream');
          setResolving(false);
        });
      return () => {
        active = false;
      };
    } else {
      setResolving(false);
    }
  }, [movie]);

  const activeTrack = resolvedStreams[trackIndex] || resolvedStreams[0];
  const activeType =
    activeTrack?.type ||
    (movie.youtubeId
      ? 'youtube'
      : movie.dailymotionId
      ? 'dailymotion'
      : movie.telegramPost
      ? 'telegram'
      : 'mp4');

  const videoSrc = useMemo(() => {
    if (!activeTrack || activeType !== 'mp4') return '';
    if (serverMode === 'relay') {
      return `/api/stream?url=${encodeURIComponent(activeTrack.url)}`;
    }
    return activeTrack.url;
  }, [activeTrack, activeType, serverMode]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, videoSrc]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const vid = videoRef.current;
      if (!vid || activeType !== 'mp4') return;

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (vid.paused) vid.play().catch(() => {});
        else vid.pause();
      } else if (e.key === 'ArrowRight') {
        vid.currentTime = Math.min(vid.duration || vid.currentTime + 10, vid.currentTime + 10);
      } else if (e.key === 'ArrowLeft') {
        vid.currentTime = Math.max(0, vid.currentTime - 10);
      } else if (e.key.toLowerCase() === 'm') {
        vid.muted = !vid.muted;
      } else if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          vid.requestFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, activeType]);

  const handleLoadedMetadata = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.playbackRate = playbackRate;
    if (!hasRestoredSeek && savedSeconds > 10 && vid.duration && savedSeconds < vid.duration * 0.95) {
      vid.currentTime = savedSeconds;
      setHasRestoredSeek(true);
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    if (Math.floor(vid.currentTime) % 4 === 0) {
      onProgressUpdate(movie, vid.currentTime, vid.duration);
    }
  };

  const handleVideoError = () => {
    if (serverMode === 'direct' && activeTrack && activeType === 'mp4') {
      setServerMode('relay');
      setStreamError(null);
      return;
    }
    setStreamError(
      'This stream server encountered a temporary network issue. Try switching tracks or retrying.'
    );
  };

  const togglePiP = async () => {
    const vid = videoRef.current;
    if (!vid || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await vid.requestPictureInPicture();
      }
    } catch {
      // Ignore PiP rejection
    }
  };

  const formatRuntime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const ytId = activeTrack?.youtubeId || movie.youtubeId;
  const dmId = activeTrack?.dailymotionId || movie.dailymotionId;
  const tgPost = activeTrack?.telegramPost || movie.telegramPost;

  return (
    <div className="min-h-screen bg-[#0B0D12] pb-16">
      <div className="border-b border-white/8 bg-[#0E1118]">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#141822] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-[#1C212E] hover:text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Catalog</span>
          </button>

          <div className="min-w-0 flex-1 text-center">
            <h1 className="font-display text-sm font-semibold text-white truncate sm:text-base">
              {movie.title}
            </h1>
            <p className="text-xs text-slate-400 truncate">
              {movie.vjName ? `${movie.vjName} · ${movie.language}` : `${movie.year} · ${movie.genre}`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onToggleWatchlist(movie)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              inWatchlist
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-white/10 bg-[#141822] text-slate-200 hover:bg-[#1C212E]'
            }`}
          >
            {inWatchlist ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] px-4 pt-6 sm:px-6 lg:px-8">
        <div
          className={`grid gap-8 ${
            theaterWide ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[1fr_320px]'
          }`}
        >
          <div className="min-w-0 space-y-5">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
              {resolving ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#10131B] p-6 text-center">
                  <RefreshCw className="h-7 w-7 animate-spin text-emerald-400" aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-200">
                    Resolving full movie stream...
                  </p>
                  <p className="text-xs text-slate-400">
                    Fetching direct MP4 stream from the vault
                  </p>
                </div>
              ) : activeType === 'youtube' && ytId ? (
                <iframe
                  key={`yt-${ytId}`}
                  src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`}
                  title={movie.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : activeType === 'dailymotion' && dmId ? (
                <iframe
                  key={`dm-${dmId}`}
                  src={`https://www.dailymotion.com/embed/video/${dmId}?autoplay=1`}
                  title={movie.title}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : activeType === 'telegram' && tgPost ? (
                <div className="flex h-full w-full flex-col items-center justify-center bg-[#10131B] p-4">
                  <iframe
                    key={`tg-${tgPost}`}
                    src={`https://t.me/${tgPost}?embed=1&dark=1`}
                    title={movie.title}
                    className="h-full w-full max-w-xl rounded-lg border border-white/10 bg-[#0B0D12]"
                  />
                </div>
              ) : resolveError || streamError || !videoSrc ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#10131B] p-6 text-center">
                  <AlertCircle className="h-8 w-8 text-amber-400" aria-hidden="true" />
                  <div className="max-w-md space-y-1">
                    <p className="text-sm font-semibold text-white">
                      Stream could not start
                    </p>
                    <p className="text-xs text-slate-400">
                      {resolveError || streamError || 'No compatible MP4 print found for this title.'}
                    </p>
                  </div>
                  {activeTrack && activeType === 'mp4' && (
                    <button
                      type="button"
                      onClick={() => {
                        setStreamError(null);
                        setServerMode((m) => (m === 'direct' ? 'relay' : 'direct'));
                      }}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                    >
                      Switch to {serverMode === 'direct' ? 'Server 2 (Relay)' : 'Server 1 (Direct)'}
                    </button>
                  )}
                </div>
              ) : (
                <video
                  ref={videoRef}
                  key={videoSrc}
                  src={videoSrc}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onError={handleVideoError}
                  className="h-full w-full bg-black focus:outline-none"
                />
              )}
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-white/8 bg-[#13161F] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 mr-1">
                  <Server className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Sources:</span>
                </span>

                {resolvedStreams.map((track, idx) => (
                  <button
                    key={`${track.url}-${idx}`}
                    type="button"
                    onClick={() => {
                      setTrackIndex(idx);
                      setStreamError(null);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      trackIndex === idx
                        ? 'bg-emerald-500 text-slate-950 font-semibold'
                        : 'bg-[#1A1F2C] text-slate-300 hover:text-white'
                    }`}
                  >
                    {track.label}
                  </button>
                ))}

                {activeType === 'mp4' && (
                  <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setStreamError(null);
                        setServerMode('direct');
                      }}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        serverMode === 'direct'
                          ? 'bg-white/15 text-white'
                          : 'bg-[#1A1F2C] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Direct CDN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStreamError(null);
                        setServerMode('relay');
                      }}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        serverMode === 'relay'
                          ? 'bg-white/15 text-white'
                          : 'bg-[#1A1F2C] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Express Relay
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeType === 'mp4' && (
                  <>
                    <label className="sr-only" htmlFor="playback-speed">
                      Playback Speed
                    </label>
                    <select
                      id="playback-speed"
                      value={playbackRate}
                      onChange={(e) => setPlaybackRate(Number(e.target.value))}
                      className="rounded-md border border-white/10 bg-[#1A1F2C] px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                    >
                      <option value={0.75}>0.75x</option>
                      <option value={1}>1.0x</option>
                      <option value={1.25}>1.25x</option>
                      <option value={1.5}>1.5x</option>
                    </select>

                    <button
                      type="button"
                      onClick={togglePiP}
                      aria-label="Picture in Picture"
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-[#1A1F2C] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-[#23293A] cursor-pointer"
                    >
                      <PictureInPicture2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">PiP</span>
                    </button>
                  </>
                )}

                {tgPost && (
                  <a
                    href={`https://t.me/${tgPost}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-[#1A1F2C] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-[#23293A]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Open in Telegram</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setTheaterWide((w) => !w)}
                  aria-label={theaterWide ? 'Exit wide mode' : 'Wide theater mode'}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-[#1A1F2C] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-[#23293A] cursor-pointer"
                >
                  {theaterWide ? (
                    <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">{theaterWide ? 'Standard' : 'Wide'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
                <span className="text-emerald-400 font-semibold">
                  {movie.sourceLabel || 'Full Movie Stream'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{movie.year}</span>
                {resolvedDuration > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{formatRuntime(resolvedDuration)}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{movie.genre}</span>
                <span aria-hidden="true">·</span>
                <span>{activeTrack?.quality || movie.quality}</span>
              </div>

              <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                {movie.title}
              </h2>

              <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
                {movie.synopsis}
              </p>

              <dl className="grid grid-cols-2 gap-4 border-t border-white/8 pt-4 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Audio / Narrator</dt>
                  <dd className="mt-1 font-medium text-slate-200">
                    {movie.vjName ? `${movie.vjName} (${movie.language})` : movie.language}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Country</dt>
                  <dd className="mt-1 font-medium text-slate-200">{movie.country}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Director / Channel</dt>
                  <dd className="mt-1 font-medium text-slate-200">
                    {movie.director || 'Feature Release'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Shortcuts</dt>
                  <dd className="mt-1 font-mono text-slate-300">
                    Space · F · M · ←/→
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <aside aria-label="Up next recommendations" className="space-y-4">
            <h3 className="font-display text-sm font-semibold tracking-tight text-slate-200">
              Full Movies Up Next
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {upNext.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectMovie(item)}
                  className="group flex items-center gap-3.5 rounded-xl border border-white/8 bg-[#13161F] p-2.5 text-left transition-colors hover:border-white/15 hover:bg-[#191E2A] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-[#0B0D12]">
                    <PosterArtwork movie={item} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-display text-sm font-semibold text-slate-100 truncate group-hover:text-emerald-400 transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {item.vjName ? `${item.vjName} · ` : ''}
                      {item.year}
                      {item.durationMinutes > 0 ? ` · ${formatRuntime(item.durationMinutes)}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{item.genre}</p>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
