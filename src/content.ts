/**
 * VSCL Faceit Finder Content Script
 */

import { logger } from './utils/logger';
import { loadCache } from './utils/cache-manager';
import { processPlayerElement, processPlayerElementForProfile } from './utils/player-processor';
import { setCurrentGame } from './utils/ui-renderer';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCurrentGame(): string | undefined {
  const game = document.querySelector('div.discipline')?.textContent?.toString().trim();
  return game;
}

async function initVsclFaceitFinder() {
  const isMatchPage = window.location.href.includes('/tournaments/') || window.location.href.includes('/matches/');
  const isPlayerPage = window.location.href.includes('/player/');
  
  if (!isMatchPage && !isPlayerPage) {
    return;
  }
  
  logger.log('VSCL Faceit Finder: Initializing...');
  logger.log('VSCL Faceit Finder: Using VSCL nickname-based caching system');
  logger.log(`VSCL Faceit Finder: Page type: ${isPlayerPage ? 'Player' : 'Match'}`);
  
  await loadCache();
  const { getAllCachedPlayers } = await import('./utils/cache-manager');
  const cachedPlayers = getAllCachedPlayers();
  logger.log('VSCL Faceit Finder: Currently cached players:', Object.keys(cachedPlayers));
  
  const currentGame = getCurrentGame();
  setCurrentGame(currentGame);
  logger.log(`VSCL Faceit Finder: Found game ${currentGame}`);

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
      
      await processPlayerElementForProfile(mainPlayerName, currentProfileUrl, containerElement, currentGame);
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
    logger.log(`VSCL Faceit Finder: Found ${playerElements.length} player links on profile page (filtered from ${allPlayerLinks.length} total links)`);
  } else {
    // For match pages, use existing selectors
    playerElements = document.querySelectorAll('.media.my-4');
    if (playerElements.length === 0) {
      playerElements = document.querySelectorAll('.name.mb-1');
    }
  }
  
  logger.log(`VSCL Faceit Finder: Found ${playerElements.length} player elements`);
  
  const playerElementsArray = Array.from(playerElements);
  
  for (let i = 0; i < playerElementsArray.length; i += 2) {
    const batch = playerElementsArray.slice(i, i + 2);
    
    for (const playerElement of batch) {
      processPlayerElement(playerElement as HTMLElement, isPlayerPage, currentGame);
    }
    
    if (i + 2 < playerElementsArray.length) {
      await delay(1000);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initVsclFaceitFinder, 1000);
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(initVsclFaceitFinder, 1500);
}
