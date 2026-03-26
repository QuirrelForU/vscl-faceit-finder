/**
 * Steam Profile Fetcher
 */

import { logger } from './logger';

function steamUrlFromText(text: string): string | null {
  const trimmed = text.trim();

  // Prefer a Steam64 id if present.
  const steamIdMatch = trimmed.match(/\b7656119\d{10}\b/);
  if (steamIdMatch?.[0]) {
    return `https://steamcommunity.com/profiles/${steamIdMatch[0]}`;
  }

  // Custom URL form.
  const customUrlMatch = trimmed.match(/steamcommunity\.com\/id\/([^\/\s]+)/);
  if (customUrlMatch?.[1]) {
    return `https://steamcommunity.com/id/${customUrlMatch[1]}`;
  }

  // Last resort: any long number.
  const anyNumberMatch = trimmed.match(/\b\d{5,}\b/g);
  if (anyNumberMatch?.length) {
    const sortedIds = anyNumberMatch.sort((a, b) => b.length - a.length);
    return `https://steamcommunity.com/profiles/${sortedIds[0]}`;
  }

  return null;
}

export type SteamProfileUrls = {
  any?: string;
  cs2?: string;
  dota2?: string;
};

export async function getSteamProfileUrls(vsclProfileUrl: string): Promise<SteamProfileUrls | null> {
  try {
    const response = await fetch(vsclProfileUrl);
    const html = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const urls: SteamProfileUrls = {};

    // First pass: look for explicit "accounts" list lines.
    const accountsList = doc.querySelectorAll('li');
    for (const item of accountsList) {
      const text = item.textContent?.trim() || '';
      if (!text) continue;

      // Keep a generic fallback from the first thing that looks like Steam.
      if (!urls.any) {
        const any = steamUrlFromText(text);
        if (any) urls.any = any;
      }

      // VSCL renders game labels like "Counter Strike 2" and "Dota2".
      if (!urls.cs2 && /Counter\s*Strike\s*2/i.test(text)) {
        const cs2 = steamUrlFromText(text);
        if (cs2) {
          logger.log('Found CS2 account text:', text);
          urls.cs2 = cs2;
        }
      }

      if (!urls.dota2 && /Dota\s*2|Dota2/i.test(text)) {
        const dota2 = steamUrlFromText(text);
        if (dota2) {
          logger.log('Found Dota2 account text:', text);
          urls.dota2 = dota2;
        }
      }
    }
    
    const steamLinks = Array.from(doc.querySelectorAll('a')).filter(
      a => a.href.includes('steamcommunity.com')
    );
    
    if (steamLinks.length > 0 && !urls.any) {
      urls.any = steamLinks[0].href;
    }
    
    const pageText = doc.body.textContent || '';
    const steamIdMatches = pageText.match(/\b7656119\d{10}\b/g);
    if (steamIdMatches && steamIdMatches.length > 0 && !urls.any) {
      urls.any = `https://steamcommunity.com/profiles/${steamIdMatches[0]}`;
    }
    
    if (!urls.any && !urls.cs2 && !urls.dota2) return null;
    return urls;
  } catch (error) {
    // Silently handle fetch errors (CORS, network issues, etc.)
    // This is expected and we just return null to show "No Steam profile found"
    return null;
  }
}

export async function getSteamProfileUrl(vsclProfileUrl: string): Promise<string | null> {
  const urls = await getSteamProfileUrls(vsclProfileUrl);
  if (!urls) return null;
  return urls.cs2 || urls.any || urls.dota2 || null;
}
