/**
 * Steam Profile Fetcher
 */

import { logger } from './logger';

export async function getSteamProfileUrl(vsclProfileUrl: string): Promise<string | null> {
  try {
    const response = await fetch(vsclProfileUrl);
    const html = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const accountsList = doc.querySelectorAll('li');
    
    for (const item of accountsList) {
      const text = item.textContent?.trim() || '';
      if (text.startsWith('Counter Strike 2')) {
        logger.log('Found CS2 account text:', text);
        
        const steamIdMatch = text.match(/\b7656119\d{10}\b/);
        if (steamIdMatch && steamIdMatch[0]) {
          return `https://steamcommunity.com/profiles/${steamIdMatch[0]}`;
        }
        
        const anyNumberMatch = text.match(/\b\d{5,}\b/g);
        if (anyNumberMatch && anyNumberMatch.length > 0) {
          const sortedIds = anyNumberMatch.sort((a, b) => b.length - a.length);
          return `https://steamcommunity.com/profiles/${sortedIds[0]}`;
        }
        
        const customUrlMatch = text.match(/steamcommunity\.com\/id\/([^\/\s]+)/);
        if (customUrlMatch && customUrlMatch[1]) {
          return `https://steamcommunity.com/id/${customUrlMatch[1]}`;
        }
      }
    }
    
    const steamLinks = Array.from(doc.querySelectorAll('a')).filter(
      a => a.href.includes('steamcommunity.com')
    );
    
    if (steamLinks.length > 0) {
      return steamLinks[0].href;
    }
    
    const pageText = doc.body.textContent || '';
    const steamIdMatches = pageText.match(/\b7656119\d{10}\b/g);
    if (steamIdMatches && steamIdMatches.length > 0) {
      return `https://steamcommunity.com/profiles/${steamIdMatches[0]}`;
    }
    
    return null;
  } catch (error) {
    // Silently handle fetch errors (CORS, network issues, etc.)
    // This is expected and we just return null to show "No Steam profile found"
    return null;
  }
}
