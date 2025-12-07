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
  timestamp?: number; // Unix timestamp when the data was cached
}

interface PlayerCache {
  byVsclName: Record<string, PlayerData>;
}

interface FaceitResponse {
  success: boolean;
  error?: string;
  faceitNickname?: string;
  elo?: string;
  profileUrl?: string;
}

interface CacheResponse {
  cache: Record<string, PlayerData>;
}

interface SaveCacheResponse {
  success: boolean;
  error?: string;
}

const playerCache: PlayerCache = {
  byVsclName: {}
};

var currentGame: string | undefined = ''

async function loadCache(): Promise<void> {
  try {
    const response = await new Promise<CacheResponse>((resolve) => {
      chrome.runtime.sendMessage({ action: 'getCache' }, resolve);
    });
    
    if (response && response.cache) {
      const now = Date.now();
      const oneHourInMs = 60 * 60 * 1000;
      
      const validCache = Object.entries(response.cache).reduce((acc, [key, value]) => {
        if (value.timestamp && (now - value.timestamp) < oneHourInMs) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, PlayerData>);
      
      Object.assign(playerCache.byVsclName, validCache);
      console.log('VSCL Faceit Finder: Loaded cache from storage:', Object.keys(playerCache.byVsclName));
      
      if (Object.keys(validCache).length !== Object.keys(response.cache).length) {
        await saveCache();
      }
    }
  } catch (error) {
    console.error('VSCL Faceit Finder: Error loading cache from storage:', error);
  }
}

async function saveCache(): Promise<void> {
  try {
    await new Promise<SaveCacheResponse>((resolve) => {
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
  const isMatchPage = window.location.href.includes('/tournaments/') || window.location.href.includes('/matches/');
  const isPlayerPage = window.location.href.includes('/player/');
  
  if (!isMatchPage && !isPlayerPage) {
    return;
  }
  
  console.log('VSCL Faceit Finder: Initializing...');
  console.log('VSCL Faceit Finder: Using VSCL nickname-based caching system');
  console.log(`VSCL Faceit Finder: Page type: ${isPlayerPage ? 'Player' : 'Match'}`);
  
  await loadCache();
  console.log('VSCL Faceit Finder: Currently cached players:', Object.keys(playerCache.byVsclName));
  
  currentGame = getCurrentGame()
  console.log(`VSCL Faceit Finder: Found game ${currentGame}`)

  var playerElements: NodeListOf<Element>;
  
  if (isPlayerPage) {
    // For player profile pages, process the main player and teammates
    // First, process the main player (the one whose profile we're viewing)
    const mainPlayerNameElement = document.querySelector('h1');
    if (mainPlayerNameElement) {
      // Extract clean player name - get first text node, remove extra whitespace
      let mainPlayerName = '';
      const textNodes: string[] = [];
      const walker = document.createTreeWalker(
        mainPlayerNameElement,
        NodeFilter.SHOW_TEXT,
        null
      );
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent?.trim();
        if (text) {
          textNodes.push(text);
        }
      }
      // Get the first meaningful text (usually the nickname)
      mainPlayerName = textNodes[0] || mainPlayerNameElement.textContent?.trim().split(/\s+/)[0] || '';
      mainPlayerName = mainPlayerName.trim();
      
      const currentProfileUrl = window.location.href;
      
      // Create a beautiful container element for the main player's Faceit data
      const containerElement = document.createElement('div');
      containerElement.className = 'faceit-profile-container';
      
      // Insert after h1 or in its parent as a new line
      if (mainPlayerNameElement.parentElement) {
        mainPlayerNameElement.parentElement.insertBefore(containerElement, mainPlayerNameElement.nextSibling);
      } else {
        mainPlayerNameElement.after(containerElement);
      }
      
      await processPlayerElementForProfile(mainPlayerName, currentProfileUrl, containerElement);
      await delay(500);
    }
    
    // Find teammates section - look for links to other players
    // Exclude navigation links (they have paths like /player/ID/name/section)
    // Real player links are like /player/ID/name (no extra path segments)
    const allPlayerLinks = document.querySelectorAll('a[href*="/player/"]');
    const playerLinksArray = Array.from(allPlayerLinks).filter((link) => {
      const href = (link as HTMLAnchorElement).href;
      // Match pattern: /player/NUMBER/name (no trailing slash or additional path)
      const playerUrlPattern = /\/player\/\d+\/[^\/]+$/;
      // Exclude navigation items (Профиль, Профайл, Турниры, etc.)
      const linkText = link.textContent?.trim() || '';
      const navigationItems = ['Профиль', 'Профайл', 'Турниры', 'Матчи', 'Друзья', 'История', 'Стрим', 'Статистика', 'Profile', 'Tournaments', 'Matches', 'Friends', 'History', 'Stream', 'Stats'];
      
      return playerUrlPattern.test(href) && !navigationItems.some(nav => linkText.includes(nav));
    });
    
    playerElements = playerLinksArray as unknown as NodeListOf<Element>;
    console.log(`VSCL Faceit Finder: Found ${playerElements.length} player links on profile page (filtered from ${allPlayerLinks.length} total links)`);
  } else {
    // For match pages, use existing selectors
    playerElements = document.querySelectorAll('.media.my-4');
    if (playerElements.length === 0) {
      playerElements = document.querySelectorAll('.name.mb-1');
    }
  }
  
  console.log(`VSCL Faceit Finder: Found ${playerElements.length} player elements`);
  
  const playerElementsArray = Array.from(playerElements);
  
  for (let i = 0; i < playerElementsArray.length; i += 2) {
    const batch = playerElementsArray.slice(i, i + 2);
    
    for (const playerElement of batch) {
      processPlayerElement(playerElement as HTMLElement, isPlayerPage);
    }
    
    if (i + 2 < playerElementsArray.length) {
      await delay(1000);
    }
  }
}

async function processPlayerElementForProfile(playerName: string, profileUrl: string, containerElement: HTMLElement) {
  console.log(`VSCL Faceit Finder: Processing main player ${playerName} at ${profileUrl}`);
  
  const existingLoading = containerElement.querySelector('.faceit-loading');
  if (existingLoading) {
    existingLoading.remove();
  }
  const existingError = containerElement.querySelector('.faceit-error');
  if (existingError) {
    existingError.remove();
  }
  const existingLinks = containerElement.querySelectorAll('.faceit-link');
  existingLinks.forEach(link => link.remove());
  
  // Clear existing content and show loading
  containerElement.innerHTML = '';
  
  const loadingCard = document.createElement('div');
  loadingCard.className = 'faceit-profile-card faceit-profile-card-loading';
  
  const loadingSpinner = document.createElement('div');
  loadingSpinner.className = 'faceit-profile-loading-spinner';
  loadingCard.appendChild(loadingSpinner);
  
  const loadingText = document.createElement('div');
  loadingText.className = 'faceit-profile-loading-text';
  loadingText.textContent = 'Loading Faceit data...';
  loadingCard.appendChild(loadingText);
  
  containerElement.appendChild(loadingCard);
  
  await delay(500);
  
  if (playerCache.byVsclName[playerName]) {
    console.log(`VSCL Faceit Finder: Cache hit for ${playerName} - using cached data`);
    containerElement.innerHTML = '';
    if (playerCache.byVsclName[playerName].faceitData) {
      displayFaceitDataForProfile(containerElement, playerCache.byVsclName[playerName]);
    } else {
      displayErrorForProfile(containerElement, 'No Faceit profile found', true, playerName);
    }
    return;
  }
  
  console.log(`VSCL Faceit Finder: Cache miss for ${playerName} - fetching new data`);
  
  try {
    const steamProfileUrl = await getSteamProfileUrl(profileUrl);
    if (!steamProfileUrl) {
      containerElement.innerHTML = '';
      displayErrorForProfile(containerElement, 'No Steam profile found', true, playerName);
      return;
    }
    
    console.log(`VSCL Faceit Finder: Found Steam URL ${steamProfileUrl} for ${playerName}`);
    
    await delay(500);
    
    getFaceitData(steamProfileUrl)
      .then(async (faceitData) => {
        containerElement.innerHTML = '';
        
        if (!faceitData.success) {
          console.log(`VSCL Faceit Finder: Error for ${playerName}:`, faceitData.error);
          displayErrorForProfile(containerElement, faceitData.error || 'No Faceit profile found', true, playerName);
          return;
        }
        
        if (!faceitData.faceitNickname || !faceitData.elo || !faceitData.profileUrl) {
          console.log(`VSCL Faceit Finder: Missing Faceit data for ${playerName}`);
          displayErrorForProfile(containerElement, 'No Faceit profile found', true, playerName);
          return;
        }
        
        console.log(`VSCL Faceit Finder: Found Faceit data for ${playerName}:`, faceitData);
        
        const playerData: PlayerData = {
          name: playerName,
          profileUrl,
          element: containerElement,
          steamProfileUrl,
          faceitData: {
            elo: faceitData.elo,
            nickname: faceitData.faceitNickname,
            profileUrl: faceitData.profileUrl
          },
          timestamp: Date.now()
        };
        
        playerCache.byVsclName[playerName] = playerData;
        console.log(`VSCL Faceit Finder: Added ${playerName} to cache with Faceit data. Total cached players: ${Object.keys(playerCache.byVsclName).length}`);
        
        await saveCache();
        displayFaceitDataForProfile(containerElement, playerData);
      })
      .catch((error) => {
        containerElement.innerHTML = '';
        console.error(`VSCL Faceit Finder: Error fetching Faceit data for ${playerName}:`, error);
        displayErrorForProfile(containerElement, 'No Faceit profile found', true, playerName);
      });
  } catch (error) {
    containerElement.innerHTML = '';
    console.error(`VSCL Faceit Finder: Error fetching Steam profile for ${playerName}:`, error);
    displayErrorForProfile(containerElement, 'Error fetching Steam profile', true, playerName);
  }
}

async function processPlayerElement(playerElement: HTMLElement, isPlayerPage: boolean = false) {
  var profileLink: HTMLAnchorElement | null = null;
  
  if (isPlayerPage) {
    // For player profile pages, the element itself might be the link
    if (playerElement.tagName === 'A' && playerElement.getAttribute('href')?.includes('/player/')) {
      profileLink = playerElement as HTMLAnchorElement;
    } else {
      // Or look for a link within the element
      profileLink = playerElement.querySelector('a[href*="/player/"]') as HTMLAnchorElement;
    }
  } else {
    // For match pages, use existing selectors
    profileLink = playerElement.querySelector('a.font-weight-normal.text-dark') as HTMLAnchorElement;
    if (!profileLink) {
      profileLink = playerElement.querySelector('a.text-dark') as HTMLAnchorElement;
    }
  }
  
  if (!profileLink) {
    console.log('VSCL Faceit Finder: No profile link found for element');
    return;
  }
  
  const playerName = profileLink.textContent?.trim() || 'Unknown';
  const profileUrl = profileLink.href;
  
  console.log(`VSCL Faceit Finder: Processing player ${playerName} at ${profileUrl}`);
  
  const existingLoading = playerElement.querySelector('.faceit-loading');
  if (existingLoading) {
    existingLoading.remove();
  }
  const existingError = playerElement.querySelector('.faceit-error');
  if (existingError) {
    existingError.remove();
  }
  const existingLinks = playerElement.querySelectorAll('.faceit-link');
  existingLinks.forEach(link => link.remove());
  
  const loadingElement = document.createElement('span');
  loadingElement.className = 'faceit-loading';
  loadingElement.textContent = 'Loading Faceit data...';
  
  // For player profile pages, append near the link
  if (isPlayerPage) {
    // Try to find a parent container (like a div or list item)
    const container = profileLink.parentElement || profileLink.nextSibling?.parentElement || playerElement;
    if (container && container !== profileLink) {
      container.appendChild(loadingElement);
    } else {
      // If no container, insert after the link
      profileLink.parentNode?.insertBefore(loadingElement, profileLink.nextSibling);
    }
  } else {
    profileLink.parentNode?.appendChild(loadingElement);
  }
  
  await delay(500);
  
  if (playerCache.byVsclName[playerName]) {
    console.log(`VSCL Faceit Finder: Cache hit for ${playerName} - using cached data`);
    loadingElement.remove();
    if (playerCache.byVsclName[playerName].faceitData) {
      displayFaceitData(playerElement, playerCache.byVsclName[playerName]);
    } else {
      displayError(playerElement, 'No Faceit profile found', true);
    }
    return;
  }
  
  console.log(`VSCL Faceit Finder: Cache miss for ${playerName} - fetching new data`);
  
  try {
    const steamProfileUrl = await getSteamProfileUrl(profileUrl);
    if (!steamProfileUrl) {
      loadingElement.remove();
      displayError(playerElement, 'No Steam profile found', true);
      return;
    }
    
    console.log(`VSCL Faceit Finder: Found Steam URL ${steamProfileUrl} for ${playerName}`);
    
    await delay(500);
    
    getFaceitData(steamProfileUrl)
      .then(async (faceitData) => {
        loadingElement.remove();
        
        if (!faceitData.success) {
          console.log(`VSCL Faceit Finder: Error for ${playerName}:`, faceitData.error);
          displayError(playerElement, faceitData.error || 'No Faceit profile found', true);
          return;
        }
        
        if (!faceitData.faceitNickname || !faceitData.elo || !faceitData.profileUrl) {
          console.log(`VSCL Faceit Finder: Missing Faceit data for ${playerName}`);
          displayError(playerElement, 'No Faceit profile found', true);
          return;
        }
        
        console.log(`VSCL Faceit Finder: Found Faceit data for ${playerName}:`, faceitData);
        
        const playerData: PlayerData = {
          name: playerName,
          profileUrl,
          element: playerElement,
          steamProfileUrl,
          faceitData: {
            elo: faceitData.elo,
            nickname: faceitData.faceitNickname,
            profileUrl: faceitData.profileUrl
          },
          timestamp: Date.now()
        };
        
        playerCache.byVsclName[playerName] = playerData;
        console.log(`VSCL Faceit Finder: Added ${playerName} to cache with Faceit data. Total cached players: ${Object.keys(playerCache.byVsclName).length}`);
        
        await saveCache();
        displayFaceitData(playerElement, playerData);
      })
      .catch((error) => {
        loadingElement.remove();
        console.error(`VSCL Faceit Finder: Error fetching Faceit data for ${playerName}:`, error);
        displayError(playerElement, 'No Faceit profile found', true);
      });
  } catch (error) {
    loadingElement.remove();
    console.error(`VSCL Faceit Finder: Error fetching Steam profile for ${playerName}:`, error);
    displayError(playerElement, 'Error fetching Steam profile', true);
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
      const text = item.textContent?.trim() || '';
      if (text.startsWith('Counter Strike 2')) {
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

function getFaceitData(steamUrl: string): Promise<FaceitResponse> {
  const action = currentGame === 'Dota2' ? 'getDotabuffProfile' : 'getFaceitProfile';
  
  return new Promise((resolve: (value: FaceitResponse) => void, reject: (reason?: any) => void) => {
    chrome.runtime.sendMessage({
      action: action,
      steamUrl
    }, (response: FaceitResponse) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

function getCurrentGame(): string | undefined {
  const game = document.querySelector('div.discipline')?.textContent?.toString().trim();
  return game
}

function displayFaceitDataForProfile(containerElement: HTMLElement, playerData: PlayerData) {
  if (!playerData.faceitData) {
    return;
  }
  
  // Clear existing content
  containerElement.innerHTML = '';
  
  // Create a card-like container
  const cardElement = document.createElement('div');
  cardElement.className = 'faceit-profile-card';
  
  // Create header with label
  const headerElement = document.createElement('div');
  headerElement.className = 'faceit-profile-header';
  headerElement.textContent = currentGame === 'Dota2' ? 'Dotabuff' : 'Faceit';
  cardElement.appendChild(headerElement);
  
  // Create content area
  const contentElement = document.createElement('div');
  contentElement.className = 'faceit-profile-content';
  
  // ELO/Rank display
  const eloWrapper = document.createElement('div');
  eloWrapper.className = 'faceit-profile-elo-wrapper';
  
  const eloLabel = document.createElement('span');
  eloLabel.className = 'faceit-profile-elo-label';
  eloLabel.textContent = currentGame === 'Dota2' ? 'Rank:' : 'ELO:';
  
  const eloValue = document.createElement('span');
  eloValue.className = 'faceit-profile-elo-value';
  eloValue.textContent = playerData.faceitData.elo;
  
  eloWrapper.appendChild(eloLabel);
  eloWrapper.appendChild(eloValue);
  contentElement.appendChild(eloWrapper);
  
  // Nickname display
  const nicknameWrapper = document.createElement('div');
  nicknameWrapper.className = 'faceit-profile-nickname-wrapper';
  
  const nicknameLabel = document.createElement('span');
  nicknameLabel.className = 'faceit-profile-nickname-label';
  nicknameLabel.textContent = 'Nickname:';
  
  const nicknameValue = document.createElement('span');
  nicknameValue.className = 'faceit-profile-nickname-value';
  nicknameValue.textContent = playerData.faceitData.nickname;
  
  nicknameWrapper.appendChild(nicknameLabel);
  nicknameWrapper.appendChild(nicknameValue);
  contentElement.appendChild(nicknameWrapper);
  
  cardElement.appendChild(contentElement);
  
  // Stats link button
  const hrefLink = currentGame === 'Dota2' ? 'dotabuff.com/players' : 'faceitanalyser.com/stats';
  const statsLinkElement = document.createElement('a');
  statsLinkElement.className = 'faceit-profile-stats-link';
  statsLinkElement.textContent = 'View Stats';
  statsLinkElement.href = `https://${hrefLink}/${playerData.faceitData.nickname}`;
  statsLinkElement.target = '_blank';
  cardElement.appendChild(statsLinkElement);
  
  containerElement.appendChild(cardElement);
}

function displayErrorForProfile(containerElement: HTMLElement, errorMessage: string, showRetry: boolean, playerName: string) {
  // Clear existing content
  containerElement.innerHTML = '';
  
  // Create error card
  const cardElement = document.createElement('div');
  cardElement.className = 'faceit-profile-card faceit-profile-card-error';
  
  const errorIcon = document.createElement('div');
  errorIcon.className = 'faceit-profile-error-icon';
  errorIcon.textContent = '⚠';
  cardElement.appendChild(errorIcon);
  
  const errorText = document.createElement('div');
  errorText.className = 'faceit-profile-error-text';
  errorText.textContent = errorMessage;
  cardElement.appendChild(errorText);
  
  const actionsElement = document.createElement('div');
  actionsElement.className = 'faceit-profile-actions';
  
  if (playerName) {
    const searchLink = document.createElement('a');
    searchLink.className = 'faceit-profile-action-link';
    searchLink.textContent = 'Search';
    searchLink.href = `https://faceitanalyser.com/finder?q=${encodeURIComponent(playerName)}`;
    searchLink.target = '_blank';
    searchLink.title = 'Search manually on Faceit Finder';
    actionsElement.appendChild(searchLink);
    
    if (showRetry) {
      const retryLink = document.createElement('a');
      retryLink.className = 'faceit-profile-action-link';
      retryLink.textContent = 'Retry';
      retryLink.href = '#';
      retryLink.title = 'Retry fetching Faceit data';
      retryLink.onclick = (e) => {
        e.preventDefault();
        const profileUrl = window.location.href;
        processPlayerElementForProfile(playerName, profileUrl, containerElement);
      };
      actionsElement.appendChild(retryLink);
    }
  }
  
  cardElement.appendChild(actionsElement);
  containerElement.appendChild(cardElement);
}

function displayFaceitData(playerElement: HTMLElement, playerData: PlayerData) {
  if (!playerData.faceitData) {
    return;
  }
  
  var profileLink = playerElement.querySelector('a.font-weight-normal.text-dark') as HTMLAnchorElement;
  if (!profileLink) {
    profileLink = playerElement.querySelector('a.text-dark') as HTMLAnchorElement;
  }
  if (!profileLink) {
    profileLink = playerElement.querySelector('a[href*="/player/"]') as HTMLAnchorElement;
  }
  if (!profileLink) {
    profileLink = playerElement.querySelector('td a') as HTMLAnchorElement;
  }
  
  if (!profileLink) {
    return;
  }
  
  const isPlayerPage = window.location.href.includes('/player/');
  let container: HTMLElement;
  
  if (isPlayerPage) {
    // For player profile pages, try to find a suitable container
    container = profileLink.parentElement as HTMLElement || playerElement;
    // If the link is directly in the element, use the element itself
    if (playerElement === profileLink) {
      container = profileLink.parentElement as HTMLElement || document.body;
    }
  } else {
    container = profileLink.parentNode as HTMLElement;
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
  eloElement.textContent = `${playerData.faceitData.elo} ${currentGame === 'Dota2' ? '': 'ELO'}`;
  container.appendChild(eloElement);
  
  const hrefLink = currentGame === 'Dota2' ? 'dotabuff.com/players' : 'faceitanalyser.com/stats'
  const statsLinkElement = document.createElement('a');
  statsLinkElement.className = 'faceit-link';
  statsLinkElement.textContent = 'Stats';
  statsLinkElement.href = `https://${hrefLink}/${playerData.faceitData.nickname}`;
  statsLinkElement.target = '_blank';
  container.appendChild(statsLinkElement);
}

function displayError(playerElement: HTMLElement, errorMessage: string, showRetry: boolean = false) {
  var profileLink = playerElement.querySelector('a.font-weight-normal.text-dark') as HTMLAnchorElement;
  if (!profileLink) {
    profileLink = playerElement.querySelector('a.text-dark') as HTMLAnchorElement;
  }
  if (!profileLink) {
    profileLink = playerElement.querySelector('a[href*="/player/"]') as HTMLAnchorElement;
  }
  if (!profileLink) {
    profileLink = playerElement.querySelector('td a') as HTMLAnchorElement;
  }
  
  if (!profileLink) {
    return;
  }
  
  const isPlayerPage = window.location.href.includes('/player/');
  let container: HTMLElement;
  
  if (isPlayerPage) {
    // For player profile pages, try to find a suitable container
    container = profileLink.parentElement as HTMLElement || playerElement;
    // If the link is directly in the element, use the element itself
    if (playerElement === profileLink) {
      container = profileLink.parentElement as HTMLElement || document.body;
    }
  } else {
    container = profileLink.parentNode as HTMLElement;
  }
  
  const errorElement = document.createElement('span');
  errorElement.className = 'faceit-error';
  errorElement.textContent = errorMessage;
  container.appendChild(errorElement);
  
  const playerName = profileLink.textContent?.trim() || '';
  if (playerName) {
    const searchLink = document.createElement('a');
    searchLink.className = 'faceit-link';
    searchLink.textContent = 'Search';
    searchLink.href = `https://faceitanalyser.com/finder?q=${encodeURIComponent(playerName)}`;
    searchLink.target = '_blank';
    searchLink.title = 'Search manually on Faceit Finder';
    container.appendChild(searchLink);
    
    if (showRetry) {
      const retryLink = document.createElement('a');
      retryLink.className = 'faceit-link';
      retryLink.textContent = 'Retry';
      retryLink.href = '#';
      retryLink.title = 'Retry fetching Faceit data';
      const isPlayerPage = window.location.href.includes('/player/');
      retryLink.onclick = (e) => {
        e.preventDefault();
        processPlayerElement(playerElement, isPlayerPage);
      };
      container.appendChild(retryLink);
    }
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