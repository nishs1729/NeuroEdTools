/**
 * e2e/izhikevich.spec.js
 *
 * End-to-end tests for the Izhikevich neuron model page (izhikevich.html).
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
  await page.goto('/izhikevich.html');
  await page.waitForTimeout(400);
});

test.describe('Izhikevich — page layout', () => {
  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle(/Izhikevich/i);
  });

  test('h1 heading is visible', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Izhikevich');
  });

  test('firing pattern dropdown is present', async ({ page }) => {
    await expect(page.locator('#firing_pattern')).toBeVisible();
  });

  test('dropdown has at least 20 preset options', async ({ page }) => {
    const count = await page.locator('#firing_pattern option').count();
    expect(count).toBeGreaterThanOrEqual(20);
  });

  test('all parameter sliders are present', async ({ page }) => {
    for (const id of ['param_a', 'param_b', 'param_c', 'param_d', 'param_i', 'duration', 'v_init', 'u_init']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  test('both canvas plots are present', async ({ page }) => {
    await expect(page.locator('#v-w-plot')).toBeVisible();
    await expect(page.locator('#phase-plot')).toBeVisible();
  });

  test('Izhikevich model equation image is visible', async ({ page }) => {
    await expect(page.locator('img[src*="izhikevich_model.png"]')).toBeVisible();
  });
});

test.describe('Izhikevich — plots render on load', () => {
  test('v-w-plot has rendered content', async ({ page }) => {
    expect(await canvasHasContent(page, 'v-w-plot')).toBe(true);
  });

  test('phase-plot has rendered content', async ({ page }) => {
    expect(await canvasHasContent(page, 'phase-plot')).toBe(true);
  });
});

test.describe('Izhikevich — firing pattern presets', () => {
  const presets = ['rs', 'ib', 'ch', 'fs', 'lts', 'tc', 'rz', 'sfa'];

  for (const preset of presets) {
    test(`selecting preset "${preset}" updates sliders and redraws plots`, async ({ page }) => {
      await page.locator('#firing_pattern').selectOption(preset);
      await page.waitForTimeout(300);
      // Sliders should be set to non-default values (just check they're present and finite)
      const a = await page.locator('#param_a').inputValue();
      expect(isFinite(Number(a))).toBe(true);
      // Plots should still be drawn
      expect(await canvasHasContent(page, 'v-w-plot')).toBe(true);
    });
  }

  test('Regular Spiking preset sets a=0.02, b=0.2', async ({ page }) => {
    await page.locator('#firing_pattern').selectOption('rs');
    await page.waitForTimeout(200);
    await expect(page.locator('#param_a-value')).toHaveText('0.02');
    await expect(page.locator('#param_b-value')).toHaveText('0.20');
  });

  test('Fast Spiking preset sets a=0.1', async ({ page }) => {
    await page.locator('#firing_pattern').selectOption('fs');
    await page.waitForTimeout(200);
    await expect(page.locator('#param_a-value')).toHaveText('0.10');
  });
});

test.describe('Izhikevich — slider interactions', () => {
  test('moving a slider switches dropdown to "Custom"', async ({ page }) => {
    await setSlider(page, 'param_a', 0.05);
    const selected = await page.locator('#firing_pattern').inputValue();
    expect(selected).toBe('custom');
  });

  test('param_a display updates correctly', async ({ page }) => {
    await setSlider(page, 'param_a', 0.05);
    await expect(page.locator('#param_a-value')).toHaveText('0.05');
  });

  test('duration slider change redraws plots', async ({ page }) => {
    await setSlider(page, 'duration', 500);
    await page.waitForTimeout(300);
    expect(await canvasHasContent(page, 'v-w-plot')).toBe(true);
  });

  test('v_init and u_init sliders are functional', async ({ page }) => {
    await setSlider(page, 'v_init', -80);
    await setSlider(page, 'u_init', -20);
    await page.waitForTimeout(300);
    expect(await canvasHasContent(page, 'v-w-plot')).toBe(true);
  });
});

test.describe('Izhikevich — slider ranges', () => {
  test('param_a range is [0.01, 0.2]', async ({ page }) => {
    expect(Number(await page.locator('#param_a').getAttribute('min'))).toBeCloseTo(0.01);
    expect(Number(await page.locator('#param_a').getAttribute('max'))).toBeCloseTo(0.2);
  });

  test('param_c range allows values down to -80', async ({ page }) => {
    expect(Number(await page.locator('#param_c').getAttribute('min'))).toBeLessThanOrEqual(-80);
  });

  test('param_i max is 20', async ({ page }) => {
    expect(Number(await page.locator('#param_i').getAttribute('max'))).toBe(20);
  });
});
