/**
 * VSCL Faceit Finder Content Script
 * 
 * This script runs on VSCL.ru match pages and adds Faceit ELO information
 * to player entries by fetching data from FaceitAnalyser.
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

// Main function to initialize the extension
function initVsclFaceitFinder() {
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
  
  // Process each player element
  playerElements.forEach((playerElement) => {
    processPlayerElement(playerElement as HTMLElement);
  });
}

// Process a single player element
async function processPlayerElement(playerElement: HTMLElement) {
  // Find the player profile link
  const profileLink = playerElement.querySelector('a.font-weight-normal.text-dark') as HTMLAnchorElement;
  if (!profileLink) {
    console.log('VSCL Faceit Finder: No profile link found for player element');
    return;
  }
  
  const playerName = profileLink.textContent?.trim() || 'Unknown';
  const profileUrl = profileLink.href;
  
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
    
    playerData.steamProfileUrl = steamProfileUrl;
    
    // Now fetch Faceit data using the Steam URL
    getFaceitData(steamProfileUrl)
      .then((faceitData) => {
        // Remove loading indicator
        loadingElement.remove();
        
        if (!faceitData.success) {
          displayError(playerElement, faceitData.error || 'Failed to get Faceit data');
          return;
        }
        
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
        displayError(playerElement, 'Error fetching Faceit data');
        console.error('VSCL Faceit Finder:', error);
      });
  } catch (error) {
    loadingElement.remove();
    displayError(playerElement, 'Error fetching Steam profile');
    console.error('VSCL Faceit Finder:', error);
  }
}

// Fetch Steam profile URL from VSCL player profile
async function getSteamProfileUrl(vsclProfileUrl: string): Promise<string | null> {
  try {
    const response = await fetch(vsclProfileUrl);
    const html = await response.text();
    
    // Create a temporary DOM element to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find the CS2 Steam profile link by looking at all li elements
    // and filtering for one that contains "Counter Strike 2"
    const allListItems = Array.from(doc.querySelectorAll('li'));
    const steamProfileElement = allListItems.find(li => 
      li.textContent?.includes('Counter Strike 2')
    );
    
    if (!steamProfileElement) {
      return null;
    }
    
    // Extract the Steam ID from the text content
    const steamIdMatch = steamProfileElement.textContent?.match(/\d+/);
    if (!steamIdMatch || !steamIdMatch[0]) {
      return null;
    }
    
    return `https://steamcommunity.com/profiles/${steamIdMatch[0]}`;
  } catch (error) {
    console.error('VSCL Faceit Finder: Error fetching VSCL profile', error);
    return null;
  }
}

// Get Faceit data from background script
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

// Display Faceit data on the player element
function displayFaceitData(playerElement: HTMLElement, playerData: PlayerData) {
  if (!playerData.faceitData) {
    return;
  }
  
  const profileLink = playerElement.querySelector('a.font-weight-normal.text-dark') as HTMLAnchorElement;
  if (!profileLink) {
    return;
  }
  
  // Remove any existing Faceit elements
  const existingElo = playerElement.querySelector('.faceit-elo');
  if (existingElo) {
    existingElo.remove();
  }
  
  const existingLink = playerElement.querySelector('.faceit-link');
  if (existingLink) {
    existingLink.remove();
  }
  
  // Create ELO element
  const eloElement = document.createElement('span');
  eloElement.className = 'faceit-elo';
  eloElement.textContent = `${playerData.faceitData.elo} ELO`;
  profileLink.parentNode?.appendChild(eloElement);
  
  // Create Faceit profile link
  const faceitLinkElement = document.createElement('a');
  faceitLinkElement.className = 'faceit-link';
  faceitLinkElement.textContent = 'Faceit';
  faceitLinkElement.href = playerData.faceitData.profileUrl;
  faceitLinkElement.target = '_blank';
  profileLink.parentNode?.appendChild(faceitLinkElement);
}

// Display error message
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
  
  // Create error element
  const errorElement = document.createElement('span');
  errorElement.className = 'faceit-error';
  errorElement.textContent = errorMessage;
  profileLink.parentNode?.appendChild(errorElement);
}

// Run the extension when the page is loaded
document.addEventListener('DOMContentLoaded', initVsclFaceitFinder);

// Also run it immediately in case the DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(initVsclFaceitFinder, 1000); // Small delay to ensure DOM is fully loaded
} 