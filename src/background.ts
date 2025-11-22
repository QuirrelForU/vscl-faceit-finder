/**
 * VSCL Faceit Finder Background Script
 */

/**
 * Fetches data from a URL with retry logic
 * @param url - The URL to fetch
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise resolving to the fetch Response
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
    console.log(`Retrying fetch for ${url}, attempt ${attempts} of ${maxRetries}`);
  }
  
  throw new Error('Max retries reached');
}

/**
 * Extracts Steam ID from a Steam profile URL
 * @param steamUrl - The Steam profile URL
 * @returns The extracted Steam ID or null if not found
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
 * Fetches Dotabuff profile data for a Steam URL
 * @param steamUrl - The Steam profile URL
 * @returns Promise resolving to Faceit profile data
 */
async function fetchDotabuffProfile(steamUrl: string): Promise<any> {
  const ranks = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']
  const steamIdBaseline = BigInt("76561197960265728");
  try {
    const steamId64 = extractSteamId(steamUrl);
    if (!steamId64) {
      return { success: false, error: 'Could not extract Steam ID' };
    }
    const steamId = (BigInt(steamId64) - steamIdBaseline).toString();

    console.log('Searching player with Steam ID:', steamId);

    const detailsResponse = await fetchWithRetry(
      `https://api.opendota.com/api/players/${steamId}`
    );
    const detailsData = await detailsResponse.json();

    console.log('Response from opendota API:', `https://api.opendota.com/api/players/${steamId}`, detailsData)
    
    if (detailsData?.error) {
      return { success: false, error: 'No Dota2 data found for id' };
    }

    var rank_tier = detailsData.rank_tier ? detailsData.rank_tier.toString() : 'Uncalibrated';
    var leaderboard_rank = rank_tier[1] === '0' ? detailsData.leaderboard_rank?.toString() : rank_tier[1];
    leaderboard_rank = leaderboard_rank === undefined ? '' : leaderboard_rank
    rank_tier = !isNaN(rank_tier) ? `${ranks[+rank_tier[0] - 1]} ${leaderboard_rank}` : rank_tier;

    const elo = `${rank_tier}`
    console.log('Found rank:', elo)

    return {
      success: true,
      faceitNickname: steamId,
      elo,
      profileUrl: `https://www.dotabuff.com/players/${steamId}`
    };
  } catch (error) {
    console.error('Error in fetchDotabuffProfile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetches Faceit profile data for a Steam URL
 * @param steamUrl - The Steam profile URL
 * @returns Promise resolving to Faceit profile data
 */
async function fetchFaceitProfile(steamUrl: string): Promise<any> {
  try {
    const steamId = extractSteamId(steamUrl);
    if (!steamId) {
      return { success: false, error: 'Could not extract Steam ID' };
    }
    
    console.log('Searching player with Steam ID:', steamId);
    
    // Search for player by Steam ID
    const searchResponse = await fetchWithRetry(
      `https://www.faceit.com/api/searcher/v1/players?limit=20&offset=0&game_id=${steamId}`
    );
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
    console.log('Found Faceit nickname with CS2:', faceitNickname);
    
    // Get player details including ELO
    const detailsResponse = await fetchWithRetry(
      `https://www.faceit.com/api/users/v1/nicknames/${faceitNickname}`
    );
    const detailsData = await detailsResponse.json();
    
    console.log('Response from faceit API:', `https://www.faceit.com/api/users/v1/nicknames/${faceitNickname}`, detailsData);

    if (!detailsData.payload || !detailsData.payload.games || !detailsData.payload.games.cs2) {
      return { success: false, error: 'No CS2 data found' };
    }
    
    const elo = detailsData.payload.games.cs2.faceit_elo.toString();
    console.log('Found ELO:', elo);
    
    return {
      success: true,
      faceitNickname,
      elo,
      profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}`
    };
  } catch (error) {
    console.error('Error in fetchFaceitProfile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getFaceitProfile') {
    const { steamUrl } = request;
    console.log('Fetching Faceit profile for Steam URL:', steamUrl);
    
    (async () => {
      try {
        const response = await fetchFaceitProfile(steamUrl);
        console.log('Sending response:', response);
        sendResponse(response);
      } catch (error) {
        console.error('Error in getFaceitProfile:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    })();
    
    return true;
  }
  
  if (request.action === 'getDotabuffProfile') {
    const { steamUrl } = request;
    console.log('Fetching Dotabuff profile for Steam URL', steamUrl);

    (async () => {
      try {
        const response = await fetchDotabuffProfile(steamUrl);
        console.log('Sending response:', response);
        sendResponse(response);
      }
      catch (error) {
        console.error('Error in getDotabuffProfile:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
      }
    })()
    return true;
  }

  if (request.action === 'getCache') {
    try {
      chrome.storage.local.get('playerCache', (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting cache:', chrome.runtime.lastError);
          sendResponse({ cache: {} });
        } else {
          sendResponse({ cache: result.playerCache || {} });
        }
      });
    } catch (error) {
      console.error('Error in getCache:', error);
      sendResponse({ cache: {} });
    }
    return true;
  }
  
  if (request.action === 'saveCache') {
    try {
      chrome.storage.local.set({ playerCache: request.cache }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving cache:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
    } catch (error) {
      console.error('Error in saveCache:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    return true;
  }

  if (request.action === 'clearCache') {
    try {
      chrome.storage.local.remove('playerCache', () => {
        if (chrome.runtime.lastError) {
          console.error('Error clearing cache:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('Cache cleared successfully');
          sendResponse({ success: true });
        }
      });
    } catch (error) {
      console.error('Error in clearCache:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    return true;
  }
}); 