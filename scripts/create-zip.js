#!/usr/bin/env node
/**
 * Cross-platform script to zip the dist/ folder into vscl-faceit-finder-<version>.zip.
 * Works in PowerShell, cmd, and Git Bash on Windows without relying on sh or zip in PATH.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const pkgPath = path.join(root, 'package.json');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist/ folder not found. Run "npm run build" first.');
  process.exit(1);
}

const version = require(pkgPath).version;
const zipName = `vscl-faceit-finder-${version}.zip`;
const zipPath = path.join(root, zipName);

if (process.platform === 'win32') {
  // PowerShell: run from project root with relative paths to avoid quoting issues
  const psCmd = `Set-Location -LiteralPath '${root.replace(/'/g, "''")}'; Compress-Archive -Path 'dist\\*' -DestinationPath '${zipName.replace(/'/g, "''")}' -Force`;
  execSync(`powershell.exe -NoProfile -Command "& { ${psCmd} }"`, {
    cwd: root,
    stdio: 'inherit',
  });
} else {
  // Unix: use zip if available
  try {
    execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  } catch (e) {
    console.error('Error: zip command failed. Install zip or run on Windows for PowerShell fallback.');
    process.exit(1);
  }
}

console.log('Created:', zipName);
