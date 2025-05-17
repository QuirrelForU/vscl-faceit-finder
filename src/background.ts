/**
 * Handles Faceit profile data fetching and processing
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getFaceitProfile') {
    const { steamUrl } = message;
    
    console.log('Fetching Faceit profile for Steam URL:', steamUrl);
    
    const fetchFaceitProfile = async () => {
      try {
        const steamId = extractSteamId(steamUrl);
        if (!steamId) {
          return { success: false, error: 'Could not extract Steam ID' };
        }

        console.log('Searching player with Steam ID:', steamId);
        const searchResponse = await fetchWithRetry(`https://www.faceit.com/api/searcher/v1/players?limit=20&offset=0&game_id=${steamId}`);
        const searchData = await searchResponse.json();

        if (!searchData.payload || searchData.payload.length === 0) {
          return { success: false, error: 'No Faceit profile found' };
        }

        const faceitNickname = searchData.payload[0].nickname;
        console.log('Found Faceit nickname:', faceitNickname);

        const playerResponse = await fetchWithRetry(`https://www.faceit.com/api/users/v1/nicknames/${faceitNickname}`);
        const playerData = await playerResponse.json();

        if (!playerData.payload || !playerData.payload.games || !playerData.payload.games.cs2) {
          return { success: false, error: 'No CS2 data found' };
        }

        const elo = playerData.payload.games.cs2.faceit_elo.toString();
        console.log('Found ELO:', elo);

        return {
          success: true,
          faceitNickname,
          elo,
          profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}`
        };
      } catch (error: unknown) {
        console.error('Error in fetchFaceitProfile:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    };
    
    fetchFaceitProfile().then(result => {
      console.log('Sending response:', result);
      sendResponse(result);
    });
    
    return true;
  }
});

/**
 * Extracts Steam ID from various Steam URL formats
 * @param steamUrl - The Steam profile URL
 * @returns The extracted Steam ID or null if not found
 */
function extractSteamId(steamUrl: string): string | null {
  const profileMatch = steamUrl.match(/\/profiles\/(\d+)/);
  if (profileMatch && profileMatch[1]) {
    return profileMatch[1];
  }
  
  const vanityMatch = steamUrl.match(/\/id\/([^\/]+)/);
  if (vanityMatch && vanityMatch[1]) {
    return vanityMatch[1];
  }
  
  const numericMatch = steamUrl.match(/\b(\d{5,})\b/);
  if (numericMatch && numericMatch[1]) {
    return numericMatch[1];
  }
  
  return null;
}

/**
 * Fetches a URL with automatic retry mechanism
 * @param url - The URL to fetch
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise resolving to the Response object
 * @throws Error if all retry attempts fail
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500 * retries));
      }
      
      const response = await fetch(url);
      
      if (response.ok || response.status === 302 || response.status === 301) {
        return response;
      }
      
      if (retries === maxRetries - 1) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
    } catch (error) {
      if (retries === maxRetries - 1) {
        throw error;
      }
    }
    
    retries++;
    console.log(`Retrying fetch for ${url}, attempt ${retries} of ${maxRetries}`);
  }
  
  throw new Error('Max retries reached');
} 