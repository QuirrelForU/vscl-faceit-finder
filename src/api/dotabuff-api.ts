/**
 * Dotabuff API Client
 */

import { logger } from '../utils/logger';

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
 * Fetches Dotabuff profile data for a Steam URL
 */
export async function fetchDotabuffProfile(steamUrl: string): Promise<any> {
  const ranks = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']
  const steamIdBaseline = BigInt("76561197960265728");
  try {
    const steamId64 = extractSteamId(steamUrl);
    if (!steamId64) {
      return { success: false, error: 'Could not extract Steam ID' };
    }
    const steamId = (BigInt(steamId64) - steamIdBaseline).toString();

    logger.log('Searching player with Steam ID:', steamId);

    const detailsResponse = await fetchWithRetry(
      `https://api.opendota.com/api/players/${steamId}`
    );
    const detailsData = await detailsResponse.json();

    logger.log('Response from opendota API:', `https://api.opendota.com/api/players/${steamId}`, detailsData)
    
    if (detailsData?.error) {
      return { success: false, error: 'No Dota2 data found for id' };
    }

    var rank_tier = detailsData.rank_tier ? detailsData.rank_tier.toString() : 'Uncalibrated';
    var leaderboard_rank = rank_tier[1] === '0' ? detailsData.leaderboard_rank?.toString() : rank_tier[1];
    leaderboard_rank = leaderboard_rank === undefined ? '' : leaderboard_rank
    rank_tier = !isNaN(rank_tier) ? `${ranks[+rank_tier[0] - 1]} ${leaderboard_rank}` : rank_tier;

    const elo = `${rank_tier}`
    logger.log('Found rank:', elo)

    return {
      success: true,
      faceitNickname: steamId,
      elo,
      profileUrl: `https://www.dotabuff.com/players/${steamId}`
    };
  } catch (error) {
    logger.error('Error in fetchDotabuffProfile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
