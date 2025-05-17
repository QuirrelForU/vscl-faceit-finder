/**
 * VSCL Faceit Finder Content Script
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

interface PlayerCache {
  byVsclName: Record<string, PlayerData>;
}

const playerCache: PlayerCache = {
  byVsclName: {}
};

async function loadCache(): Promise<void> {
  try {
    const response = await new Promise<any>((resolve) => {
      chrome.runtime.sendMessage({ action: 'getCache' }, resolve);
    });
    
    if (response && response.cache) {
      Object.assign(playerCache.byVsclName, response.cache);
      console.log('VSCL Faceit Finder: Loaded cache from storage:', Object.keys(playerCache.byVsclName));
    }
  } catch (error) {
    console.error('VSCL Faceit Finder: Error loading cache from storage:', error);
  }
}

async function saveCache(): Promise<void> {
  try {
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'saveCache', cache: playerCache.byVsclName },
        resolve
      );
    });
    console.log('VSCL Faceit Finder: Saved cache to storage');
  } catch (error) {
    console.error('VSCL Faceit Finder: Error saving cache to storage:', error);
  }
}

async function initVsclFaceitFinder() {
  if (!window.location.href.includes('/tournaments/') || !window.location.href.includes('/matches/')) {
    return;
  }

  console.log('VSCL Faceit Finder: Initializing...');
  console.log('VSCL Faceit Finder: Using VSCL nickname-based caching system');
  
  await loadCache();
  console.log('VSCL Faceit Finder: Currently cached players:', Object.keys(playerCache.byVsclName));
  
  const playerElements = document.querySelectorAll('.media.my-4');
  if (playerElements.length === 0) {
    console.log('VSCL Faceit Finder: No player elements found');
    return;
  }
  
  console.log(`VSCL Faceit Finder: Found ${playerElements.length} player elements`);
  
  const playerElementsArray = Array.from(playerElements);
  
  for (let i = 0; i < playerElementsArray.length; i += 2) {
    const batch = playerElementsArray.slice(i, i + 2);
    
    for (const playerElement of batch) {
      processPlayerElement(playerElement as HTMLElement);
    }
    
    if (i + 2 < playerElementsArray.length) {
      await delay(1000);
    }
  }
}

async function processPlayerElement(playerElement: HTMLElement) {
  const profileLink = playerElement.querySelector('a.font-weight-normal.text-dark') as HTMLAnchorElement;
  if (!profileLink) {
    console.log('VSCL Faceit Finder: No profile link found for player element');
    return;
  }
  
  const playerName = profileLink.textContent?.trim() || 'Unknown';
  const profileUrl = profileLink.href;
  
  console.log(`VSCL Faceit Finder: Processing player ${playerName} at ${profileUrl}`);
  
  if (playerCache.byVsclName[playerName]) {
    console.log(`VSCL Faceit Finder: Cache hit for ${playerName} - using cached data`);
    displayFaceitData(playerElement, playerCache.byVsclName[playerName]);
    return;
  }
  
  console.log(`VSCL Faceit Finder: Cache miss for ${playerName} - fetching new data`);
  
  const playerData: PlayerData = {
    name: playerName,
    profileUrl,
    element: playerElement
  };
  
  playerCache.byVsclName[playerName] = playerData;
  console.log(`VSCL Faceit Finder: Added ${playerName} to cache. Total cached players: ${Object.keys(playerCache.byVsclName).length}`);
  
  await saveCache();
  
  const loadingElement = document.createElement('span');
  loadingElement.className = 'faceit-loading';
  loadingElement.textContent = 'Loading Faceit data...';
  profileLink.parentNode?.appendChild(loadingElement);
  
  try {
    const steamProfileUrl = await getSteamProfileUrl(profileUrl);
    if (!steamProfileUrl) {
      loadingElement.remove();
      displayError(playerElement, 'No Steam profile found');
      return;
    }
    
    console.log(`VSCL Faceit Finder: Found Steam URL ${steamProfileUrl} for ${playerName}`);
    
    playerData.steamProfileUrl = steamProfileUrl;
    
    await delay(500);
    
    getFaceitData(steamProfileUrl)
      .then(async (faceitData) => {
        loadingElement.remove();
        
        if (!faceitData.success) {
          console.log(`VSCL Faceit Finder: Error for ${playerName}:`, faceitData.error);
          displayError(playerElement, faceitData.error || 'Failed to get Faceit data');
          return;
        }
        
        console.log(`VSCL Faceit Finder: Found Faceit data for ${playerName}:`, faceitData);
        
        playerData.faceitData = {
          elo: faceitData.elo,
          nickname: faceitData.faceitNickname,
          profileUrl: faceitData.profileUrl
        };
        
        console.log(`VSCL Faceit Finder: Updated cache for ${playerName} with Faceit data`);
        await saveCache();
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

async function getSteamProfileUrl(vsclProfileUrl: string): Promise<string | null> {
  try {
    const response = await fetch(vsclProfileUrl);
    const html = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const accountsList = doc.querySelectorAll('li');
    
    for (const item of accountsList) {
      const text = item.textContent || '';
      if (text.includes('Counter Strike 2')) {
        console.log('Found CS2 account text:', text);
        
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
    console.error('VSCL Faceit Finder: Error fetching VSCL profile', error);
    return null;
  }
}

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

function displayError(playerElement: HTMLElement, errorMessage: string) {
  const profileLink = playerElement.querySelector('a.font-weight-normal.text-dark');
  if (!profileLink) {
    return;
  }
  
  const loadingElement = playerElement.querySelector('.faceit-loading');
  if (loadingElement) {
    loadingElement.remove();
  }
  
  const existingError = playerElement.querySelector('.faceit-error');
  if (existingError) {
    existingError.remove();
  }
  
  const errorElement = document.createElement('span');
  errorElement.className = 'faceit-error';
  errorElement.textContent = errorMessage;
  profileLink.parentNode?.appendChild(errorElement);
  
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initVsclFaceitFinder, 1000);
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(initVsclFaceitFinder, 1500);
} 