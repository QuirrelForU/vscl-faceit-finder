/**
 * Player Processor - handles processing of individual players
 */

import { PlayerData, FaceitResponse } from './types';
import { logger } from './logger';
import { getCachedPlayer, setCachedPlayer, saveCache, getAllCachedPlayers } from './cache-manager';
import { getSteamProfileUrl } from './steam-fetcher';
import { displayFaceitData, displayError, displayErrorForProfile } from './ui-renderer';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFaceitData(steamUrl: string, currentGame: string | undefined): Promise<FaceitResponse> {
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

function getCS2Data(steamUrl: string): Promise<FaceitResponse> {
  return new Promise((resolve: (value: FaceitResponse) => void, reject: (reason?: any) => void) => {
    chrome.runtime.sendMessage({
      action: 'getFaceitProfile',
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

function getDota2Data(steamUrl: string): Promise<FaceitResponse> {
  return new Promise((resolve: (value: FaceitResponse) => void, reject: (reason?: any) => void) => {
    chrome.runtime.sendMessage({
      action: 'getDotabuffProfile',
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

export async function processPlayerElementForProfile(
  playerName: string, 
  profileUrl: string, 
  containerElement: HTMLElement,
  currentGame: string | undefined
): Promise<void> {
  logger.log(`VSCL Faceit Finder: Processing main player ${playerName} at ${profileUrl}`);
  
  // Clear existing content and show loading
  containerElement.innerHTML = '';
  
  const loadingCard = document.createElement('div');
  loadingCard.className = 'faceit-profile-card faceit-profile-card-loading';
  
  const loadingSpinner = document.createElement('div');
  loadingSpinner.className = 'faceit-profile-loading-spinner';
  loadingCard.appendChild(loadingSpinner);
  
  const loadingText = document.createElement('div');
  loadingText.className = 'faceit-profile-loading-text';
  loadingText.textContent = 'Loading profile data...';
  loadingCard.appendChild(loadingText);
  
  containerElement.appendChild(loadingCard);
  
  await delay(500);
  
  const cachedPlayer = getCachedPlayer(playerName);
  if (cachedPlayer) {
    logger.log(`VSCL Faceit Finder: Cache hit for ${playerName} - using cached data`, {
      hasFaceitData: !!cachedPlayer.faceitData,
      hasDota2Data: !!cachedPlayer.dota2Data,
      faceitProfileUrl: cachedPlayer.faceitData?.profileUrl,
      dota2ProfileUrl: cachedPlayer.dota2Data?.profileUrl
    });
    containerElement.innerHTML = '';
    displayAllGameDataForProfile(containerElement, cachedPlayer, playerName);
    return;
  }
  
  logger.log(`VSCL Faceit Finder: Cache miss for ${playerName} - fetching new data`);
  
  try {
    const steamProfileUrl = await getSteamProfileUrl(profileUrl);
    if (!steamProfileUrl) {
      containerElement.innerHTML = '';
      displayErrorForProfile(containerElement, 'No Steam profile found', true, playerName);
      return;
    }
    
    logger.log(`VSCL Faceit Finder: Found Steam URL ${steamProfileUrl} for ${playerName}`);
    
    await delay(500);
    
    // Fetch both CS2 and Dota2 data in parallel
    const [cs2Data, dota2Data] = await Promise.allSettled([
      getCS2Data(steamProfileUrl),
      getDota2Data(steamProfileUrl)
    ]);
    
    containerElement.innerHTML = '';
    
    const playerData: PlayerData = {
      name: playerName,
      profileUrl,
      element: containerElement,
      steamProfileUrl,
      timestamp: Date.now()
    };
    
    // Process CS2 data - verify it's actually CS2 data by checking profileUrl
    if (cs2Data.status === 'fulfilled' && cs2Data.value.success && 
        cs2Data.value.faceitNickname && cs2Data.value.elo && cs2Data.value.profileUrl) {
      const profileUrl = cs2Data.value.profileUrl;
      // Only store as CS2 if profileUrl contains faceitanalyser (not dotabuff)
      if (profileUrl.includes('faceitanalyser.com') || profileUrl.includes('faceit.com')) {
        playerData.faceitData = {
          elo: cs2Data.value.elo,
          nickname: cs2Data.value.faceitNickname,
          profileUrl: profileUrl
        };
        logger.log(`VSCL Faceit Finder: Found CS2 data for ${playerName}`, playerData.faceitData);
      } else {
        logger.log(`VSCL Faceit Finder: CS2 API returned non-CS2 profileUrl: ${profileUrl}, skipping`);
        logger.log(`VSCL Faceit Finder: CS2 API response:`, cs2Data.value);
      }
    } else if (cs2Data.status === 'fulfilled') {
      logger.log(`VSCL Faceit Finder: CS2 API failed or incomplete for ${playerName}:`, cs2Data.value);
    } else {
      logger.log(`VSCL Faceit Finder: CS2 API rejected for ${playerName}:`, cs2Data.reason);
    }
    
    // Process Dota2 data - verify it's actually Dota2 data by checking profileUrl
    if (dota2Data.status === 'fulfilled' && dota2Data.value.success && 
        dota2Data.value.faceitNickname && dota2Data.value.elo && dota2Data.value.profileUrl) {
      const profileUrl = dota2Data.value.profileUrl;
      // Only store as Dota2 if profileUrl contains dotabuff
      if (profileUrl.includes('dotabuff.com')) {
        playerData.dota2Data = {
          elo: dota2Data.value.elo,
          nickname: dota2Data.value.faceitNickname,
          profileUrl: profileUrl
        };
        logger.log(`VSCL Faceit Finder: Found Dota2 data for ${playerName}`, playerData.dota2Data);
      } else {
        logger.log(`VSCL Faceit Finder: Dota2 API returned non-Dota2 profileUrl: ${profileUrl}, skipping`);
        logger.log(`VSCL Faceit Finder: Dota2 API response:`, dota2Data.value);
      }
    } else if (dota2Data.status === 'fulfilled') {
      logger.log(`VSCL Faceit Finder: Dota2 API failed or incomplete for ${playerName}:`, dota2Data.value);
    } else {
      logger.log(`VSCL Faceit Finder: Dota2 API rejected for ${playerName}:`, dota2Data.reason);
    }
    
    // Only cache and display if we found at least one game's data
    if (playerData.faceitData || playerData.dota2Data) {
      setCachedPlayer(playerName, playerData);
      logger.log(`VSCL Faceit Finder: Added ${playerName} to cache. CS2: ${!!playerData.faceitData}, Dota2: ${!!playerData.dota2Data}`);
      await saveCache();
      displayAllGameDataForProfile(containerElement, playerData, playerName);
    } else {
      // No data found for either game
      displayErrorForProfile(containerElement, 'No profile found', true, playerName);
    }
  } catch (error) {
    containerElement.innerHTML = '';
    // Don't log expected errors - just show user-friendly message
    displayErrorForProfile(containerElement, 'Error fetching Steam profile', true, playerName);
  }
}

function displayAllGameDataForProfile(containerElement: HTMLElement, playerData: PlayerData, playerName: string): void {
  containerElement.innerHTML = '';
  
  logger.log(`VSCL Faceit Finder: displayAllGameDataForProfile for ${playerName}`, {
    hasFaceitData: !!playerData.faceitData,
    hasDota2Data: !!playerData.dota2Data,
    faceitData: playerData.faceitData,
    dota2Data: playerData.dota2Data
  });
  
  // Detect and migrate old cache structure where Dota2 data might be in faceitData
  // Check profileUrl to determine game type
  let cs2Data = playerData.faceitData;
  let dota2Data = playerData.dota2Data;
  
  // If we have faceitData, check if it's actually Dota2 data (old cache structure)
  if (cs2Data) {
    const profileUrl = cs2Data.profileUrl || '';
    if (profileUrl.includes('dotabuff.com')) {
      // Old cache: Dota2 data stored in faceitData - migrate it
      logger.log(`VSCL Faceit Finder: Migrating old cache - Dota2 data found in faceitData for ${playerName}`);
      if (!dota2Data) {
        // Only migrate if we don't already have dota2Data
        dota2Data = cs2Data;
        cs2Data = undefined;
        // Update cache with correct structure
        playerData.dota2Data = dota2Data;
        playerData.faceitData = undefined;
        setCachedPlayer(playerName, playerData);
        saveCache(); // Save migrated structure
      } else {
        // We already have dota2Data, so this is duplicate - remove from faceitData
        logger.log(`VSCL Faceit Finder: Removing duplicate Dota2 data from faceitData for ${playerName}`);
        cs2Data = undefined;
        playerData.faceitData = undefined;
        setCachedPlayer(playerName, playerData);
        saveCache();
      }
    }
  }
  
  // Display CS2/Faceit card if available
  if (cs2Data) {
    logger.log(`VSCL Faceit Finder: Displaying CS2 card for ${playerName}`, cs2Data);
    const cs2Card = createGameCard('CS2', cs2Data);
    containerElement.appendChild(cs2Card);
  } else {
    logger.log(`VSCL Faceit Finder: No CS2 data to display for ${playerName}`);
  }
  
  // Display Dota2/Dotabuff card if available
  if (dota2Data) {
    logger.log(`VSCL Faceit Finder: Displaying Dota2 card for ${playerName}`, dota2Data);
    const dota2Card = createGameCard('Dota2', dota2Data);
    containerElement.appendChild(dota2Card);
  } else {
    logger.log(`VSCL Faceit Finder: No Dota2 data to display for ${playerName}`);
  }
  
  // If neither exists, show error
  if (!cs2Data && !dota2Data) {
    logger.log(`VSCL Faceit Finder: No game data found for ${playerName}, showing error`);
    displayErrorForProfile(containerElement, 'No profile found', true, playerName);
  }
}

function createGameCard(gameType: 'CS2' | 'Dota2', gameData: { elo: string; nickname: string; profileUrl: string }): HTMLElement {
  const isDota2 = gameType === 'Dota2';
  
  // Create completely independent card element
  const cardElement = document.createElement('div');
  cardElement.className = isDota2 ? 'faceit-profile-card faceit-profile-card-dota2' : 'faceit-profile-card';
  
  // Header - clearly labeled
  const headerElement = document.createElement('div');
  headerElement.className = 'faceit-profile-header';
  headerElement.textContent = isDota2 ? 'Dotabuff' : 'Faceit';
  cardElement.appendChild(headerElement);
  
  // Content area
  const contentElement = document.createElement('div');
  contentElement.className = 'faceit-profile-content';
  
  // ELO/Rank display - use gameData.elo (should match the gameType)
  const eloWrapper = document.createElement('div');
  eloWrapper.className = 'faceit-profile-elo-wrapper';
  
  const eloLabel = document.createElement('span');
  eloLabel.className = 'faceit-profile-elo-label';
  eloLabel.textContent = isDota2 ? 'Rank:' : 'ELO:';
  
  const eloValue = document.createElement('span');
  eloValue.className = 'faceit-profile-elo-value';
  eloValue.textContent = gameData.elo; // Use the elo from gameData
  
  eloWrapper.appendChild(eloLabel);
  eloWrapper.appendChild(eloValue);
  contentElement.appendChild(eloWrapper);
  
  // Nickname display - use gameData.nickname (should match the gameType)
  const nicknameWrapper = document.createElement('div');
  nicknameWrapper.className = 'faceit-profile-nickname-wrapper';
  
  const nicknameLabel = document.createElement('span');
  nicknameLabel.className = 'faceit-profile-nickname-label';
  nicknameLabel.textContent = 'Nickname:';
  
  const nicknameValue = document.createElement('span');
  nicknameValue.className = 'faceit-profile-nickname-value';
  nicknameValue.textContent = gameData.nickname; // Use the nickname from gameData
  
  nicknameWrapper.appendChild(nicknameLabel);
  nicknameWrapper.appendChild(nicknameValue);
  contentElement.appendChild(nicknameWrapper);
  
  cardElement.appendChild(contentElement);
  
  // Links - ensure they match the gameType
  const linksWrapper = document.createElement('div');
  linksWrapper.className = 'faceit-profile-links';
  
  if (isDota2) {
    // Dota2 card: only Dotabuff link
    const statsLinkElement = document.createElement('a');
    statsLinkElement.className = 'faceit-profile-stats-link faceit-profile-stats-link-dota2';
    statsLinkElement.textContent = 'View Stats';
    statsLinkElement.href = `https://dotabuff.com/players/${gameData.nickname}`;
    statsLinkElement.target = '_blank';
    statsLinkElement.title = 'View stats on Dotabuff';
    linksWrapper.appendChild(statsLinkElement);
  } else {
    // CS2 card: Faceit Finder stats link + Faceit profile link
    const statsLinkElement = document.createElement('a');
    statsLinkElement.className = 'faceit-profile-stats-link';
    statsLinkElement.textContent = 'View Stats';
    statsLinkElement.href = `https://faceitanalyser.com/stats/${gameData.nickname}`;
    statsLinkElement.target = '_blank';
    statsLinkElement.title = 'View stats on Faceit Finder';
    linksWrapper.appendChild(statsLinkElement);
    
    const profileLinkElement = document.createElement('a');
    profileLinkElement.className = 'faceit-profile-stats-link faceit-profile-faceit-link';
    profileLinkElement.textContent = 'View on Faceit';
    profileLinkElement.href = `https://www.faceit.com/en/players/${gameData.nickname}`;
    profileLinkElement.target = '_blank';
    profileLinkElement.title = 'View profile on Faceit (fallback when Faceit Finder is unavailable)';
    linksWrapper.appendChild(profileLinkElement);
  }
  
  cardElement.appendChild(linksWrapper);
  
  return cardElement;
}

export async function processPlayerElement(
  playerElement: HTMLElement, 
  isPlayerPage: boolean,
  currentGame: string | undefined
): Promise<void> {
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
    logger.log('VSCL Faceit Finder: No profile link found for element');
    return;
  }
  
  const playerName = profileLink.textContent?.trim() || 'Unknown';
  const profileUrl = profileLink.href;
  
  logger.log(`VSCL Faceit Finder: Processing player ${playerName} at ${profileUrl}`);
  
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
  loadingElement.textContent = currentGame === 'Dota2' ? 'Loading Dotabuff data...' : 'Loading Faceit data...';
  
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
  
  const cachedPlayer = getCachedPlayer(playerName);
  if (cachedPlayer) {
    logger.log(`VSCL Faceit Finder: Cache hit for ${playerName} - using cached data`);
    loadingElement.remove();
    if (cachedPlayer.faceitData) {
      displayFaceitData(playerElement, cachedPlayer);
    } else {
      displayError(playerElement, 'No Faceit profile found', true);
    }
    return;
  }
  
  logger.log(`VSCL Faceit Finder: Cache miss for ${playerName} - fetching new data`);
  
  try {
    const steamProfileUrl = await getSteamProfileUrl(profileUrl);
    if (!steamProfileUrl) {
      loadingElement.remove();
      displayError(playerElement, 'No Steam profile found', true);
      return;
    }
    
    logger.log(`VSCL Faceit Finder: Found Steam URL ${steamProfileUrl} for ${playerName}`);
    
    await delay(500);
    
    getFaceitData(steamProfileUrl, currentGame)
      .then(async (faceitData) => {
        loadingElement.remove();
        
        if (!faceitData.success) {
          logger.log(`VSCL Faceit Finder: Error for ${playerName}:`, faceitData.error);
          displayError(playerElement, faceitData.error || 'No Faceit profile found', true);
          return;
        }
        
        if (!faceitData.faceitNickname || !faceitData.elo || !faceitData.profileUrl) {
          logger.log(`VSCL Faceit Finder: Missing Faceit data for ${playerName}`);
          displayError(playerElement, currentGame === 'Dota2' ? 'No Dotabuff profile found' : 'No Faceit profile found', true);
          return;
        }
        
        logger.log(`VSCL Faceit Finder: Found Faceit data for ${playerName}:`, faceitData);
        
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
        
        setCachedPlayer(playerName, playerData);
        logger.log(`VSCL Faceit Finder: Added ${playerName} to cache with Faceit data. Total cached players: ${Object.keys(getAllCachedPlayers()).length}`);
        
        await saveCache();
        displayFaceitData(playerElement, playerData);
      })
      .catch((error) => {
        loadingElement.remove();
        // Don't log expected errors - just show user-friendly message
        displayError(playerElement, currentGame === 'Dota2' ? 'No Dotabuff profile found' : 'No Faceit profile found', true);
      });
  } catch (error) {
    loadingElement.remove();
    // Don't log expected errors - just show user-friendly message
    displayError(playerElement, 'Error fetching Steam profile', true);
  }
}
