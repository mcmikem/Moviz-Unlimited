import React from 'react';
import { Globe, Search, X } from 'lucide-react';
import type { MovieCategory } from '../types/movie.ts';

export type CategoryFilter = 'all' | MovieCategory | 'my-list';

interface CatalogToolbarProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  activeCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
  activeVj: string;
  onSelectVj: (vj: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onLiveSearch: (q: string) => void;
  isDiscovering: boolean;
  liveModeActive: boolean;
  onClearLiveMode: () => void;
}

const CATEGORIES: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'All Full Movies' },
  { id: 'trending', label: 'Trending' },
  { id: 'ugandan-vj', label: 'Ugandan VJ' },
  { id: 'action', label: 'Action' },
  { id: 'martial-arts', label: 'Martial Arts' },
  { id: 'scifi', label: 'Sci-Fi' },
  { id: 'horror', label: 'Horror' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'classic', label: 'Classic & Noir' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'my-list', label: 'My List' },
];

const VJ_FILTERS = [
  'All VJs',
  'VJ Junior',
  'VJ Jingo',
  'VJ Emmie',
  'VJ Mark',
  'VJ Ice P',
  'VJ Kevo',
  'VJ Ulio',
];

const QUICK_VAULT_QUERIES = [
  'VJ Junior 2026',
  'VJ Jingo',
  'Action Thriller',
  'Kung Fu Martial Arts',
];

export const CatalogToolbar: React.FC<CatalogToolbarProps> = ({
  searchInputRef,
  activeCategory,
  onSelectCategory,
  activeVj,
  onSelectVj,
  searchQuery,
  onSearchChange,
  onLiveSearch,
  isDiscovering,
  liveModeActive,
  onClearLiveMode,
}) => {
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onLiveSearch(searchQuery.trim());
    }
  };

  return (
    <section
      aria-label="Catalog filters and search"
      className="border-b border-white/8 bg-[#0E1118]"
    >
      <div className="mx-auto flex max-w-[1360px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        {/* Top row: Search & Live Multi-Source Full Movie Discovery */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form
            onSubmit={handleFormSubmit}
            className="flex flex-1 max-w-2xl items-center gap-2"
          >
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search full movies, actors, or Ugandan VJs (VJ Junior, VJ Jingo, VJ Emmy, VJ Ice P)..."
                aria-label="Search full movies"
                className="h-11 w-full rounded-lg border border-white/10 bg-[#141822] pl-10 pr-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    onClearLiveMode();
                  }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!searchQuery.trim() || isDiscovering}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-4 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isDiscovering ? 'Searching...' : 'Find Full Movies'}</span>
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="shrink-0">Live search:</span>
            {QUICK_VAULT_QUERIES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  onSearchChange(term);
                  onLiveSearch(term);
                }}
                className="rounded-md border border-white/10 bg-[#141822] px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom row: Category Tabs & VJ Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Movie categories"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0"
          >
            {CATEGORIES.map((cat) => {
              const active = !liveModeActive && activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => {
                    onClearLiveMode();
                    onSelectCategory(cat.id);
                  }}
                  className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    active
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'bg-[#141822] text-slate-300 hover:bg-[#1B202E] hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {(activeCategory === 'ugandan-vj' || activeCategory === 'all') && !liveModeActive && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {VJ_FILTERS.map((vj) => {
                const val = vj === 'All VJs' ? 'all' : vj;
                const active = activeVj === val;
                return (
                  <button
                    key={vj}
                    type="button"
                    onClick={() => onSelectVj(val)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white/14 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {vj}
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
