/**
 * Player Processor - handles processing of individual players
 */

import { PlayerData, FaceitResponse } from './types';
import { logger } from './logger';
import { getCachedPlayer, setCachedPlayer, saveCache, getAllCachedPlayers } from './cache-manager';
import { getSteamProfileUrl } from './steam-fetcher';
import { displayFaceitData, displayError, displayFaceitDataForProfile, displayErrorForProfile } from './ui-renderer';

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
  loadingText.textContent = 'Loading Faceit data...';
  loadingCard.appendChild(loadingText);
  
  containerElement.appendChild(loadingCard);
  
  await delay(500);
  
  const cachedPlayer = getCachedPlayer(playerName);
  if (cachedPlayer) {
    logger.log(`VSCL Faceit Finder: Cache hit for ${playerName} - using cached data`);
    containerElement.innerHTML = '';
    if (cachedPlayer.faceitData) {
      displayFaceitDataForProfile(containerElement, cachedPlayer);
    } else {
      displayErrorForProfile(containerElement, 'No Faceit profile found', true, playerName);
    }
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
    
    getFaceitData(steamProfileUrl, currentGame)
      .then(async (faceitData) => {
        containerElement.innerHTML = '';
        
        if (!faceitData.success) {
          logger.log(`VSCL Faceit Finder: Error for ${playerName}:`, faceitData.error);
          displayErrorForProfile(containerElement, faceitData.error || 'No Faceit profile found', true, playerName);
          return;
        }
        
        if (!faceitData.faceitNickname || !faceitData.elo || !faceitData.profileUrl) {
          logger.log(`VSCL Faceit Finder: Missing Faceit data for ${playerName}`);
          displayErrorForProfile(containerElement, 'No Faceit profile found', true, playerName);
          return;
        }
        
        logger.log(`VSCL Faceit Finder: Found Faceit data for ${playerName}:`, faceitData);
        
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
        
        setCachedPlayer(playerName, playerData);
        logger.log(`VSCL Faceit Finder: Added ${playerName} to cache with Faceit data. Total cached players: ${Object.keys(getCachedPlayer(playerName) ? {} : {}).length}`);
        
        await saveCache();
        displayFaceitDataForProfile(containerElement, playerData);
      })
      .catch((error) => {
        containerElement.innerHTML = '';
        // Don't log expected errors - just show user-friendly message
        displayErrorForProfile(containerElement, 'No Faceit profile found', true, playerName);
      });
  } catch (error) {
    containerElement.innerHTML = '';
    // Don't log expected errors - just show user-friendly message
    displayErrorForProfile(containerElement, 'Error fetching Steam profile', true, playerName);
  }
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
          displayError(playerElement, 'No Faceit profile found', true);
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
        displayError(playerElement, 'No Faceit profile found', true);
      });
  } catch (error) {
    loadingElement.remove();
    // Don't log expected errors - just show user-friendly message
    displayError(playerElement, 'Error fetching Steam profile', true);
  }
}
