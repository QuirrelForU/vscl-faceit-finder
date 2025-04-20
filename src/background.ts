// This script handles the background processes for the extension
// It will track redirections from FaceitAnalyser

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getFaceitProfile') {
    const { steamUrl } = message;
    
    console.log('Fetching Faceit profile for Steam URL:', steamUrl);
    
    // Step 1: Request to the finder with our steam URL
    fetch(`https://faceitanalyser.com/player?id=${encodeURIComponent(steamUrl)}`)
      .then(response => {
        console.log('Response status:', response.status);
        
        // For direct fetch we need to follow redirects automatically
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return response.text();
      })
      .then(html => {
        // Extract the Faceit nickname from the page content
        // First check if we're already on the stats page
        const statsMatch = html.match(/<title>Stats\s+for\s+([^\s|/]+)/i);
        
        if (statsMatch && statsMatch[1]) {
          const faceitNickname = statsMatch[1];
          console.log('Found Faceit nickname from stats page:', faceitNickname);
          
          // Extract ELO from the HTML
          const eloMatch = html.match(/(\d+)\s+ELO/);
          const elo = eloMatch ? eloMatch[1] : 'Unknown';
          
          sendResponse({
            success: true,
            faceitNickname,
            elo,
            profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}/cs2`
          });
          return;
        }
        
        // If we're not on the stats page, look for redirect URLs in the content
        // Check for meta refresh redirects
        const metaRefreshMatch = html.match(/<meta\s+http-equiv="refresh"\s+content="0;\s*url=([^"]+)"/i);
        
        if (metaRefreshMatch && metaRefreshMatch[1]) {
          const redirectUrl = metaRefreshMatch[1];
          console.log('Found meta refresh redirect:', redirectUrl);
          
          // Extract the faceit nickname from the redirect URL
          const nicknameMatch = redirectUrl.match(/\/stats\/([^\/]+)/);
          
          if (nicknameMatch && nicknameMatch[1]) {
            const faceitNickname = nicknameMatch[1];
            
            // Now fetch the actual stats page to get ELO
            fetch(`https://faceitanalyser.com/stats/${faceitNickname}/cs2`)
              .then(res => res.text())
              .then(statsHtml => {
                // Extract ELO from the HTML response
                const eloMatch = statsHtml.match(/(\d+)\s+ELO/);
                const elo = eloMatch ? eloMatch[1] : 'Unknown';
                
                console.log('Found Faceit profile with ELO:', elo);
                
                // Send the data back to content script
                sendResponse({
                  success: true,
                  faceitNickname,
                  elo,
                  profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}/cs2`
                });
              })
              .catch(error => {
                console.error('Error fetching stats page:', error);
                sendResponse({ success: false, error: 'Failed to fetch ELO data' });
              });
            
            return;
          }
        }
        
        // Check for client-side redirects in JavaScript
        const jsRedirectMatch = html.match(/window\.location\.(?:href|replace)\s*=\s*["']([^"']+)["']/);
        
        if (jsRedirectMatch && jsRedirectMatch[1]) {
          const redirectUrl = jsRedirectMatch[1];
          console.log('Found JavaScript redirect:', redirectUrl);
          
          // Extract the faceit nickname from the redirect URL
          const nicknameMatch = redirectUrl.match(/\/stats\/([^\/]+)/);
          
          if (nicknameMatch && nicknameMatch[1]) {
            const faceitNickname = nicknameMatch[1];
            
            // Now fetch the actual stats page to get ELO
            fetch(`https://faceitanalyser.com/stats/${faceitNickname}/cs2`)
              .then(res => res.text())
              .then(statsHtml => {
                // Extract ELO from the HTML response
                const eloMatch = statsHtml.match(/(\d+)\s+ELO/);
                const elo = eloMatch ? eloMatch[1] : 'Unknown';
                
                console.log('Found Faceit profile with ELO:', elo);
                
                // Send the data back to content script
                sendResponse({
                  success: true,
                  faceitNickname,
                  elo,
                  profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}/cs2`
                });
              })
              .catch(error => {
                console.error('Error fetching stats page:', error);
                sendResponse({ success: false, error: 'Failed to fetch ELO data' });
              });
            
            return;
          }
        }
        
        // If we can't find any redirects, try a direct approach with the Steam ID
        // Extract the Steam ID from the URL
        const steamIdMatch = steamUrl.match(/\d+/);
        if (steamIdMatch && steamIdMatch[0]) {
          const steamId = steamIdMatch[0];
          
          // Try to fetch profile directly using the Steam ID  
          fetch(`https://faceitanalyser.com/finder?q=${steamId}`)
            .then(res => res.text())
            .then(finderHtml => {
              // Look for any player links in the results
              const playerLinkMatch = finderHtml.match(/href="\/stats\/([^"\/]+)\/cs2"/);
              
              if (playerLinkMatch && playerLinkMatch[1]) {
                const faceitNickname = playerLinkMatch[1];
                
                // Now fetch the actual stats page to get ELO
                fetch(`https://faceitanalyser.com/stats/${faceitNickname}/cs2`)
                  .then(res => res.text())
                  .then(statsHtml => {
                    // Extract ELO from the HTML response
                    const eloMatch = statsHtml.match(/(\d+)\s+ELO/);
                    const elo = eloMatch ? eloMatch[1] : 'Unknown';
                    
                    console.log('Found Faceit profile with ELO:', elo);
                    
                    // Send the data back to content script
                    sendResponse({
                      success: true,
                      faceitNickname,
                      elo,
                      profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}/cs2`
                    });
                  })
                  .catch(error => {
                    console.error('Error fetching stats page:', error);
                    sendResponse({ success: false, error: 'Failed to fetch ELO data' });
                  });
                
                return;
              } else {
                sendResponse({ success: false, error: 'No Faceit profile found in finder results' });
              }
            })
            .catch(error => {
              console.error('Error using finder:', error);
              sendResponse({ success: false, error: 'Error using finder service' });
            });
          
          return;
        }
        
        // If all else fails, notify the user
        console.error('No Faceit profile or redirect found in response');
        sendResponse({ success: false, error: 'No Faceit profile found' });
      })
      .catch(error => {
        console.error('Error fetching Faceit profile:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we will respond asynchronously
    return true;
  }
}); 