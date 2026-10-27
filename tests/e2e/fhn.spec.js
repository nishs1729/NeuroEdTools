/**
 * e2e/fhn.spec.js
 *
 * End-to-end tests for the FitzHugh-Nagumo model page (fhn.html).
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
  await page.goto('/fhn.html');
  await page.waitForTimeout(400);
});

test.describe('FHN — page layout', () => {
  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle(/FitzHugh-Nagumo/i);
  });

  test('h1 heading is visible', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('FitzHugh-Nagumo');
  });

  test('all parameter sliders are present', async ({ page }) => {
    for (const id of ['param_i', 'param_a', 'param_b', 'param_epsilon', 'duration', 'v_init', 'w_init']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  test('both canvas plots are present', async ({ page }) => {
    await expect(page.locator('#v-w-plot')).toBeVisible();
    await expect(page.locator('#phase-plot')).toBeVisible();
  });

  test('FHN model equation image is visible', async ({ page }) => {
    await expect(page.locator('img[src*="fhn_model.png"]')).toBeVisible();
  });
});

test.describe('FHN — plots render on load', () => {
  test('time series plot (v-w-plot) has content', async ({ page }) => {
    expect(await canvasHasContent(page, 'v-w-plot')).toBe(true);
  });

  test('phase plot has content', async ({ page }) => {
    expect(await canvasHasContent(page, 'phase-plot')).toBe(true);
  });
});

test.describe('FHN — slider display values', () => {
  test('I display value matches slider', async ({ page }) => {
    await expect(page.locator('#param_i-value')).toHaveText('0.50');
  });

  test('a display value matches slider', async ({ page }) => {
    await expect(page.locator('#param_a-value')).toHaveText('0.70');
  });

  test('epsilon display value matches slider', async ({ page }) => {
    await expect(page.locator('#param_epsilon-value')).toHaveText('0.08');
  });

  test('duration display value matches slider', async ({ page }) => {
    // fnh.js formats with .toFixed(2) → "200.00"
    const val = await page.locator('#duration-value').innerText();
    expect(Number(val)).toBeCloseTo(200, 0);
  });
});

test.describe('FHN — interactions', () => {
  test('changing I redraws both plots', async ({ page }) => {
    await setSlider(page, 'param_i', 1.5);
    await page.waitForTimeout(300);
    expect(await canvasHasContent(page, 'v-w-plot')).toBe(true);
    expect(await canvasHasContent(page, 'phase-plot')).toBe(true);
  });

  test('changing epsilon redraws plots', async ({ page }) => {
    await setSlider(page, 'param_epsilon', 0.15);
    await page.waitForTimeout(300);
    expect(await canvasHasContent(page, 'v-w-plot')).toBe(true);
  });

  test('changing initial conditions redraws plots', async ({ page }) => {
    await setSlider(page, 'v_init', 1.0);
    await setSlider(page, 'w_init', 0.5);
    await page.waitForTimeout(300);
    expect(await canvasHasContent(page, 'v-w-plot')).toBe(true);
  });

  test('plots survive extreme parameter values without crashing', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await setSlider(page, 'param_i', 2.0);    // max I
    await setSlider(page, 'param_epsilon', 0.01); // min epsilon
    await page.waitForTimeout(300);
    expect(errors).toHaveLength(0);
    expect(await canvasHasContent(page, 'v-w-plot')).toBe(true);
  });
});

test.describe('FHN — slider ranges', () => {
  test('I range is [0, 2]', async ({ page }) => {
    expect(Number(await page.locator('#param_i').getAttribute('min'))).toBe(0);
    expect(Number(await page.locator('#param_i').getAttribute('max'))).toBe(2);
  });

  test('epsilon range is [0.01, 0.2]', async ({ page }) => {
    expect(Number(await page.locator('#param_epsilon').getAttribute('min'))).toBeCloseTo(0.01);
    expect(Number(await page.locator('#param_epsilon').getAttribute('max'))).toBeCloseTo(0.2);
  });

  test('v_init and w_init allow negative values', async ({ page }) => {
    expect(Number(await page.locator('#v_init').getAttribute('min'))).toBeLessThan(0);
    expect(Number(await page.locator('#w_init').getAttribute('min'))).toBeLessThan(0);
  });
});
