export type MovieCategory =
  | 'ugandan-vj'
  | 'trending'
  | 'action'
  | 'scifi'
  | 'horror'
  | 'comedy'
  | 'martial-arts'
  | 'classic'
  | 'telegram';

export interface StreamSource {
  label: string;
  url: string;
  quality: string;
  type?: 'mp4' | 'youtube' | 'dailymotion' | 'telegram';
  youtubeId?: string;
  dailymotionId?: string;
  telegramPost?: string;
}

export interface Movie {
  id: string;
  archiveId: string;
  title: string;
  year: number;
  durationMinutes: number;
  genre: string;
  category: MovieCategory;
  vjName?: string;
  language: string;
  rating: number;
  quality: string;
  synopsis: string;
  director?: string;
  country: string;
  heroBackdrop?: string;
  posterUrl?: string;
  accentHex: string;
  streams: StreamSource[];
  youtubeId?: string;
  dailymotionId?: string;
  telegramPost?: string;
  sourceLabel?: string;
  featured?: boolean;
  isLiveDiscovered?: boolean;
  isTrending?: boolean;
}

export interface WatchProgress {
  movieId: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
  movieSnapshot?: Movie;
}

export interface TelegramChannelFeed {
  channel: string;
  title: string;
  description: string;
  movies: Movie[];
}
