/**
 * e2e/navigation.spec.js
 *
 * Tests for the shared site header, navigation links, dark mode toggle,
 * and localStorage persistence across page loads.
 */

import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/', title: 'NeuroEdTools' },
  { path: '/hh.html', title: 'Hodgkin-Huxley' },
  { path: '/channel.html', title: 'Stochastic Channel' },
  { path: '/channelzoo.html', title: 'Zoo of Ion Channels' },
  { path: '/fhn.html', title: 'FitzHugh-Nagumo' },
  { path: '/izhikevich.html', title: 'Izhikevich' },
];

test.describe('Site header — presence and structure', () => {
  test('header is rendered on every page', async ({ page }) => {
    for (const { path } of PAGES) {
      await page.goto(path);
      await expect(page.locator('#site-header')).toBeVisible();
    }
  });

  test('site logo link is visible and points to index', async ({ page }) => {
    await page.goto('/hh.html');
    const logo = page.locator('#site-header .site-logo');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('href', 'index.html');
  });

  test('all 5 tool nav links are present in the header', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('#site-header nav');
    await expect(nav.locator('a[href="hh.html"]')).toBeVisible();
    await expect(nav.locator('a[href="channel.html"]')).toBeVisible();
    await expect(nav.locator('a[href="channelzoo.html"]')).toBeVisible();
    await expect(nav.locator('a[href="fhn.html"]')).toBeVisible();
    await expect(nav.locator('a[href="izhikevich.html"]')).toBeVisible();
  });

  test('active nav link is marked on hh.html', async ({ page }) => {
    await page.goto('/hh.html');
    const activeLink = page.locator('#site-header nav a.active');
    await expect(activeLink).toHaveCount(1);
    await expect(activeLink).toHaveAttribute('href', 'hh.html');
  });

  test('theme toggle button is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#theme-toggle')).toBeVisible();
  });

  test('no raw Liquid template tags on any page', async ({ page }) => {
    for (const { path } of PAGES) {
      await page.goto(path);
      const bodyText = await page.locator('body').innerText();
      expect(bodyText, `Liquid tag found on ${path}`).not.toContain('{%');
      expect(bodyText, `Liquid tag found on ${path}`).not.toContain('{{');
    }
  });

  test('no JavaScript console errors on any page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    for (const { path } of PAGES) {
      errors.length = 0;
      await page.goto(path);
      await page.waitForTimeout(500);
      expect(errors, `JS errors on ${path}: ${errors.join(', ')}`).toHaveLength(0);
    }
  });
});

test.describe('Dark mode toggle', () => {
  test('starts in light mode by default (fresh context)', async ({ page, context }) => {
    // Clear storage to ensure fresh state
    await context.clearCookies();
    await page.goto('/');
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).not.toBe('dark');
  });

  test('clicking toggle applies dark theme', async ({ page }) => {
    await page.goto('/');
    await page.locator('#theme-toggle').click();
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('dark');
  });

  test('clicking toggle twice returns to light theme', async ({ page }) => {
    await page.goto('/');
    await page.locator('#theme-toggle').click();
    await page.locator('#theme-toggle').click();
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).not.toBe('dark');
  });

  test('dark mode preference persists across page navigation via localStorage', async ({ page }) => {
    await page.goto('/');
    // Enable dark mode
    await page.locator('#theme-toggle').click();
    // Navigate to another page
    await page.goto('/hh.html');
    await page.waitForTimeout(300);
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('dark');
  });

  test('button label updates to reflect current mode', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#theme-toggle');
    const initialText = await btn.innerText();
    await btn.click();
    const darkText = await btn.innerText();
    expect(darkText).not.toBe(initialText);
  });
});

test.describe('Navigation — clicking nav links', () => {
  test('logo link navigates to index page', async ({ page }) => {
    await page.goto('/hh.html');
    await page.locator('#site-header .site-logo').click();
    await expect(page).toHaveURL(/index\.html|\/$/);
  });

  test('each nav link navigates to the correct page', async ({ page }) => {
    const links = [
      { href: 'hh.html', titleContains: 'Hodgkin-Huxley' },
      { href: 'channel.html', titleContains: 'Stochastic Channel' },
      { href: 'channelzoo.html', titleContains: 'Zoo of Ion Channels' },
      { href: 'fhn.html', titleContains: 'FitzHugh-Nagumo' },
      { href: 'izhikevich.html', titleContains: 'Izhikevich' },
    ];
    for (const { href, titleContains } of links) {
      await page.goto('/');
      await page.locator(`#site-header nav a[href="${href}"]`).click();
      await expect(page).toHaveTitle(new RegExp(titleContains, 'i'));
    }
  });
});

test.describe('Index page — tool cards', () => {
  test('all 5 tool cards are visible', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.tool-card');
    await expect(cards).toHaveCount(5);
  });

  test('tool cards are clickable links', async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('.tool-card').first();
    await expect(firstCard).toHaveAttribute('href');
  });

  test('clicking a card navigates to the corresponding tool', async ({ page }) => {
    await page.goto('/');
    const hhCard = page.locator('.tool-card[href="hh.html"]');
    await hhCard.click();
    await expect(page).toHaveTitle(/Hodgkin-Huxley/i);
  });
});
