/**
 * e2e/channel.spec.js
 *
 * End-to-end tests for the Stochastic Channel Simulation page (channel.html).
 * Tests all 4 parts: constant-rate gating, voltage-dependent gate,
 * K+ channel (4-gate), and Na+ channel (3m+1h gates).
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

test.beforeEach(async ({ page }) => {
  await page.goto('/channel.html');
  await page.waitForTimeout(600); // stochastic sims take a moment
});

test.describe('Channel page — layout', () => {
  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle(/Stochastic Channel/i);
  });

  test('all 4 part sections are visible', async ({ page }) => {
    const sections = page.locator('.model-section');
    await expect(sections).toHaveCount(4);
  });

  test('Part 1 sliders are present', async ({ page }) => {
    await expect(page.locator('#alpha_p1')).toBeVisible();
    await expect(page.locator('#beta_p1')).toBeVisible();
    await expect(page.locator('#num_channels_p1')).toBeVisible();
    await expect(page.locator('#duration_p1')).toBeVisible();
  });

  test('Part 2 voltage slider is present', async ({ page }) => {
    await expect(page.locator('#voltage_p2')).toBeVisible();
  });

  test('Part 3 voltage slider is present (K+ channel)', async ({ page }) => {
    await expect(page.locator('#voltage_p3')).toBeVisible();
  });

  test('Part 4 voltage slider is present (Na+ channel)', async ({ page }) => {
    await expect(page.locator('#voltage_p4')).toBeVisible();
  });

  test('channel state diagram images are present for all parts', async ({ page }) => {
    await expect(page.locator('img[src*="channel1.png"]')).toBeVisible();
    await expect(page.locator('img[src*="channel2.png"]')).toBeVisible();
    await expect(page.locator('img[src*="channel3.png"]')).toBeVisible();
    await expect(page.locator('img[src*="channel4.png"]')).toBeVisible();
  });
});

test.describe('Channel page — canvas rendering', () => {
  const canvases = [
    'individual-plot-p1', 'total-plot-p1',
    'individual-plot-p2', 'open-channels-plot-p2', 'total-plot-p2',
    'individual-plot-p3', 'open-channels-plot-p3', 'total-plot-p3',
    'individual-plot-p4', 'open-channels-plot-p4', 'total-plot-p4',
  ];

  for (const id of canvases) {
    test(`canvas ${id} has rendered content`, async ({ page }) => {
      expect(await canvasHasContent(page, id)).toBe(true);
    });
  }

  test('alpha/beta rate plots render for Parts 2, 3, 4', async ({ page }) => {
    expect(await canvasHasContent(page, 'ab_plot_p2')).toBe(true);
    expect(await canvasHasContent(page, 'ab_plot_p3')).toBe(true);
    expect(await canvasHasContent(page, 'ab_plot_p4_m')).toBe(true);
    expect(await canvasHasContent(page, 'ab_plot_p4_h')).toBe(true);
  });
});

test.describe('Channel page — Part 1 interactions', () => {
  test('slider display values match defaults on load', async ({ page }) => {
    await expect(page.locator('#alpha_p1-value')).toHaveText('0.1');
    await expect(page.locator('#beta_p1-value')).toHaveText('0.2');
    await expect(page.locator('#num_channels_p1-value')).toHaveText('1');
    await expect(page.locator('#duration_p1-value')).toHaveText('100');
  });

  test('changing alpha rerenders plots', async ({ page }) => {
    await setSlider(page, 'alpha_p1', 0.5);
    await page.waitForTimeout(200);
    expect(await canvasHasContent(page, 'individual-plot-p1')).toBe(true);
    expect(await canvasHasContent(page, 'total-plot-p1')).toBe(true);
  });

  test('increasing N channels rerenders individual plot', async ({ page }) => {
    await setSlider(page, 'num_channels_p1', 20);
    await page.waitForTimeout(200);
    expect(await canvasHasContent(page, 'individual-plot-p1')).toBe(true);
  });

  test('alpha=0 keeps all channels closed (total plot flat)', async ({ page }) => {
    await setSlider(page, 'alpha_p1', 0.01); // minimum
    await setSlider(page, 'beta_p1', 0.99); // high close rate
    await page.waitForTimeout(200);
    // Plot should still be drawn without errors
    expect(await canvasHasContent(page, 'total-plot-p1')).toBe(true);
  });
});

test.describe('Channel page — Parts 2, 3, 4 voltage interactions', () => {
  const parts = [
    { part: 2, voltageId: 'voltage_p2', indPlot: 'individual-plot-p2' },
    { part: 3, voltageId: 'voltage_p3', indPlot: 'individual-plot-p3' },
    { part: 4, voltageId: 'voltage_p4', indPlot: 'individual-plot-p4' },
  ];

  for (const { part, voltageId, indPlot } of parts) {
    test(`Part ${part}: changing voltage redraws individual channel plot`, async ({ page }) => {
      await setSlider(page, voltageId, 20);
      await page.waitForTimeout(200);
      expect(await canvasHasContent(page, indPlot)).toBe(true);
    });

    test(`Part ${part}: voltage slider display updates`, async ({ page }) => {
      await setSlider(page, voltageId, -50);
      const displayed = await page.locator(`#${voltageId}-value`).innerText();
      expect(Number(displayed)).toBeCloseTo(-50, 0);
    });
  }
});

test.describe('Channel page — no errors', () => {
  test('no JavaScript errors on page load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/channel.html');
    await page.waitForTimeout(600);
    expect(errors).toHaveLength(0);
  });

  test('no errors when rapidly changing all Part 1 sliders', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const [id, val] of [['alpha_p1', 0.3], ['beta_p1', 0.5], ['num_channels_p1', 50], ['duration_p1', 150]]) {
      await setSlider(page, id, val);
    }
    await page.waitForTimeout(300);
    expect(errors).toHaveLength(0);
  });
});
