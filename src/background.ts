// This script handles the background processes for the extension
// It will track redirections from FaceitAnalyser

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getFaceitProfile') {
    const { steamUrl } = message;
    
    console.log('Fetching Faceit profile for Steam URL:', steamUrl);
    
    // Create a function to handle all the fetch logic synchronously
    const fetchFaceitProfile = async () => {
      try {
        // First try - direct player lookup that follows redirects
        console.log('Trying direct player lookup...');
        const response = await fetchWithRetry(`https://faceitanalyser.com/player?id=${encodeURIComponent(steamUrl)}`);
        const finalUrl = response.url;
        console.log('Response URL:', finalUrl);
        
        // If redirected to stats page, get the nickname
        if (finalUrl.includes('/stats/')) {
          const nicknameMatch = finalUrl.match(/\/stats\/([^\/]+)/);
          if (nicknameMatch && nicknameMatch[1]) {
            const faceitNickname = nicknameMatch[1];
            console.log('Found Faceit nickname from URL:', faceitNickname);
            
            // Now get the ELO from the stats page
            const statsResponse = await fetchWithRetry(`https://faceitanalyser.com/stats/${faceitNickname}/cs2`);
            const statsHtml = await statsResponse.text();
            
            const eloMatch = statsHtml.match(/(\d+)\s+ELO/);
            const elo = eloMatch ? eloMatch[1] : 'Unknown';
            
            console.log('Found ELO:', elo);
            
            return {
              success: true,
              faceitNickname,
              elo,
              profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}/cs2`
            };
          }
        }
        
        // Second try - extract Steam ID and search with finder
        const steamId = extractSteamId(steamUrl);
        if (steamId) {
          console.log('Trying finder with Steam ID:', steamId);
          
          const finderResponse = await fetchWithRetry(`https://faceitanalyser.com/finder?q=${steamId}`);
          const finderHtml = await finderResponse.text();
          
          // Look for player links in the results
          const playerLinkMatch = finderHtml.match(/href="\/stats\/([^"\/]+)\/cs2"/);
          
          if (playerLinkMatch && playerLinkMatch[1]) {
            const faceitNickname = playerLinkMatch[1];
            console.log('Found Faceit nickname from finder:', faceitNickname);
            
            // Get ELO from stats page
            const statsResponse = await fetchWithRetry(`https://faceitanalyser.com/stats/${faceitNickname}/cs2`);
            const statsHtml = await statsResponse.text();
            
            const eloMatch = statsHtml.match(/(\d+)\s+ELO/);
            const elo = eloMatch ? eloMatch[1] : 'Unknown';
            
            console.log('Found ELO:', elo);
            
            return {
              success: true,
              faceitNickname,
              elo,
              profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}/cs2`
            };
          }
        }
        
        // Third try - if it's a vanity URL, try direct stats lookup
        const customUrl = steamUrl.includes('/id/') ? 
          steamUrl.match(/\/id\/([^\/]+)/)?.[1] : null;
        
        if (customUrl) {
          console.log('Trying direct stats with custom URL:', customUrl);
          
          try {
            const statsResponse = await fetchWithRetry(`https://faceitanalyser.com/stats/${customUrl}/cs2`);
            
            if (statsResponse.status === 404) {
              throw new Error('Profile not found');
            }
            
            const statsHtml = await statsResponse.text();
            
            if (statsHtml.includes('ELO')) {
              const statsMatch = statsHtml.match(/<title>Stats\s+for\s+([^\s|/]+)/i);
              const faceitNickname = statsMatch ? statsMatch[1] : customUrl;
              
              const eloMatch = statsHtml.match(/(\d+)\s+ELO/);
              const elo = eloMatch ? eloMatch[1] : 'Unknown';
              
              console.log('Found ELO via direct stats:', elo);
              
              return {
                success: true,
                faceitNickname,
                elo,
                profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}/cs2`
              };
            }
          } catch (error) {
            console.error('Error with direct stats:', error);
          }
        }
        
        // If all attempts fail
        return { success: false, error: 'No Faceit profile found' };
      } catch (error: unknown) {
        console.error('Error in fetchFaceitProfile:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    };
    
    // Execute the fetch function and send the response
    fetchFaceitProfile().then(result => {
      console.log('Sending response:', result);
      sendResponse(result);
    });
    
    // This is critical - return true to indicate we will respond asynchronously
    return true;
  }
});

// Helper function to extract Steam ID from URL
function extractSteamId(steamUrl: string): string | null {
  // For profiles URLs like steamcommunity.com/profiles/76561198855025047
  const profileMatch = steamUrl.match(/\/profiles\/(\d+)/);
  if (profileMatch && profileMatch[1]) {
    return profileMatch[1];
  }
  
  // For vanity URLs like steamcommunity.com/id/olezhaivanov
  const vanityMatch = steamUrl.match(/\/id\/([^\/]+)/);
  if (vanityMatch && vanityMatch[1]) {
    return vanityMatch[1];
  }
  
  // For any numeric ID in the URL
  const numericMatch = steamUrl.match(/\b(\d{5,})\b/);
  if (numericMatch && numericMatch[1]) {
    return numericMatch[1];
  }
  
  return null;
}

// Fetch with retry mechanism
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // Add a small delay between retries
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500 * retries));
      }
      
      const response = await fetch(url);
      
      // If successful, return the response
      if (response.ok || response.status === 302 || response.status === 301) {
        return response;
      }
      
      // If not successful and we've used all retries, throw an error
      if (retries === maxRetries - 1) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
    } catch (error) {
      // If we've used all retries, re-throw the error
      if (retries === maxRetries - 1) {
        throw error;
      }
    }
    
    // Increment retry counter
    retries++;
    console.log(`Retrying fetch for ${url}, attempt ${retries} of ${maxRetries}`);
  }
  
  // This should never be reached, but TypeScript requires a return
  throw new Error('Max retries reached');
} 