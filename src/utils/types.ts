/**
 * Type definitions for VSCL Faceit Finder
 */

export interface PlayerData {
  name: string;
  profileUrl: string;
  element: HTMLElement;
  steamProfileUrl?: string;
  faceitData?: {
    elo: string;
    nickname: string;
    profileUrl: string;
  };
  timestamp?: number; // Unix timestamp when the data was cached
}

export interface FaceitResponse {
  success: boolean;
  error?: string;
  faceitNickname?: string;
  elo?: string;
  profileUrl?: string;
}

export interface CacheResponse {
  cache: Record<string, PlayerData>;
}

export interface SaveCacheResponse {
  success: boolean;
  error?: string;
}
