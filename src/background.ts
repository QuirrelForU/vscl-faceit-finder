// This script handles the background processes for the extension
// It will track redirections from FaceitAnalyser

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getFaceitProfile') {
    const { steamUrl } = message;
    
    // Step 1: Request to the finder with our steam URL
    fetch(`https://faceitanalyser.com/player?id=${encodeURIComponent(steamUrl)}`, {
      method: 'GET',
      redirect: 'manual' // Don't automatically follow redirects
    }).then(response => {
      // If we get a redirect, extract the Location header
      if (response.status === 302 || response.status === 301) {
        const redirectUrl = response.headers.get('Location');
        if (redirectUrl) {
          // Parse the faceit nickname from the URL
          const match = redirectUrl.match(/\/stats\/([^\/]+)/);
          if (match && match[1]) {
            const faceitNickname = match[1];
            
            // Now fetch the actual stats page to get ELO
            fetch(`https://faceitanalyser.com/stats/${faceitNickname}/cs2`)
              .then(res => res.text())
              .then(html => {
                // Extract ELO from the HTML response
                const eloMatch = html.match(/(\d+)\s+ELO/);
                const elo = eloMatch ? eloMatch[1] : 'Unknown';
                
                // Send the data back to content script
                sendResponse({
                  success: true,
                  faceitNickname,
                  elo,
                  profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}/cs2`
                });
              })
              .catch(error => {
                sendResponse({ success: false, error: 'Failed to fetch ELO data' });
              });
          } else {
            sendResponse({ success: false, error: 'Failed to parse Faceit nickname' });
          }
        } else {
          sendResponse({ success: false, error: 'No redirect location found' });
        }
      } else if (response.status === 200) {
        // If we got a 200, the URL might directly point to the profile
        response.text().then(html => {
          const titleMatch = html.match(/<title>([^<]+)<\/title>/);
          if (titleMatch && titleMatch[1].includes('Stats')) {
            const nicknameMatch = titleMatch[1].match(/Stats\s+for\s+([^\s]+)/i);
            const faceitNickname = nicknameMatch ? nicknameMatch[1] : 'Unknown';
            
            // Extract ELO
            const eloMatch = html.match(/(\d+)\s+ELO/);
            const elo = eloMatch ? eloMatch[1] : 'Unknown';
            
            sendResponse({
              success: true,
              faceitNickname,
              elo,
              profileUrl: `https://faceitanalyser.com/stats/${faceitNickname}/cs2`
            });
          } else {
            sendResponse({ success: false, error: 'No Faceit profile found' });
          }
        });
      } else {
        sendResponse({ success: false, error: `Unexpected status: ${response.status}` });
      }
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    
    // Return true to indicate we will respond asynchronously
    return true;
  }
}); 