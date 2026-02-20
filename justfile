# VSCL Faceit Finder - Build Commands

# Install dependencies
install:
    npm install

# Build the extension
build:
    npm run build

# Build and create zip package (cross-platform: Node script uses PowerShell on Windows, zip on Unix)
package:
    just build
    @echo "Creating zip package..."
    node scripts/create-zip.js

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
