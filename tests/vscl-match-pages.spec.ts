import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function launchWithExtension(): Promise<{ context: BrowserContext; page: Page }> {
  const extensionPath = path.resolve(__dirname, '..', 'dist');
  if (!fs.existsSync(extensionPath)) {
    throw new Error(`Extension build folder not found at: ${extensionPath}. Run "npm run build" first.`);
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscl-faceit-finder-pw-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const page = await context.newPage();
  return { context, page };
}

async function gotoMatch(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect
    .poll(async () => page.locator('.faceit-elo').count(), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
}

async function expectCs2MatchUi(page: Page): Promise<void> {
  const eloBadges = page.locator('.faceit-elo');
  const statsLinks = page.locator('a.faceit-link', { hasText: 'Stats' });
  const profileLinks = page.locator('a.faceit-link.faceit-profile-link', { hasText: 'Profile' });

  const eloCount = await eloBadges.count();
  const statsCount = await statsLinks.count();
  const profileCount = await profileLinks.count();

  expect(eloCount).toBeGreaterThan(0);
  expect(statsCount).toBeGreaterThan(0);
  expect(profileCount).toBeGreaterThan(0);

  // For CS2 we expect orange ELO badges (default theme).
  await expect(eloBadges.first()).toHaveCSS('background-color', 'rgb(246, 133, 31)');
}

async function expectDota2MatchUi(page: Page): Promise<void> {
  const rankBadges = page.locator('.faceit-elo.faceit-elo-dota2');
  const statsLinks = page.locator('a.faceit-link.faceit-link-dota2', { hasText: 'Stats' });
  const profileLinks = page.locator('a.faceit-link.faceit-profile-link', { hasText: 'Profile' });

  const rankCount = await rankBadges.count();
  const statsCount = await statsLinks.count();
  const profileCount = await profileLinks.count();

  expect(rankCount).toBeGreaterThan(0);
  expect(statsCount).toBeGreaterThan(0);
  expect(profileCount).toBe(0);

  // For Dota2 we expect red badges and links.
  await expect(rankBadges.first()).toHaveCSS('background-color', 'rgb(198, 35, 43)');
  await expect(statsLinks.first()).toHaveCSS('background-color', 'rgb(139, 26, 32)');
}

test.describe('VSCL match pages', () => {
  test('CS2 5v5 match: shows ELO + Stats/Profile with orange color', async () => {
    const { context, page } = await launchWithExtension();
    try {
      await gotoMatch(page, 'https://www.vscl.ru/tournaments/2085/matches/95283');
      await expectCs2MatchUi(page);
    } finally {
      await context.close();
    }
  });

  test('Dota2 5v5 match: shows Rank + Stats with red color', async () => {
    const { context, page } = await launchWithExtension();
    try {
      await gotoMatch(page, 'https://www.vscl.ru/tournaments/2177/matches/98312');
      await expectDota2MatchUi(page);
    } finally {
      await context.close();
    }
  });

  test('CS2 1v1 match: shows ELO + Stats/Profile with orange color', async () => {
    const { context, page } = await launchWithExtension();
    try {
      await gotoMatch(page, 'https://www.vscl.ru/tournaments/1977/matches/92820');
      await expectCs2MatchUi(page);
    } finally {
      await context.close();
    }
  });

  test('Dota2 1v1 match: shows Rank + Stats with red color', async () => {
    const { context, page } = await launchWithExtension();
    try {
      await gotoMatch(page, 'https://www.vscl.ru/tournaments/2011/matches/97723');
      await expectDota2MatchUi(page);
    } finally {
      await context.close();
    }
  });
});

