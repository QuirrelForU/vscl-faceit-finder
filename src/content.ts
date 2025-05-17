/**
 * VSCL Faceit Finder Content Script
 * 
 * This script runs on VSCL.ru match pages and adds Faceit ELO information
 * to player entries by fetching data from FaceitAnalyser.
 */

/**
 * Represents player data structure
 */
interface PlayerData {
  name: string;
  profileUrl: string;
  element: HTMLElement;
  steamProfileUrl?: string;
  faceitData?: {
    elo: string;
    nickname: string;
    profileUrl: string;
  };
}

// Cache to prevent unnecessary API calls
const playerCache: Record<string, PlayerData> = {};

/**
 * Initializes the Faceit finder extension
 * Processes player elements on VSCL match pages
 */
async function initVsclFaceitFinder() {
  // Only run on match pages
  if (!window.location.href.includes('/tournaments/') || !window.location.href.includes('/matches/')) {
    return;
  }

  console.log('VSCL Faceit Finder: Initializing...');
  
  // Find all player elements on the page
  const playerElements = document.querySelectorAll('.media.my-4');
  if (playerElements.length === 0) {
    console.log('VSCL Faceit Finder: No player elements found');
    return;
  }
  
  console.log(`VSCL Faceit Finder: Found ${playerElements.length} player elements`);
  
  // Process players in small batches to avoid overwhelming the message port
  const playerElementsArray = Array.from(playerElements);
  
  // Process in batches of 2 with a delay between batches
  for (let i = 0; i < playerElementsArray.length; i += 2) {
    const batch = playerElementsArray.slice(i, i + 2);
    
    // Process this batch
    for (const playerElement of batch) {
      processPlayerElement(playerElement as HTMLElement);
    }
    
    // Wait a bit before processing the next batch
    if (i + 2 < playerElementsArray.length) {
      await delay(1000);
    }
  }
}

/**
 * Processes a single player element to fetch and display Faceit data
 * @param playerElement - The HTML element containing player information
 */
async function processPlayerElement(playerElement: HTMLElement) {
  // Find the player profile link
  const profileLink = playerElement.querySelector('a.font-weight-normal.text-dark') as HTMLAnchorElement;
  if (!profileLink) {
    console.log('VSCL Faceit Finder: No profile link found for player element');
    return;
  }
  
  const playerName = profileLink.textContent?.trim() || 'Unknown';
  const profileUrl = profileLink.href;
  
  console.log(`VSCL Faceit Finder: Processing player ${playerName} at ${profileUrl}`);
  
  // Check if we've already processed this player
  if (playerCache[profileUrl]) {
    displayFaceitData(playerElement, playerCache[profileUrl]);
    return;
  }
  
  // Create player data object
  const playerData: PlayerData = {
    name: playerName,
    profileUrl,
    element: playerElement
  };
  
  // Store in cache
  playerCache[profileUrl] = playerData;
  
  // Add loading indicator
  const loadingElement = document.createElement('span');
  loadingElement.className = 'faceit-loading';
  loadingElement.textContent = 'Loading Faceit data...';
  profileLink.parentNode?.appendChild(loadingElement);
  
  // Fetch VSCL profile to get Steam URL
  try {
    const steamProfileUrl = await getSteamProfileUrl(profileUrl);
    if (!steamProfileUrl) {
      loadingElement.remove();
      displayError(playerElement, 'No Steam profile found');
      return;
    }
    
    console.log(`VSCL Faceit Finder: Found Steam URL ${steamProfileUrl} for ${playerName}`);
    
    playerData.steamProfileUrl = steamProfileUrl;
    
    // Now fetch Faceit data using the Steam URL
    // Add a small delay to avoid too many concurrent requests
    await delay(500);
    
    getFaceitData(steamProfileUrl)
      .then((faceitData) => {
        // Remove loading indicator
        loadingElement.remove();
        
        if (!faceitData.success) {
          console.log(`VSCL Faceit Finder: Error for ${playerName}:`, faceitData.error);
          displayError(playerElement, faceitData.error || 'Failed to get Faceit data');
          return;
        }
        
        console.log(`VSCL Faceit Finder: Found Faceit data for ${playerName}:`, faceitData);
        
        // Store Faceit data
        playerData.faceitData = {
          elo: faceitData.elo,
          nickname: faceitData.faceitNickname,
          profileUrl: faceitData.profileUrl
        };
        
        // Display the data
        displayFaceitData(playerElement, playerData);
      })
      .catch((error) => {
        loadingElement.remove();
        console.error(`VSCL Faceit Finder: Error fetching Faceit data for ${playerName}:`, error);
        displayError(playerElement, 'Error fetching Faceit data');
      });
  } catch (error) {
    loadingElement.remove();
    console.error(`VSCL Faceit Finder: Error fetching Steam profile for ${playerName}:`, error);
    displayError(playerElement, 'Error fetching Steam profile');
  }
}

/**
 * Extracts Steam profile URL from VSCL player profile
 * @param vsclProfileUrl - The VSCL profile URL
 * @returns Promise resolving to the Steam profile URL or null if not found
 */
async function getSteamProfileUrl(vsclProfileUrl: string): Promise<string | null> {
  try {
    const response = await fetch(vsclProfileUrl);
    const html = await response.text();
    
    // Create a temporary DOM element to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // First approach: Look for Counter-Strike 2 in game accounts section
    const accountsList = doc.querySelectorAll('li');
    
    for (const item of accountsList) {
      const text = item.textContent || '';
      if (text.includes('Counter Strike 2')) {
        console.log('Found CS2 account text:', text);
        
        // Try to match a Steam ID in any format
        // Look for Steam64 ID first (a long number)
        const steamIdMatch = text.match(/\b7656119\d{10}\b/);
        if (steamIdMatch && steamIdMatch[0]) {
          return `https://steamcommunity.com/profiles/${steamIdMatch[0]}`;
        }
        
        // Try to find any other ID format
        const anyNumberMatch = text.match(/\b\d{5,}\b/g);
        if (anyNumberMatch && anyNumberMatch.length > 0) {
          // Sort by length, longest first (likely to be the Steam64 ID)
          const sortedIds = anyNumberMatch.sort((a, b) => b.length - a.length);
          return `https://steamcommunity.com/profiles/${sortedIds[0]}`;
        }
        
        // Try to find a Steam vanity URL
        const customUrlMatch = text.match(/steamcommunity\.com\/id\/([^\/\s]+)/);
        if (customUrlMatch && customUrlMatch[1]) {
          return `https://steamcommunity.com/id/${customUrlMatch[1]}`;
        }
      }
    }
    
    // Second approach: Look for an anchor tag that links to a Steam profile
    const steamLinks = Array.from(doc.querySelectorAll('a')).filter(
      a => a.href.includes('steamcommunity.com')
    );
    
    if (steamLinks.length > 0) {
      return steamLinks[0].href;
    }
    
    // Third approach: Check for any text that might contain a Steam ID
    const pageText = doc.body.textContent || '';
    const steamIdMatches = pageText.match(/\b7656119\d{10}\b/g);
    if (steamIdMatches && steamIdMatches.length > 0) {
      return `https://steamcommunity.com/profiles/${steamIdMatches[0]}`;
    }
    
    return null;
  } catch (error) {
    console.error('VSCL Faceit Finder: Error fetching VSCL profile', error);
    return null;
  }
}

/**
 * Fetches Faceit data from the background script
 * @param steamUrl - The Steam profile URL
 * @returns Promise resolving to Faceit data
 */
function getFaceitData(steamUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'getFaceitProfile',
      steamUrl
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Displays Faceit data on the player element
 * @param playerElement - The HTML element to display data on
 * @param playerData - The player data containing Faceit information
 */
function displayFaceitData(playerElement: HTMLElement, playerData: PlayerData) {
  if (!playerData.faceitData) {
    return;
  }
  
  const profileLink = playerElement.querySelector('a.font-weight-normal.text-dark') as HTMLAnchorElement;
  if (!profileLink) {
    return;
  }
  
  const existingElo = playerElement.querySelector('.faceit-elo');
  if (existingElo) {
    existingElo.remove();
  }
  
  const existingLink = playerElement.querySelector('.faceit-link');
  if (existingLink) {
    existingLink.remove();
  }

  const existingAnalyzerLink = playerElement.querySelector('.faceit-analyzer-link');
  if (existingAnalyzerLink) {
    existingAnalyzerLink.remove();
  }
  
  const eloElement = document.createElement('span');
  eloElement.className = 'faceit-elo';
  eloElement.textContent = `${playerData.faceitData.elo} ELO`;
  profileLink.parentNode?.appendChild(eloElement);
  
  const statsLinkElement = document.createElement('a');
  statsLinkElement.className = 'faceit-link';
  statsLinkElement.textContent = 'Stats';
  statsLinkElement.href = `https://faceitanalyser.com/stats/${playerData.faceitData.nickname}`;
  statsLinkElement.target = '_blank';
  profileLink.parentNode?.appendChild(statsLinkElement);
}

/**
 * Displays an error message on the player element
 * @param playerElement - The HTML element to display error on
 * @param errorMessage - The error message to display
 */
function displayError(playerElement: HTMLElement, errorMessage: string) {
  const profileLink = playerElement.querySelector('a.font-weight-normal.text-dark');
  if (!profileLink) {
    return;
  }
  
  // Remove loading indicator if it exists
  const loadingElement = playerElement.querySelector('.faceit-loading');
  if (loadingElement) {
    loadingElement.remove();
  }
  
  // Remove any existing error
  const existingError = playerElement.querySelector('.faceit-error');
  if (existingError) {
    existingError.remove();
  }
  
  // Create error element
  const errorElement = document.createElement('span');
  errorElement.className = 'faceit-error';
  errorElement.textContent = errorMessage;
  profileLink.parentNode?.appendChild(errorElement);
  
  // Add a direct search link for manual lookup
  const playerName = profileLink.textContent?.trim() || '';
  if (playerName) {
    const searchLink = document.createElement('a');
    searchLink.className = 'faceit-link';
    searchLink.textContent = 'Search';
    searchLink.href = `https://faceitanalyser.com/finder?q=${encodeURIComponent(playerName)}`;
    searchLink.target = '_blank';
    searchLink.title = 'Search manually on Faceit Finder';
    profileLink.parentNode?.appendChild(searchLink);
  }
}

/**
 * Creates a delay for a specified number of milliseconds
 * @param ms - Number of milliseconds to delay
 * @returns Promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the extension when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit to ensure everything is fully loaded
  setTimeout(initVsclFaceitFinder, 1000);
});

// Also run it immediately in case the DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  // Add a slightly longer delay for the already-loaded case
  setTimeout(initVsclFaceitFinder, 1500);
} 