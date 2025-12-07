/**
 * Message Handler for Background Script
 */

import { logger } from '../utils/logger';
import { fetchFaceitProfile } from './faceit-api';
import { fetchDotabuffProfile } from './dotabuff-api';

export function setupMessageHandlers(): void {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getFaceitProfile') {
      const { steamUrl } = request;
      logger.log('Fetching Faceit profile for Steam URL:', steamUrl);
      
      (async () => {
        try {
          const response = await fetchFaceitProfile(steamUrl);
          logger.log('Sending response:', response);
          sendResponse(response);
        } catch (error) {
          // Don't log 429 errors - they're expected rate limiting
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (!errorMessage.includes('429') && !errorMessage.includes('Rate Limited')) {
            logger.error('Error in getFaceitProfile:', error);
          }
          sendResponse({ success: false, error: errorMessage });
        }
      })();
      
      return true;
    }
    
    if (request.action === 'getDotabuffProfile') {
      const { steamUrl } = request;
      logger.log('Fetching Dotabuff profile for Steam URL', steamUrl);

      (async () => {
        try {
          const response = await fetchDotabuffProfile(steamUrl);
          logger.log('Sending response:', response);
          sendResponse(response);
        }
        catch (error) {
          logger.error('Error in getDotabuffProfile:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
        }
      })()
      return true;
    }

    if (request.action === 'getCache') {
      try {
        chrome.storage.local.get('playerCache', (result) => {
          if (chrome.runtime.lastError) {
            logger.error('Error getting cache:', chrome.runtime.lastError);
            sendResponse({ cache: {} });
          } else {
            sendResponse({ cache: result.playerCache || {} });
          }
        });
      } catch (error) {
        logger.error('Error in getCache:', error);
        sendResponse({ cache: {} });
      }
      return true;
    }
    
    if (request.action === 'saveCache') {
      try {
        chrome.storage.local.set({ playerCache: request.cache }, () => {
          if (chrome.runtime.lastError) {
            logger.error('Error saving cache:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true });
          }
        });
      } catch (error) {
        logger.error('Error in saveCache:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
      return true;
    }

    if (request.action === 'clearCache') {
      try {
        chrome.storage.local.remove('playerCache', () => {
          if (chrome.runtime.lastError) {
            logger.error('Error clearing cache:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            logger.log('Cache cleared successfully');
            sendResponse({ success: true });
          }
        });
      } catch (error) {
        logger.error('Error in clearCache:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
      return true;
    }
  });
}
