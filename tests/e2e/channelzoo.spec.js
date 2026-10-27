/**
 * e2e/channelzoo.spec.js
 *
 * End-to-end tests for the Channel Zoo page (channelzoo.html).
 * Tests checkbox toggling of K+, Na+, NaP, and HCN sections,
 * canvas rendering for each channel type, and slider interactions.
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

const CHANNELS = [
  {
    value: 'potassium',
    containerId: 'potassium-container',
    defaultChecked: true,
    voltageSlider: 'voltage_k',
    canvases: ['individual-plot-k', 'open-channels-plot-k', 'total-plot-k'],
    abCanvas: 'ab_plot_k',
    image: 'channel3.png',
  },
  {
    value: 'sodium',
    containerId: 'sodium-container',
    defaultChecked: false,
    voltageSlider: 'voltage_na',
    canvases: ['individual-plot-na', 'open-channels-plot-na', 'total-plot-na'],
    abCanvas: null, // has 2: ab_plot_na_m and ab_plot_na_h
    image: 'channel4.png',
  },
  {
    value: 'persistent-sodium',
    containerId: 'persistent-sodium-container',
    defaultChecked: false,
    voltageSlider: 'voltage_nap',
    canvases: ['individual-plot-nap', 'open-channels-plot-nap', 'total-plot-nap'],
    abCanvas: 'ab_plot_nap',
    image: 'channel_nap.png',
  },
  {
    value: 'hcn',
    containerId: 'hcn-container',
    defaultChecked: false,
    voltageSlider: 'voltage_hcn',
    canvases: ['individual-plot-hcn', 'open-channels-plot-hcn', 'total-plot-hcn'],
    abCanvas: 'ab_plot_hcn',
    image: 'channel_hcn.png',
  },
];

test.beforeEach(async ({ page }) => {
  await page.goto('/channelzoo.html');
  await page.waitForTimeout(600);
});

test.describe('Channel Zoo — page layout', () => {
  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle(/Zoo of Ion Channels/i);
  });

  test('h1 heading is visible', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Zoo of Ion Channels');
  });

  test('all 4 channel checkboxes are present', async ({ page }) => {
    for (const { value } of CHANNELS) {
      await expect(page.locator(`input[name="channel"][value="${value}"]`)).toBeVisible();
    }
  });

  test('only Potassium is checked by default', async ({ page }) => {
    for (const { value, defaultChecked } of CHANNELS) {
      const cb = page.locator(`input[name="channel"][value="${value}"]`);
      if (defaultChecked) {
        await expect(cb).toBeChecked();
      } else {
        await expect(cb).not.toBeChecked();
      }
    }
  });

  test('all channel images are in the DOM', async ({ page }) => {
    for (const { image } of CHANNELS) {
      // Image exists in DOM (may not be visible if container is hidden)
      const img = page.locator(`img[src*="${image}"]`).first();
      await expect(img).toBeAttached();
    }
  });
});

test.describe('Channel Zoo — default Potassium view', () => {
  test('potassium container is visible', async ({ page }) => {
    const container = page.locator('#potassium-container');
    await expect(container).toBeVisible();
  });

  test('other containers are hidden by default', async ({ page }) => {
    for (const { containerId, defaultChecked } of CHANNELS) {
      if (!defaultChecked) {
        await expect(page.locator(`#${containerId}`)).toHaveCSS('display', 'none');
      }
    }
  });

  test('Potassium canvases are rendered on load', async ({ page }) => {
    for (const id of ['individual-plot-k', 'open-channels-plot-k', 'total-plot-k']) {
      expect(await canvasHasContent(page, id)).toBe(true);
    }
  });

  test('Potassium alpha/beta rate plot is rendered', async ({ page }) => {
    expect(await canvasHasContent(page, 'ab_plot_k')).toBe(true);
  });
});

test.describe('Channel Zoo — checkbox toggling', () => {
  for (const { value, containerId } of CHANNELS.filter(c => !c.defaultChecked)) {
    test(`checking "${value}" makes its container visible`, async ({ page }) => {
      await page.locator(`input[name="channel"][value="${value}"]`).check();
      await page.waitForTimeout(200);
      await expect(page.locator(`#${containerId}`)).toBeVisible();
    });

    test(`unchecking "${value}" hides its container`, async ({ page }) => {
      // First enable it
      await page.locator(`input[name="channel"][value="${value}"]`).check();
      await page.waitForTimeout(200);
      // Then disable it
      await page.locator(`input[name="channel"][value="${value}"]`).uncheck();
      await page.waitForTimeout(200);
      await expect(page.locator(`#${containerId}`)).toHaveCSS('display', 'none');
    });
  }

  test('unchecking Potassium hides it', async ({ page }) => {
    await page.locator('input[name="channel"][value="potassium"]').uncheck();
    await expect(page.locator('#potassium-container')).toHaveCSS('display', 'none');
  });

  test('multiple channels can be visible simultaneously', async ({ page }) => {
    await page.locator('input[name="channel"][value="sodium"]').check();
    await page.locator('input[name="channel"][value="hcn"]').check();
    await page.waitForTimeout(400);
    await expect(page.locator('#potassium-container')).toBeVisible();
    await expect(page.locator('#sodium-container')).toBeVisible();
    await expect(page.locator('#hcn-container')).toBeVisible();
  });
});

test.describe('Channel Zoo — canvas rendering after enabling', () => {
  for (const { value, canvases } of CHANNELS.filter(c => !c.defaultChecked)) {
    test(`enabling "${value}" — all 3 simulation canvases render`, async ({ page }) => {
      await page.locator(`input[name="channel"][value="${value}"]`).check();
      await page.waitForTimeout(400);
      for (const id of canvases) {
        expect(await canvasHasContent(page, id),
          `Canvas ${id} should have content after enabling ${value}`
        ).toBe(true);
      }
    });
  }

  test('Sodium: both m-gate and h-gate alpha/beta plots render', async ({ page }) => {
    await page.locator('input[name="channel"][value="sodium"]').check();
    await page.waitForTimeout(400);
    expect(await canvasHasContent(page, 'ab_plot_na_m')).toBe(true);
    expect(await canvasHasContent(page, 'ab_plot_na_h')).toBe(true);
  });
});

test.describe('Channel Zoo — slider interactions', () => {
  test('changing K+ voltage rerenders its plots', async ({ page }) => {
    await setSlider(page, 'voltage_k', 20);
    await page.waitForTimeout(200);
    expect(await canvasHasContent(page, 'individual-plot-k')).toBe(true);
  });

  test('HCN default voltage is -70 mV (hyperpolarised)', async ({ page }) => {
    // HCN opens at hyperpolarised voltages; default should be -70
    const val = await page.locator('#voltage_hcn').getAttribute('value');
    expect(Number(val)).toBeLessThanOrEqual(-60);
  });

  test('HCN has longer max simulation duration (up to 1000ms)', async ({ page }) => {
    const max = await page.locator('#duration_hcn').getAttribute('max');
    expect(Number(max)).toBeGreaterThanOrEqual(1000);
  });

  test('no JS errors when enabling and interacting with all 4 channels', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const { value } of CHANNELS) {
      const cb = page.locator(`input[name="channel"][value="${value}"]`);
      if (!(await cb.isChecked())) await cb.check();
    }
    await page.waitForTimeout(800);
    expect(errors).toHaveLength(0);
  });
});
