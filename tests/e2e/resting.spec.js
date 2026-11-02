/**
 * e2e/resting.spec.js
 *
 * End-to-end tests for the Resting Membrane Potential page (resting.html).
 */

import { test, expect } from '@playwright/test';

async function canvasHasContent(page, canvasId) {
  return page.evaluate((id) => {
    const canvas = document.getElementById(id);
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) return true;
    }
    return false;
  }, canvasId);
}

async function setSlider(page, id, value) {
  await page.evaluate(({ id, value }) => {
    const el = document.getElementById(id);
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, value });
}

const mV = text => parseFloat(text.replace('−', '-'));

test.beforeEach(async ({ page }) => {
  await page.goto('/resting.html');
});

test.describe('Resting page — layout', () => {
  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle(/Resting Membrane Potential/i);
  });

  test('controls are present', async ({ page }) => {
    for (const id of ['ion', 'c_in', 'c_out', 'temp', 'play', 'reset']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  test('scene and plots are drawn', async ({ page }) => {
    await page.waitForTimeout(300);
    for (const id of ['scene', 'plot-v', 'plot-flux']) {
      expect(await canvasHasContent(page, id), id).toBe(true);
    }
  });

  test('no JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.reload();
    await page.waitForTimeout(800);
    expect(errors).toHaveLength(0);
  });
});

test.describe('Resting page — Nernst potential', () => {
  test('E_K is about −89 mV with default K⁺ concentrations', async ({ page }) => {
    expect(mV(await page.locator('#readout-e').innerText())).toBeCloseTo(-89.1, 0);
  });

  test('switching to Na⁺ gives a positive Nernst potential and relabels', async ({ page }) => {
    await page.selectOption('#ion', 'Na');
    expect(mV(await page.locator('#readout-e').innerText())).toBeCloseTo(66.6, 0);
    await expect(page.locator('label[for="c_in"]')).toContainText('Na⁺');
  });

  test('equal concentrations give E = 0', async ({ page }) => {
    await setSlider(page, 'c_in', 1.5);
    await setSlider(page, 'c_out', 1.5);
    expect(mV(await page.locator('#readout-e').innerText())).toBeCloseTo(0, 1);
  });

  test('temperature changes E', async ({ page }) => {
    const before = mV(await page.locator('#readout-e').innerText());
    await setSlider(page, 'temp', 0);
    await expect(page.locator('#temp-value')).toHaveText('0');
    const after = mV(await page.locator('#readout-e').innerText());
    expect(Math.abs(after)).toBeLessThan(Math.abs(before));
  });
});

test.describe('Resting page — simulation', () => {
  test('V moves from 0 towards E_K while running', async ({ page }) => {
    await page.locator('#reset').click();
    await page.waitForTimeout(2500);
    const v = mV(await page.locator('#readout-v').innerText());
    expect(v).toBeLessThan(-50);
    expect(v).toBeGreaterThanOrEqual(-89.5);
  });

  test('pause stops V changing; reset returns it to 0', async ({ page }) => {
    await page.waitForTimeout(500);
    await page.locator('#play').click();
    await expect(page.locator('#play')).toHaveText('Play');
    const v1 = await page.locator('#readout-v').innerText();
    await page.waitForTimeout(500);
    expect(await page.locator('#readout-v').innerText()).toBe(v1);
    await page.locator('#reset').click();
    expect(mV(await page.locator('#readout-v').innerText())).toBe(0);
  });
});
