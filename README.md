# VSCL Faceit Finder

Chrome extension to find Faceit accounts directly from VSCL.ru player profiles and match pages.

## Features

- Display Faceit ELO score next to player names on VSCL match pages
- Add direct links to Faceit Analyser profiles
- Fast profile lookups using Steam IDs

## Installation

### Development Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/vscl-faceit-finder.git
cd vscl-faceit-finder
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked" and select the `dist` folder from this project

### Production Installation

1. Build the extension:
```bash
npm run build
```

2. Zip the contents of the `dist` folder
3. Upload to the Chrome Web Store

## Development

- Run the build in watch mode during development:
```bash
npm run watch
```

- The extension will automatically rebuild when you make changes to the source files

## How It Works

1. The extension searches for player elements on VSCL.ru match pages
2. For each player, it fetches their VSCL profile to find their Steam ID
3. The Steam ID is used to query the Faceit Analyser API to find the corresponding Faceit profile
4. The extension shows the player's Faceit ELO and a link to their Faceit Analyser profile

## Requirements

- Node.js 14+
- npm 6+
- Chrome browser

## License

MIT
