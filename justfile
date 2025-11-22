# VSCL Faceit Finder - Build Commands

# Install dependencies
install:
    npm install

# Build the extension
build:
    npm run build

# Build and create zip package
package:
    just build
    @echo "Creating zip package..."
    sh -c 'VERSION=$(node -p "require(\"./package.json\").version"); if command -v zip >/dev/null 2>&1; then cd dist && zip -r ../vscl-faceit-finder-${VERSION}.zip * && cd ..; elif command -v powershell.exe >/dev/null 2>&1; then powershell.exe -Command "Compress-Archive -Path dist\\* -DestinationPath vscl-faceit-finder-${VERSION}.zip -Force"; else echo "Error: Neither zip nor powershell.exe found"; exit 1; fi'

# Clean build artifacts
clean:
    @echo "Cleaning build artifacts..."
    rm -rf dist
    rm -f vscl-faceit-finder-*.zip

# Watch mode for development
watch:
    npm run watch

# Full rebuild: clean, install, build, package
rebuild:
    just clean
    just install
    just package

# Default recipe
default:
    just build
