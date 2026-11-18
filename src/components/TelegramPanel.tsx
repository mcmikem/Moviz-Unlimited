import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import type { Movie, TelegramChannelFeed } from '../types/movie.ts';
import { MovieCard } from './MovieCard.tsx';

interface TelegramPanelProps {
  watchlist: string[];
  onPlay: (movie: Movie) => void;
  onToggleWatchlist: (movie: Movie) => void;
  getProgressRatio: (movieId: string) => number | undefined;
}

const SAVED_TG_CHANNELS_KEY = 'hdtoday_tg_channels_v1';
const DEFAULT_CHANNELS = ['trailers', 'classicmovies'];

export const TelegramPanel: React.FC<TelegramPanelProps> = ({
  watchlist,
  onPlay,
  onToggleWatchlist,
  getProgressRatio,
}) => {
  const [channels, setChannels] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_TG_CHANNELS_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : null;
      return parsed && parsed.length > 0 ? parsed : DEFAULT_CHANNELS;
    } catch {
      return DEFAULT_CHANNELS;
    }
  });

  const [activeChannel, setActiveChannel] = useState<string>(channels[0] || 'trailers');
  const [inputHandle, setInputHandle] = useState<string>('');
  const [feed, setFeed] = useState<TelegramChannelFeed | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_TG_CHANNELS_KEY, JSON.stringify(channels));
    } catch {
      // Ignore storage errors
    }
  }, [channels]);

  const loadChannel = async (handle: string) => {
    const clean = handle
      .replace(/^https?:\/\/(t\.me|telegram\.me)\/(s\/)?/i, '')
      .replace(/^@/, '')
      .split('/')[0]
      .split('?')[0]
      .trim();

    if (!clean) return;
    setActiveChannel(clean);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/telegram?channel=${encodeURIComponent(clean)}`);
      const data = (await res.json()) as TelegramChannelFeed & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Could not load Telegram channel');
      }
      setFeed(data);
      if (!channels.includes(clean)) {
        setChannels((prev) => [clean, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch Telegram channel');
      setFeed(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannel(activeChannel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputHandle.trim()) return;
    loadChannel(inputHandle.trim());
    setInputHandle('');
  };

  const handleRemoveChannel = (ch: string) => {
    const next = channels.filter((c) => c !== ch);
    const updated = next.length > 0 ? next : DEFAULT_CHANNELS;
    setChannels(updated);
    if (activeChannel === ch) {
      loadChannel(updated[0]);
    }
  };

  return (
    <section aria-label="Telegram Public Channels" className="space-y-6">
      <div className="rounded-xl border border-white/8 bg-[#13161F] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-white">
              Telegram Public Movie Channels
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Load any public Telegram broadcast channel (<span className="font-mono text-slate-300">t.me/channel</span> or <span className="font-mono text-slate-300">@handle</span>) to extract thumbnails, direct MP4 clips, and embedded posts.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full lg:w-auto lg:min-w-[380px]">
            <div className="relative flex-1">
              <Send
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={inputHandle}
                onChange={(e) => setInputHandle(e.target.value)}
                placeholder="Paste t.me/channel or @username..."
                aria-label="Telegram channel handle or URL"
                className="h-10 w-full rounded-lg border border-white/10 bg-[#0B0D12] pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={!inputHandle.trim() || loading}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-500 px-4 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Load Channel</span>
            </button>
          </form>
        </div>

        {/* Saved channel switcher */}
        <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
          <span className="text-xs text-slate-400 mr-1">Saved channels:</span>
          {channels.map((ch) => {
            const active = activeChannel === ch;
            return (
              <div
                key={ch}
                className={`inline-flex items-center rounded-lg border text-xs transition-colors ${
                  active
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/10 bg-[#0B0D12] text-slate-300 hover:border-white/20'
                }`}
              >
                <button
                  type="button"
                  onClick={() => loadChannel(ch)}
                  className="px-3 py-1.5 font-mono cursor-pointer whitespace-nowrap"
                >
                  @{ch}
                </button>
                {channels.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveChannel(ch)}
                    aria-label={`Remove @${ch}`}
                    className="pr-2.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-[3/4] animate-pulse rounded-xl bg-[#13161F]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-white/8 bg-[#13161F] p-8 text-center space-y-3">
          <p className="text-sm font-medium text-slate-200">{error}</p>
          <button
            type="button"
            onClick={() => loadChannel(activeChannel)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#1B202C] px-4 py-2 text-xs font-medium text-slate-200 hover:text-white cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      ) : feed ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/8 pb-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-white">
                {feed.title}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-1">{feed.description}</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {feed.movies.length} posts
            </span>
          </div>

          {feed.movies.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No media posts found in @{feed.channel}.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {feed.movies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  inWatchlist={watchlist.includes(movie.id)}
                  progressRatio={getProgressRatio(movie.id)}
                  onPlay={onPlay}
                  onToggleWatchlist={onToggleWatchlist}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};
