import React from 'react';
import { Search } from 'lucide-react';

export type NavSection = 'home' | 'trending' | 'ugandan-vj' | 'telegram' | 'my-list';

interface HeaderProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  onSearchClick: () => void;
}

const NAV_ITEMS: Array<{ id: NavSection; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'trending', label: 'Trending' },
  { id: 'ugandan-vj', label: 'Ugandan VJ' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'my-list', label: 'My List' },
];

export const Header: React.FC<HeaderProps> = ({
  activeNav,
  onSelectNav,
  onSearchClick,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0B0D12]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectNav('home')}
          className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm"
        >
          HD<span className="text-emerald-400">Today</span>
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNav(item.id)}
                className={`relative py-1 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-emerald-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onSearchClick}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors duration-150 hover:bg-emerald-400 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Search Vault</span>
          </button>
        </div>
      </div>

      {/* Compact mobile nav bar */}
      <nav
        aria-label="Mobile navigation"
        className="flex md:hidden items-center gap-5 overflow-x-auto no-scrollbar border-t border-white/6 px-4 py-2 text-xs font-medium"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectNav(item.id)}
              className={`whitespace-nowrap shrink-0 py-0.5 transition-colors cursor-pointer ${
                isActive ? 'text-emerald-400 font-semibold' : 'text-slate-400'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
