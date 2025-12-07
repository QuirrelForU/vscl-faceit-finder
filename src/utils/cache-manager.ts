/**
 * Cache Manager for VSCL Faceit Finder
 */

import { PlayerData, CacheResponse, SaveCacheResponse } from './types';
import { logger } from './logger';

interface PlayerCache {
  byVsclName: Record<string, PlayerData>;
}

const playerCache: PlayerCache = {
  byVsclName: {}
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function loadCache(): Promise<void> {
  try {
    const response = await new Promise<CacheResponse>((resolve) => {
      chrome.runtime.sendMessage({ action: 'getCache' }, resolve);
    });
    
    if (response && response.cache) {
      const now = Date.now();
      
      const validCache = Object.entries(response.cache).reduce((acc, [key, value]) => {
        if (value.timestamp && (now - value.timestamp) < CACHE_TTL_MS) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, PlayerData>);
      
      Object.assign(playerCache.byVsclName, validCache);
      logger.log('VSCL Faceit Finder: Loaded cache from storage:', Object.keys(playerCache.byVsclName));
      
      if (Object.keys(validCache).length !== Object.keys(response.cache).length) {
        await saveCache();
      }
    }
  } catch (error) {
    logger.error('VSCL Faceit Finder: Error loading cache from storage:', error);
  }
}

export async function saveCache(): Promise<void> {
  try {
    await new Promise<SaveCacheResponse>((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'saveCache', cache: playerCache.byVsclName },
        resolve
      );
    });
    logger.log('VSCL Faceit Finder: Saved cache to storage');
  } catch (error) {
    logger.error('VSCL Faceit Finder: Error saving cache to storage:', error);
  }
}

export function getCachedPlayer(name: string): PlayerData | undefined {
  return playerCache.byVsclName[name];
}

export function setCachedPlayer(name: string, data: PlayerData): void {
  playerCache.byVsclName[name] = data;
}

export function getAllCachedPlayers(): Record<string, PlayerData> {
  return playerCache.byVsclName;
}
