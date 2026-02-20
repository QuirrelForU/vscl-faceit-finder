/**
 * UI Renderer for displaying Faceit data
 */

import { PlayerData } from './types';
import { logger } from './logger';

let currentGame: string | undefined = '';

export function setCurrentGame(game: string | undefined): void {
  currentGame = game;
}

export function displayFaceitData(playerElement: HTMLElement, playerData: PlayerData): void {
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

  const existingProfileLink = playerElement.querySelector('.faceit-profile-link');
  if (existingProfileLink) {
    existingProfileLink.remove();
  }
  
  const eloElement = document.createElement('span');
  eloElement.className = currentGame === 'Dota2' ? 'faceit-elo faceit-elo-dota2' : 'faceit-elo';
  eloElement.textContent = `${playerData.faceitData.elo} ${currentGame === 'Dota2' ? '': 'ELO'}`;
  container.appendChild(eloElement);
  
  const hrefLink = currentGame === 'Dota2' ? 'dotabuff.com/players' : 'faceitanalyser.com/stats';
  const statsLinkElement = document.createElement('a');
  statsLinkElement.className = currentGame === 'Dota2' ? 'faceit-link faceit-link-dota2' : 'faceit-link';
  statsLinkElement.textContent = 'Stats';
  statsLinkElement.href = `https://${hrefLink}/${playerData.faceitData.nickname}`;
  statsLinkElement.target = '_blank';
  statsLinkElement.title = currentGame === 'Dota2' ? 'View stats on Dotabuff' : 'View stats on Faceit Finder';
  container.appendChild(statsLinkElement);

  // Fallback: link to user profile on faceit.com when Faceit Finder is unavailable
  if (currentGame !== 'Dota2') {
    const profileLinkElement = document.createElement('a');
    profileLinkElement.className = 'faceit-link faceit-profile-link';
    profileLinkElement.textContent = 'Profile';
    profileLinkElement.href = `https://www.faceit.com/en/players/${playerData.faceitData.nickname}`;
    profileLinkElement.target = '_blank';
    profileLinkElement.title = 'View profile on Faceit';
    container.appendChild(profileLinkElement);
  }
}

export function displayError(playerElement: HTMLElement, errorMessage: string, showRetry: boolean = false): void {
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
    if (currentGame === 'Dota2') {
      const dotabuffLink = document.createElement('a');
      dotabuffLink.className = 'faceit-link faceit-link-dota2';
      dotabuffLink.textContent = 'Dotabuff';
      dotabuffLink.href = `https://www.dotabuff.com/search?q=${encodeURIComponent(playerName)}`;
      dotabuffLink.target = '_blank';
      dotabuffLink.title = 'Search on Dotabuff';
      container.appendChild(dotabuffLink);
    } else {
      const searchLink = document.createElement('a');
      searchLink.className = 'faceit-link';
      searchLink.textContent = 'Search';
      searchLink.href = `https://faceitanalyser.com/finder?q=${encodeURIComponent(playerName)}`;
      searchLink.target = '_blank';
      searchLink.title = 'Search manually on Faceit Finder';
      container.appendChild(searchLink);

      const faceitSearchLink = document.createElement('a');
      faceitSearchLink.className = 'faceit-link';
      faceitSearchLink.textContent = 'Faceit';
      faceitSearchLink.href = `https://www.faceit.com/en/search?q=${encodeURIComponent(playerName)}`;
      faceitSearchLink.target = '_blank';
      faceitSearchLink.title = 'Search on Faceit (fallback when Faceit Finder is unavailable)';
      container.appendChild(faceitSearchLink);
    }
    
    if (showRetry) {
      const retryLink = document.createElement('a');
      retryLink.className = currentGame === 'Dota2' ? 'faceit-link faceit-link-dota2' : 'faceit-link';
      retryLink.textContent = 'Retry';
      retryLink.href = '#';
      retryLink.title = currentGame === 'Dota2' ? 'Retry fetching Dotabuff data' : 'Retry fetching Faceit data';
      const isPlayerPage = window.location.href.includes('/player/');
      retryLink.onclick = (e) => {
        e.preventDefault();
        // This will be handled by the caller
        const event = new CustomEvent('faceit-retry', { detail: { element: playerElement } });
        document.dispatchEvent(event);
      };
      container.appendChild(retryLink);
    }
  }
}

export function displayFaceitDataForProfile(containerElement: HTMLElement, playerData: PlayerData): void {
  if (!playerData.faceitData) {
    return;
  }
  
  // Clear existing content
  containerElement.innerHTML = '';
  
  // Create a card-like container (add dota2 modifier for red theme)
  const cardElement = document.createElement('div');
  cardElement.className = currentGame === 'Dota2' ? 'faceit-profile-card faceit-profile-card-dota2' : 'faceit-profile-card';
  
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
  
  // Stats link (Faceit Finder) and fallback link to Faceit profile
  const linksWrapper = document.createElement('div');
  linksWrapper.className = 'faceit-profile-links';
  const hrefLink = currentGame === 'Dota2' ? 'dotabuff.com/players' : 'faceitanalyser.com/stats';
  const statsLinkElement = document.createElement('a');
  statsLinkElement.className = currentGame === 'Dota2' ? 'faceit-profile-stats-link faceit-profile-stats-link-dota2' : 'faceit-profile-stats-link';
  statsLinkElement.textContent = 'View Stats';
  statsLinkElement.href = `https://${hrefLink}/${playerData.faceitData.nickname}`;
  statsLinkElement.target = '_blank';
  statsLinkElement.title = currentGame === 'Dota2' ? 'View stats on Dotabuff' : 'View stats on Faceit Finder';
  linksWrapper.appendChild(statsLinkElement);

  if (currentGame !== 'Dota2') {
    const profileLinkElement = document.createElement('a');
    profileLinkElement.className = 'faceit-profile-stats-link faceit-profile-faceit-link';
    profileLinkElement.textContent = 'View on Faceit';
    profileLinkElement.href = `https://www.faceit.com/en/players/${playerData.faceitData.nickname}`;
    profileLinkElement.target = '_blank';
    profileLinkElement.title = 'View profile on Faceit (fallback when Faceit Finder is unavailable)';
    linksWrapper.appendChild(profileLinkElement);
  }
  cardElement.appendChild(linksWrapper);
  
  containerElement.appendChild(cardElement);
}

export function displayErrorForProfile(containerElement: HTMLElement, errorMessage: string, showRetry: boolean, playerName: string): void {
  // Clear existing content
  containerElement.innerHTML = '';
  
  // Create error card (add dota2 modifier for red theme when applicable)
  const cardElement = document.createElement('div');
  cardElement.className = currentGame === 'Dota2' ? 'faceit-profile-card faceit-profile-card-error faceit-profile-card-dota2' : 'faceit-profile-card faceit-profile-card-error';
  
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
    if (currentGame === 'Dota2') {
      const dotabuffLink = document.createElement('a');
      dotabuffLink.className = 'faceit-profile-action-link faceit-profile-action-link-dota2';
      dotabuffLink.textContent = 'Dotabuff';
      dotabuffLink.href = `https://www.dotabuff.com/search?q=${encodeURIComponent(playerName)}`;
      dotabuffLink.target = '_blank';
      dotabuffLink.title = 'Search on Dotabuff';
      actionsElement.appendChild(dotabuffLink);
    } else {
      const searchLink = document.createElement('a');
      searchLink.className = 'faceit-profile-action-link';
      searchLink.textContent = 'Search';
      searchLink.href = `https://faceitanalyser.com/finder?q=${encodeURIComponent(playerName)}`;
      searchLink.target = '_blank';
      searchLink.title = 'Search manually on Faceit Finder';
      actionsElement.appendChild(searchLink);

      const faceitSearchLink = document.createElement('a');
      faceitSearchLink.className = 'faceit-profile-action-link';
      faceitSearchLink.textContent = 'Faceit';
      faceitSearchLink.href = `https://www.faceit.com/en/search?q=${encodeURIComponent(playerName)}`;
      faceitSearchLink.target = '_blank';
      faceitSearchLink.title = 'Search on Faceit (fallback when Faceit Finder is unavailable)';
      actionsElement.appendChild(faceitSearchLink);
    }
    
    if (showRetry) {
      const retryLink = document.createElement('a');
      retryLink.className = 'faceit-profile-action-link';
      retryLink.textContent = 'Retry';
      retryLink.href = '#';
      retryLink.title = currentGame === 'Dota2' ? 'Retry fetching Dotabuff data' : 'Retry fetching Faceit data';
      retryLink.onclick = (e) => {
        e.preventDefault();
        const event = new CustomEvent('faceit-retry-profile', { detail: { playerName, containerElement } });
        document.dispatchEvent(event);
      };
      actionsElement.appendChild(retryLink);
    }
  }
  
  cardElement.appendChild(actionsElement);
  containerElement.appendChild(cardElement);
}
