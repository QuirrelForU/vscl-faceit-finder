/**
 * Faceit API Client
 */

import { logger } from '../utils/logger';

/**
 * Fetches data from a URL with retry logic
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      if (attempts > 0) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempts));
      }
      
      const response = await fetch(url);
      if (response.ok || response.status === 302 || response.status === 301) {
        return response;
      }
      
      // For 429, return the response silently - don't throw error
      if (response.status === 429) {
        return response;
      }
      
      if (attempts === maxRetries - 1) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
    } catch (error) {
      if (attempts === maxRetries - 1) {
        throw error;
      }
    }
    
    attempts++;
    logger.log(`Retrying fetch for ${url}, attempt ${attempts} of ${maxRetries}`);
  }
  
  throw new Error('Max retries reached');
}

/**
 * Extracts Steam ID from a Steam profile URL
 */
function extractSteamId(steamUrl: string): string | null {
  // Try to match Steam64 ID from /profiles/ URL
  const profileMatch = steamUrl.match(/\/profiles\/(\d+)/);
  if (profileMatch && profileMatch[1]) {
    return profileMatch[1];
  }
  
  // Try to match custom URL from /id/ URL
  const customUrlMatch = steamUrl.match(/\/id\/([^\/]+)/);
  if (customUrlMatch && customUrlMatch[1]) {
    return customUrlMatch[1];
  }
  
  // Try to match any long number (likely a Steam64 ID)
  const numberMatch = steamUrl.match(/\b(\d{5,})\b/);
  if (numberMatch && numberMatch[1]) {
    return numberMatch[1];
  }
  
  return null;
}

/**
 * Fetches Faceit profile data for a Steam URL
 */
export async function fetchFaceitProfile(steamUrl: string): Promise<any> {
  try {
    const steamId = extractSteamId(steamUrl);
    if (!steamId) {
      return { success: false, error: 'Could not extract Steam ID' };
    }
    
    logger.log('Searching player with Steam ID:', steamId);
    
    // Search for player by Steam ID
    // Note: The searcher API accepts Steam ID in the game_id parameter
    const searchResponse = await fetchWithRetry(
      `https://www.faceit.com/api/searcher/v1/players?limit=20&offset=0&game_id=${steamId}`
    );
    
    // Handle rate limiting (429) silently - don't parse JSON, just return error
    if (searchResponse.status === 429) {
      return { success: false, error: 'Rate limited. Please refresh the page and try again.' };
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.payload || searchData.payload.length === 0) {
      return { success: false, error: 'No Faceit profile found' };
    }

    const cs2Account = searchData.payload.find((account: any) => 
      account.games && account.games.some((game: any) => game.name === 'cs2')
    );

    if (!cs2Account) {
      return { success: false, error: 'No CS2 Faceit profile found' };
    }

    const faceitNickname = cs2Account.nickname;
    logger.log('Found Faceit nickname with CS2:', faceitNickname);
    
    // Get player details including ELO
    const detailsResponse = await fetchWithRetry(
      `https://www.faceit.com/api/users/v1/nicknames/${faceitNickname}`
    );
    
    // Handle rate limiting (429) silently - don't parse JSON, just return error
    if (detailsResponse.status === 429) {
      return { success: false, error: 'Rate limited. Please refresh the page and try again.' };
    }
    
    const detailsData = await detailsResponse.json();
    
    logger.log('Response from faceit API:', `https://www.faceit.com/api/users/v1/nicknames/${faceitNickname}`, detailsData);

    if (!detailsData.payload || !detailsData.payload.games || !detailsData.payload.games.cs2) {
      return { success: false, error: 'No CS2 data found' };
    }
    
    const elo = detailsData.payload.games.cs2.faceit_elo.toString();
    logger.log('Found ELO:', elo);
    
    return {
      success: true,
      faceitNickname,
      elo,
      profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}`
    };
  } catch (error) {
    // Don't log 429 errors - they're expected rate limiting
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (!errorMessage.includes('429') && !errorMessage.includes('Rate Limited')) {
      logger.error('Error in fetchFaceitProfile:', error);
    }
    return {
      success: false,
      error: errorMessage
    };
  }
}
