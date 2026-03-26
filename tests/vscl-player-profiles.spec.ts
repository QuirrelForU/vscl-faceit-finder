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
    headless: false, // extension APIs require headed Chromium
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const page = await context.newPage();
  return { context, page };
}

async function gotoPlayer(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.faceit-profile-container')).toBeVisible();
  await expect
    .poll(async () => page.locator('.faceit-profile-container .faceit-profile-card').count(), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
}

function cardByHeader(page: Page, headerText: 'Faceit' | 'Dotabuff') {
  return page.locator('.faceit-profile-card', {
    has: page.locator('.faceit-profile-header', { hasText: headerText }),
  });
}

test.describe('VSCL player profile cards', () => {
  test('kayvan: Faceit card only, with ELO/nickname and 2 buttons', async () => {
    const { context, page } = await launchWithExtension();
    try {
      await gotoPlayer(page, 'https://www.vscl.ru/player/59/kayvan');

      const faceitCard = cardByHeader(page, 'Faceit');
      const dotabuffCard = cardByHeader(page, 'Dotabuff');

      await expect(faceitCard).toHaveCount(1);
      await expect(dotabuffCard).toHaveCount(0);

      await expect(faceitCard.locator('.faceit-profile-elo-label')).toHaveText('ELO:');
      await expect(faceitCard.locator('.faceit-profile-nickname-label')).toHaveText('Nickname:');

      await expect(faceitCard.getByRole('link', { name: 'View Stats' })).toBeVisible();
      await expect(faceitCard.getByRole('link', { name: 'View on Faceit' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('eruve: Faceit + Dotabuff cards, each with correct labels/links', async () => {
    const { context, page } = await launchWithExtension();
    try {
      await gotoPlayer(page, 'https://www.vscl.ru/player/1397/eruve');

      const faceitCard = cardByHeader(page, 'Faceit');
      const dotabuffCard = cardByHeader(page, 'Dotabuff');

      await expect(faceitCard).toHaveCount(1);
      await expect(dotabuffCard).toHaveCount(1);

      await expect(faceitCard.locator('.faceit-profile-elo-label')).toHaveText('ELO:');
      await expect(faceitCard.getByRole('link', { name: 'View Stats' })).toBeVisible();
      await expect(faceitCard.getByRole('link', { name: 'View on Faceit' })).toBeVisible();

      await expect(dotabuffCard.locator('.faceit-profile-elo-label')).toHaveText('Rank:');
      await expect(dotabuffCard.getByRole('link', { name: 'View Stats' })).toBeVisible();
      await expect(dotabuffCard.getByRole('link', { name: 'View on Faceit' })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('leonodz: Dotabuff card only, with Rank/nickname and View Stats', async () => {
    const { context, page } = await launchWithExtension();
    try {
      await gotoPlayer(page, 'https://www.vscl.ru/player/13245/leonodz');

      const faceitCard = cardByHeader(page, 'Faceit');
      const dotabuffCard = cardByHeader(page, 'Dotabuff');

      await expect(faceitCard).toHaveCount(0);
      await expect(dotabuffCard).toHaveCount(1);

      await expect(dotabuffCard.locator('.faceit-profile-elo-label')).toHaveText('Rank:');
      await expect(dotabuffCard.locator('.faceit-profile-nickname-label')).toHaveText('Nickname:');
      await expect(dotabuffCard.getByRole('link', { name: 'View Stats' })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

